const express = require("express");
const cors = require("cors");
const axios = require("axios");

const { findCertificationsForProduct } = require("./certifications");
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const { fetchProductByBarcode } = require("./openFoodFacts");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * 🔥 HEALTH CHECK
 */
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

/**
 * ✅ Array/String/Null güvenli join helper
 * - Array -> "a b c"
 * - String -> aynen
 * - Null/undefined -> ""
 */
function safeJoin(value) {
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "string") return value;
  return "";
}

/**
 * 🔐 Admin guard
 * - ?key=... veya header: x-admin-key
 */
function requireAdmin(req, res) {
  const expected = process.env.ADMIN_KEY || "";
  const provided =
    (req.query.key && String(req.query.key)) ||
    req.headers["x-admin-key"] ||
    "";

  if (!expected || provided !== expected) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return false;
  }
  return true;
}

/**
 * 🧩 OFF User-Agent
 */
function getOffUserAgent() {
  return process.env.OFF_USER_AGENT || "EatSure/0.1 (contact: admin@example.com)";
}

/**
 * ⏳ Small sleep helper (for retry backoff)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ✅ timeout / network kaynaklı mı?
 */
function isRetryableOffError(err) {
  if (!err) return false;
  if (err.code === "ECONNABORTED") return true; // axios timeout
  const msg = String(err.message || "").toLowerCase();
  if (msg.includes("timeout")) return true;
  if (msg.includes("socket hang up")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("enetunreach") || msg.includes("eai_again")) return true;
  return false;
}

/**
 * ✅ OFF search response -> seed-friendly map
 */
function mapOffProducts(products) {
  const list = Array.isArray(products) ? products : [];
  return list.map(p => ({
    barcode: p.code || null,
    name: p.product_name || null,
    brand: p.brands ? String(p.brands).split(",")[0].trim() : null,

    // ham alanlar
    brands_raw: p.brands || null,
    ingredients_text: p.ingredients_text || null,
    allergens: p.allergens || null,
    allergens_tags: p.allergens_tags || null,
    traces: p.traces || null,
    traces_tags: p.traces_tags || null,
    labels: p.labels || null,
    labels_tags: p.labels_tags || null,
    categories: p.categories || null,
    categories_tags: p.categories_tags || null,
    countries: p.countries || null,
    countries_tags: p.countries_tags || null
  }));
}

/**
 * ✅ “Glutensiz beyanı” hızlı kontrol (seed için)
 * Not: Bu bir karar motoru değil; sadece seed listesini daraltmak için.
 */
function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeGlutenFreeClaim(p = {}) {
  const labelsTags = Array.isArray(p.labels_tags) ? p.labels_tags : [];
  if (labelsTags.includes("en:no-gluten")) return true;

  const pool = normalizeText(
    `${p.product_name || ""} ${p.labels || ""} ${p.ingredients_text || ""}`
  );

  // Çok kaba ama işe yarar seed filtresi:
  const terms = [
    "gluten free",
    "gluten-free",
    "no gluten",
    "without gluten",
    "free from gluten",
    "sans gluten",
    "senza glutine",
    "glutenfrei",
    "sin gluten",
    "sem gluten",
    "glutensiz",
    "gluten icermez",
    "gluten içermez"
  ];

  return terms.some(t => pool.includes(normalizeText(t)));
}

function isProbablyNonFood(p = {}) {
  const cats = Array.isArray(p.categories_tags) ? p.categories_tags : [];
  // OFF içinde kozmetik vb. çok çıkabiliyor
  if (cats.includes("en:open-beauty-facts")) return true;
  return false;
}

/**
 * 📦 OFF v0 search (cgi/search.pl)
 * Bu sürümde aynı anda birden fazla tag filtresi kullanılabiliyor (tagtype_0, tagtype_1 ...).
 */
