// index.js (EATSURE BACKEND)
// ===================================
// Main API
// - /scan/:barcode  -> OFF üzerinden normal tarama
// - /ocr/analyze    -> OCR metnini analiz edip karar üretir
// ===================================

const express = require("express");
const cors = require("cors");

const { findCertificationsForProduct } = require("./certifications");
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const { fetchProductByBarcode } = require("./openFoodFacts");

const app = express();
app.use(cors());

// OCR metni bazen uzun olabilir: limit'i yükseltiyoruz
app.use(express.json({ limit: "2mb" }));

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
 * ✅ Brand normalize helper (OFF brands -> first)
 */
function firstBrand(brands) {
  if (!brands) return null;
  const s = String(brands);
  const first = s.split(",")[0]?.trim();
  return first || null;
}

/**
 * 🧪 TEMP TEST ENDPOINT — SİLİNECEK
 * ÜRÜN BAZLI SERTİFİKA TESTİ
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
 * ✅ OCR TEXT ANALYZE ENDPOINT
 *
 * PWA OCR → labelText gönderir → analysis + decision döner.
 *
 * POST /ocr/analyze
 * body: {
 *   labelText: "...."   (zorunlu)
 *   barcode?: "..."     (opsiyonel)
 *   brand?: "..."       (opsiyonel)  // varsa en doğrusu
 *   name?: "..."        (opsiyonel)
 * }
 */
app.post("/ocr/analyze", async (req, res) => {
  const evaluatedAt = new Date().toISOString();

  const labelText = typeof req.body?.labelText === "string" ? req.body.labelText : "";
  const barcode = typeof req.body?.barcode === "string" ? req.body.barcode.trim() : null;
  const inputBrand = typeof req.body?.brand === "string" ? req.body.brand.trim() : null;
  const inputName = typeof req.body?.name === "string" ? req.body.name.trim() : null;

  if (!labelText || labelText.trim().length < 3) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "labelText zorunludur (en az 3 karakter).",
      meta: { evaluatedAt }
    });
  }

  // 1) Önce PWA'dan gelen brand/name (en doğru kaynak)
  let resolvedBrand = inputBrand || null;
  let resolvedName = inputName || null;

  // 2) Opsiyonel: barcode varsa OFF'tan sadece boşları doldurmayı dene
  let offAvailable = false;
  if (barcode && (!resolvedBrand || !resolvedName)) {
    try {
      const offData = await fetchProductByBarcode(barcode);
      if (offData && offData.status === 1 && offData.product) {
        offAvailable = true;
        const p = offData.product;

        if (!resolvedName && p.product_name) resolvedName = p.product_name;
        if (!resolvedBrand && p.brands) resolvedBrand = firstBrand(p.brands);
      }
    } catch {
      // OFF yoksa problem değil, OCR ile karar üretiriz.
    }
  }

  // Sertifikasyon: sadece brand varsa anlamlı
  const certifications = resolvedBrand
    ? findCertificationsForProduct({
        brand: resolvedBrand,
        productName: resolvedName || "",
        productFamily: "" // OCR aşamasında family eşleşmesini şimdilik boş geçiyoruz
      })
    : [];

  // Analyzer: OCR metnini labels alanına veriyoruz (gluten free / may contain / vs burada yakalanır)
  const analysis = analyzeGluten({
    ingredients: "",
    productName: resolvedName || "",
    allergens: "",
    allergenTags: "",
    traces: "",
    labels: labelText,
    labelsTags: ""
  });

  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: analysis
  });

  return res.json({
    barcode: barcode || null,
    name: resolvedName || null,
    brand: resolvedBrand || null,
    analysis,
    decision,
    meta: {
      evaluatedAt,
      source: "ocr_text",
      openFoodFactsUsedForPrefill: offAvailable
    }
  });
});

/**
 * 🔍 NORMAL SCAN ENDPOINT (MEVCUT)
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
  const normalizedBrand = firstBrand(product.brands);

  const categoriesTagsText = safeJoin(product.categories_tags);
  const allergensTagsText = safeJoin(product.allergens_tags);
  const tracesTagsText = safeJoin(product.traces_tags);
  const labelsTagsText = safeJoin(product.labels_tags);

  // 🔹 Sertifikasyon
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productName: productName,
    productFamily: categoriesTagsText || product.categories || ""
  });

  // 🔑 Analyzer'a tüm ilgili OFF alanları
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
