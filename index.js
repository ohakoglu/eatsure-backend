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
 * ✅ Basit text normalize (GF claim kontrolü için)
 */
function normText(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ✅ Brand normalize (unique için)
 */
function normBrand(v) {
  return normText(v).replace(/\./g, "");
}

/**
 * ✅ Ülke parametresini normalize et
 * - "tr", "turkiye", "türkiye", "turkey", "en:turkey" -> "turkey"
 * - "all", "global", "" -> null (ülke filtresi KAPALI)
 */
function normalizeCountry(raw) {
  const s = normText(raw);
  if (!s || s === "all" || s === "global" || s === "world") return null;

  if (s === "tr" || s === "turkiye" || s === "türkiye") return "turkey";
  if (s.startsWith("en:")) return s.replace("en:", "");
  return s; // örn: "germany" vs
}

/**
 * ✅ GF beyanı var mı? (hafif ve hızlı)
 * - labels_tags içinde en:no-gluten
 * - product_name / labels / ingredients_text içinde temel GF ifadeleri
 */
function hasGfClaimFromOffProduct(p) {
  const labelsTags = Array.isArray(p.labels_tags) ? p.labels_tags : [];
  if (labelsTags.map(normText).includes("en:no-gluten")) return true;

  const pool = normText(
    `${p.product_name || ""} ${p.labels || ""} ${p.ingredients_text || ""}`
  );

  // Minimum set (MVP güvenli taraf)
  const gfTerms = [
    "gluten free",
    "gluten-free",
    "no gluten",
    "without gluten",
    "free from gluten",
    "glutensiz",
    "gluten icermez",
    "sans gluten",
    "senza glutine",
    "glutenfrei",
    "sin gluten",
    "sem gluten"
  ];

  return gfTerms.some(t => pool.includes(t));
}

/**
 * 📦 OFF v0 search (cgi/search.pl)
 */
async function fetchOffSearchV0({ countryTag, page, limit, fields, gfOnly }) {
  const url = "https://world.openfoodfacts.org/cgi/search.pl";

  // countryTag null ise ülke filtresi gönderme
  const params = {
    search_simple: 1,
    action: "process",
    json: 1,
    page,
    page_size: limit,
    fields
  };

  if (countryTag) {
    params.tagtype_0 = "countries";
    params.tag_contains_0 = "contains";
    params.tag_0 = countryTag;
  }

  // gfOnly isteniyorsa: labels_tags içinde no-gluten filtrele (OFF tarafında)
  // (Bu filtre her zaman mükemmel değil ama çok hız kazandırır)
  if (gfOnly) {
    params.tagtype_1 = "labels";
    params.tag_contains_1 = "contains";
    params.tag_1 = "no-gluten";
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
 * (En basit deneme: countries_tags ve labels_tags)
 */
async function fetchOffSearchV2({ countryTag, page, limit, fields, gfOnly }) {
  const url = "https://world.openfoodfacts.org/api/v2/search";

  const params = {
    page,
    page_size: limit,
    fields
  };

  if (countryTag) {
    params.countries_tags = countryTag.startsWith("en:") ? countryTag : `en:${countryTag}`;
  }

  if (gfOnly) {
    // v2 tarafında bazen labels_tags ile çalışıyor
    params.labels_tags = "en:no-gluten";
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

  return response.data;
}

/**
 * 📦 OFF search with 1 retry + v2 fallback
 */
async function fetchOffWithRetryAndFallback({ countryTag, page, limit, fields, gfOnly }) {
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
    try {
      try {
        return {
          source: "openfoodfacts_search_v2",
          data: await fetchOffSearchV2({ countryTag, page, limit, fields, gfOnly })
        };
      } catch (err2) {
        if (isRetryableOffError(err2)) {
          await sleep(300);
          return {
            source: "openfoodfacts_search_v2",
            data: await fetchOffSearchV2({ countryTag, page, limit, fields, gfOnly })
          };
        }
        throw err2;
      }
    } catch (errV2) {
      throw errV2 || errV0;
    }
  }
}

/**
 * 🧠 RAM'de görülen markalar (deploy sonrası sıfırlanır)
 * Amaç: "daha önce kaydetmediği markanın ilk ürünü" mantığı
 */
const seenBrands = new Set();

/**
 * 📦 Admin Seed Endpoint (DB'ye yazmaz, minimal JSON döner)
 *
 * Amaç:
 * - GF beyanı olan ürünlerden
 * - daha önce görülmeyen markaların
 * - ilk yakalanan ürününü (barcode+brand+name) döndürmek
 *
 * Kullanım örnekleri:
 * 1) Türkiye (varsayılan):  /admin/seed/off?key=...&limit=50&page=1
 * 2) Ülkeyi kapat (global): /admin/seed/off?key=...&country=all&limit=50&page=1
 * 3) Almanya:              /admin/seed/off?key=...&country=germany&limit=50&page=1
 *
 * Ek parametreler:
 * - gfOnly=1 (default): OFF tarafında no-gluten etiketlileri çekmeye çalışır (hızlı)
 * - fresh=1: RAM'deki "seenBrands" setini bu çağrı için yok say (markaları yeniden döndürebilir)
 */
app.get("/admin/seed/off", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const evaluatedAt = new Date().toISOString();

  const rawCountry = req.query.country; // undefined olabilir
  const countryTag = normalizeCountry(rawCountry);

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || "50", 10)));

  const gfOnly = String(req.query.gfOnly || "1") !== "0";
  const fresh = String(req.query.fresh || "0") === "1";

  // Minimal fields: sadece ihtiyaç duyduklarımız
  const fields = [
    "code",
    "product_name",
    "brands",
    "labels",
    "labels_tags",
    "ingredients_text"
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

    // "Sadece GF beyanlı + yeni marka" => minimal item list
    const items = [];
    for (const p of products) {
      const brandRaw = p.brands ? String(p.brands).split(",")[0].trim() : "";
      const brand = normBrand(brandRaw);
      if (!brand) continue;

      // GF claim kontrolü (hafif)
      if (!hasGfClaimFromOffProduct(p)) continue;

      // Daha önce görüldü mü?
      const alreadySeen = seenBrands.has(brand);
      if (!fresh && alreadySeen) continue;

      // İşaretle
      seenBrands.add(brand);

      items.push({
        barcode: p.code || null,
        brand: brandRaw || null,
        name: p.product_name || null
      });
    }

    return res.json({
      meta: {
        evaluatedAt,
        source,
        country: countryTag || "ALL",
        page,
        page_size: limit,
        gfOnly,
        fresh,
        returned: items.length,
        total_count: data.count || null
      },
      products: items
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
