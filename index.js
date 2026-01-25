const express = require("express");
const cors = require("cors");
const { findCertificationsForProduct } = require("./certifications");
const openFoodFacts = require("./openFoodFacts");
const fetchProductByBarcode = openFoodFacts.fetchProductByBarcode;
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/scan/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;

    const data = await fetchProductByBarcode(barcode);

    if (data.status !== 1) {
      return res.json({
        barcode,
        status: "unknown",
        message: "Ürün veritabanında bulunamadı",
      });
    }

    const product = data.product;
    const express = require("express");
const cors = require("cors");
const { findCertificationsForProduct } = require("./certifications");
const { fetchProductByBarcode } = require("./openFoodFacts");
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/scan/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;

    const data = await fetchProductByBarcode(barcode);

    if (data.status !== 1) {
      return res.json({
        barcode,
        status: "unknown",
        message: "Ürün veritabanında bulunamadı",
      });
    }

    const product = data.product;
    const analysis = analyzeGluten(product.ingredients_text);
const certifications = findCertificationsForProduct({
  brand: product.brands,
  productFamily: product.categories || ""
});

const decision = decideGlutenStatus({
  certifications,
  ingredientAnalysis: analysis,
  manufacturerClaim: analysis.claimsGlutenFree === true
});
    
    res.json({
      barcode,
      name: product.product_name || "İsimsiz Ürün",
      brand: product.brands || "Bilinmiyor",
      ingredients: product.ingredients_text || null,
      analysis,
      decision
    });
  } catch (error) {
    res.status(500).json({
      error: "Sunucu hatası",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API çalışıyor`);
});const analysis = analyzeGluten(product.ingredients_text);


    const normalizedBrand = product.brands
  ? product.brands.split(",")[0].trim()
  : null;

const certifications = findCertificationsForProduct({
  brand: normalizedBrand,
  productFamily: product.categories || ""
});
    
const decision = decideGlutenStatus({
  certifications,
  ingredientAnalysis: analysis,
  manufacturerClaim: analysis.claimsGlutenFree === true
});
    
    res.json({
      barcode,
      name: product.product_name || "İsimsiz Ürün",
      brand: product.brands || "Bilinmiyor",
      ingredients: product.ingredients_text || null,
      analysis,
      decision
    });
  } catch (error) {
    res.status(500).json({
      error: "Sunucu hatası",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API çalışıyor`);
});
