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
  }

  // ❗ KURALINA UYGUN: ingredientAnalysis = null
  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: null
  });

  res.json({
    barcode: "TEST-ONLY",
    name: testProduct.productName,
    brand: testProduct.brand,
    ingredients: null,
    analysis: {
      test_mode: true
    },
    decision,
    meta: {
      evaluatedAt,
      test_endpoint: true
    }
  });
});

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

  // 🔹 Sertifikasyon (HER ZAMAN)
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productName: productName,
    productFamily: product.categories || ""
  });

  // 🔑 KRİTİK: TÜM OFF ALANLARI ANALYZER’A GİDER
  let analysis = null;
  if (
    product.ingredients_text ||
    product.product_name ||
    product.allergens ||
    product.allergens_tags ||
    product.traces
  ) {
    analysis = analyzeGluten({
      ingredients: product.ingredients_text || "",
      productName: product.product_name || "",
      allergens: product.allergens || "",
      allergenTags: (product.allergens_tags || []).join(" "),
      traces: product.traces || "",
      labels: product.labels || "",
      labelsTags: (product.labels_tags || []).join(" ")
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