async function fetchOffSearchV0({ countryTag, page, limit, fields, gfOnly }) {
  const url = "https://world.openfoodfacts.org/cgi/search.pl";

  const params = {
    search_simple: 1,
    action: "process",
    json: 1,
    page,
    page_size: limit,
    fields
  };

  // 1) Ülke filtresi
  params.tagtype_0 = "countries";
  params.tag_contains_0 = "contains";
  params.tag_0 = countryTag;

  // 2) GF label filtresi (mümkünse OFF tarafında)
  // OFF labels_tags içinde örnek: "en:no-gluten"
  if (gfOnly) {
    params.tagtype_1 = "labels";
    params.tag_contains_1 = "contains";
    params.tag_1 = "en:no-gluten";
  }

  const response = await axios.get(url, {
    timeout: 40000,
    headers: { "User-Agent": getOffUserAgent() },
    params,
    validateStatus: () => true
  });

  if (!response.data) {
    const e = new Error("OFF_EMPTY_RESPONSE");
    e._off_empty = true;
    throw e;
  }

  return response.data; // { products, count, ... }
}

/**
 * 📦 OFF v2 search (fallback)
 * v2 parametreleri değişken olabildiği için burada “best effort” yapıyoruz.
 */
async function fetchOffSearchV2({ countryTag, page, limit, fields }) {
  const url = "https://world.openfoodfacts.org/api/v2/search";
  const v2CountryTag = countryTag.startsWith("en:") ? countryTag : `en:${countryTag}`;

  const response = await axios.get(url, {
    timeout: 40000,
    headers: { "User-Agent": getOffUserAgent() },
    params: {
      page,
      page_size: limit,
      fields,
      countries_tags: v2CountryTag
      // v2'de labels filtresi her zaman stabil değil, post-filter yapacağız
    },
    validateStatus: () => true
  });

  if (!response.data) {
    const e = new Error("OFF_EMPTY_RESPONSE");
    e._off_empty = true;
    throw e;
  }

  return response.data;
}

/**
 * 📦 OFF search with 1 retry + v2 fallback
 */
async function fetchOffWithRetryAndFallback({ countryTag, page, limit, fields, gfOnly }) {
  // 1) önce v0 (retry ile)
  try {
    try {
      return {
        source: "openfoodfacts_search_v0",
        data: await fetchOffSearchV0({ countryTag, page, limit, fields, gfOnly })
      };
    } catch (err1) {
      if (isRetryableOffError(err1)) {
        await sleep(300);
        return {
          source: "openfoodfacts_search_v0",
          data: await fetchOffSearchV0({ countryTag, page, limit, fields, gfOnly })
        };
      }
      throw err1;
    }
  } catch (errV0) {
    // 2) v2 fallback (retry ile)
    try {
      try {
        return {
          source: "openfoodfacts_search_v2",
          data: await fetchOffSearchV2({ countryTag, page, limit, fields })
        };
      } catch (err2) {
        if (isRetryableOffError(err2)) {
          await sleep(300);
          return {
            source: "openfoodfacts_search_v2",
            data: await fetchOffSearchV2({ countryTag, page, limit, fields })
          };
        }
        throw err2;
      }
    } catch (errV2) {
      throw (errV2 || errV0);
    }
  }
}

/**
 * 📦 Admin Seed Endpoint (DB'ye yazmaz, JSON döner)
 *
 * Kullanım (varsayılan: gfOnly=1):
 * /admin/seed/off?key=ADMIN_KEY&country=tr&limit=200&page=1
 *
 * GF filtresini kapatmak için:
 * /admin/seed/off?key=...&country=tr&limit=200&page=1&gfOnly=0
 */
