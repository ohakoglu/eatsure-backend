const express = require("express");
const cors = require("cors");

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
 * 🧪 TEMP TEST ENDPOINT — SİLİNECEK
 * ÜRÜN BAZLI SERTİFİKA TESTİ
 *
 * Kullanım:
 * /test-cert/Test Gluten Free Cookies
 * /test-cert/Test Chocolate Bar
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
  const normalizedBrand = product.brands
    ? product.brands.split(",")[0].trim()
    : null;

  // tags/text alanlarını önce normalize edip sonra kullanalım (join crash riskini kaldırır)
  const categoriesTagsText = safeJoin(product.categories_tags);
  const allergensTagsText = safeJoin(product.allergens_tags);
  const tracesTagsText = safeJoin(product.traces_tags);
  const labelsTagsText = safeJoin(product.labels_tags);

  // 🔹 Sertifikasyon (HER ZAMAN)
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productName: productName,
    productFamily: categoriesTagsText || product.categories || ""
  });

  // 🔑 KRİTİK: TÜM OFF ALANLARI ANALYZER’A GİDER
  let analysis = null;

  const ingredientsText = product.ingredients_text || "";
  const productNameText = product.product_name || "";
  const allergensText = product.allergens || "";
  const tracesText = product.traces || "";
  const labelsText = product.labels || "";

  // labels/labels_tags dahil: içerik boş olsa bile GF beyanı yakalanabilsin
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
