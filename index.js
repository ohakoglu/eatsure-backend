const express = require("express");
const cors = require("cors");

const { fetchProductByBarcode } = require("./openFoodFacts");
const { analyzeGluten } = require("./glutenAnalyzer");

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

    res.json({
      barcode,
      name: product.product_name || "İsimsiz Ürün",
      brand: product.brands || "Bilinmiyor",
      ingredients: product.ingredients_text || null,
      analysis,
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