app.get("/admin/seed/off", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const evaluatedAt = new Date().toISOString();

  const rawCountry = String(req.query.country || "tr").toLowerCase().trim();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || "200", 10)));

  // gfOnly default: 1 (açık)
  const gfOnly = String(req.query.gfOnly || "1").trim() !== "0";

  // OFF'ta ülke tag'i bazen "turkey" / "en:turkey"
  let countryTag = rawCountry;
  if (countryTag === "tr") countryTag = "turkey";
  if (countryTag.startsWith("en:")) countryTag = countryTag.replace("en:", "");

  const fields = [
    "code",
    "product_name",
    "brands",
    "ingredients_text",
    "allergens",
    "allergens_tags",
    "traces",
    "traces_tags",
    "labels",
    "labels_tags",
    "categories",
    "categories_tags",
    "countries",
    "countries_tags"
  ].join(",");

  try {
    const { source, data } = await fetchOffWithRetryAndFallback({
      countryTag,
      page,
      limit,
      fields,
      gfOnly
    });

    const products = Array.isArray(data.products) ? data.products : [];

    // v0'da label filtresi çalışsa bile kirli veri olabilir,
    // v2 fallback'te zaten label filtresi yok -> post-filter şart.
    const filtered = products
      .filter(p => !isProbablyNonFood(p))
      .filter(p => (gfOnly ? looksLikeGlutenFreeClaim(p) : true));

    const mapped = mapOffProducts(filtered);

    return res.json({
      meta: {
        evaluatedAt,
        source,
        country: countryTag,
        page,
        page_size: limit,
        gfOnly,
        returned: mapped.length,
        total_count: data.count || null
      },
      products: mapped
    });
  } catch (err) {
    return res.status(502).json({
      error: "OFF_FETCH_FAILED",
      message: err.message,
      evaluatedAt
    });
  }
});

/**
 * 🧪 TEMP TEST ENDPOINT — SİLİNECEK
 */
if (process.env.NODE_ENV !== "production") {
  app.get("/test-cert/:product", (req, res) => {
    const evaluatedAt = new Date().toISOString();
    const productName = req.params.product;

    const testProduct = {
      brand: "TestBrand",
      productName,
      productFamily: null
    };

    const certifications = findCertificationsForProduct({
      brand: testProduct.brand,
      productName: testProduct.productName,
      productFamily: testProduct.productFamily
    });

    const decision = decideGlutenStatus({
      certifications,
      ingredientAnalysis: null
    });

    res.json({
      barcode: "TEST-ONLY",
      name: testProduct.productName,
      brand: testProduct.brand,
      ingredients: null,
      analysis: { test_mode: true },
      decision,
      meta: { evaluatedAt, test_endpoint: true }
    });
  });
}

/**
 * 🔍 NORMAL SCAN ENDPOINT
 */
app.get("/scan/:barcode", async (req, res) => {
  const { barcode } = req.params;
  const evaluatedAt = new Date().toISOString();

  let offData = null;
  let offAvailable = true;

  try {
    offData = await fetchProductByBarcode(barcode);
    if (offData.status !== 1) offAvailable = false;
  } catch {
    offAvailable = false;
  }

  const product = offAvailable ? offData.product || {} : {};

  const productName = product.product_name || null;
  const normalizedBrand = product.brands ? product.brands.split(",")[0].trim() : null;

  const categoriesTagsText = safeJoin(product.categories_tags);
  const allergensTagsText = safeJoin(product.allergens_tags);
  const tracesTagsText = safeJoin(product.traces_tags);
  const labelsTagsText = safeJoin(product.labels_tags);

  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productName: productName,
    productFamily: categoriesTagsText || product.categories || ""
  });

  let analysis = null;

  const ingredientsText = product.ingredients_text || "";
  const productNameText = product.product_name || "";
  const allergensText = product.allergens || "";
  const tracesText = product.traces || "";
  const labelsText = product.labels || "";

  const hasAnyAnalyzableText = [
    ingredientsText,
    productNameText,
    allergensText,
    allergensTagsText,
    tracesText,
    tracesTagsText,
    labelsText,
    labelsTagsText
  ].some(v => typeof v === "string" && v.trim().length > 0);

  if (hasAnyAnalyzableText) {
    analysis = analyzeGluten({
      ingredients: ingredientsText,
      productName: productNameText,
      allergens: allergensText,
      allergenTags: allergensTagsText,
      traces: tracesTagsText || tracesText,
      labels: labelsText,
      labelsTags: labelsTagsText
    });
  }

  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: analysis
  });

  res.json({
    barcode,
    name: productName || "Bilinmiyor",
    brand: normalizedBrand || "Bilinmiyor",
    ingredients: product.ingredients_text || null,
    analysis,
    decision,
    meta: {
      evaluatedAt,
      openFoodFactsAvailable: offAvailable,
      hasIngredients: !!product.ingredients_text
    }
  });
});

app.listen(PORT, () => {
  console.log("API çalışıyor");
});
