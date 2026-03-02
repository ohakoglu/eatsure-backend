// index.js (TAMAMINI DEĞİŞTİR)
const express = require("express");
const cors = require("cors");

const { findCertificationsForProduct } = require("./certifications");
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const { fetchProductByBarcode } = require("./openFoodFacts");

const app = express();
app.use(cors());
// OCR metni bazen uzun olabilir: limit'i biraz yükseltiyoruz
app.use(express.json({ limit: "1mb" }));

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
 * ✅ OCR TEXT ANALYZE ENDPOINT (YENİ)
 * PWA OCR → labelText gönderir → decision döner.
 *
 * POST /analyze-label
 * body: {
 *   labelText: "...."   (zorunlu)
 *   barcode?: "..."     (opsiyonel)
 *   brand?: "..."       (opsiyonel)
 *   name?: "..."        (opsiyonel)
 * }
 */
app.post("/analyze-label", async (req, res) => {
  const evaluatedAt = new Date().toISOString();

  const labelText =
    typeof req.body?.labelText === "string" ? req.body.labelText : "";

  const barcode =
    typeof req.body?.barcode === "string" ? req.body.barcode.trim() : null;

  const inputBrand =
    typeof req.body?.brand === "string" ? req.body.brand.trim() : null;

  const inputName =
    typeof req.body?.name === "string" ? req.body.name.trim() : null;

  if (!labelText || labelText.trim().length < 3) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "labelText zorunludur (en az 3 karakter).",
      meta: { evaluatedAt }
    });
  }

  // Marka/ad opsiyonel: varsa sertifika eşleşmesi yaparız
  let resolvedBrand = inputBrand;
  let resolvedName = inputName;
  let offAvailable = false;

  // barcode varsa, boş alanları OFF'tan doldurmaya çalış (opsiyonel)
  if ((!resolvedBrand || !resolvedName) && barcode) {
    try {
      const offData = await fetchProductByBarcode(barcode);
      if (offData && offData.status === 1 && offData.product) {
        offAvailable = true;
        const p = offData.product;
        if (!resolvedName && p.product_name) resolvedName = p.product_name;
        if (!resolvedBrand && p.brands) {
          resolvedBrand = String(p.brands).split(",")[0].trim();
        }
      }
    } catch {
      // OFF yoksa sorun değil
    }
  }

  const certifications = resolvedBrand
    ? findCertificationsForProduct({
        brand: resolvedBrand,
        productName: resolvedName || "",
        productFamily: ""
      })
    : [];

  // OCR metnini labels alanı üzerinden analiz ediyoruz
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
  const normalizedBrand = product.brands
    ? product.brands.split(",")[0].trim()
    : null;

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
