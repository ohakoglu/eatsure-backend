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

app.get("/scan/:barcode", async (req, res) => {
  const { barcode } = req.params;

  let offData;
  let offUnavailable = false;

  try {
    offData = await fetchProductByBarcode(barcode);

    // OFF erişilemedi ama bu BİR HATA DEĞİL
    if (offData.status !== 1) {
      offUnavailable = true;
    }
  } catch {
    offUnavailable = true;
  }

  let product = null;

  if (!offUnavailable) {
    product = offData.product;
  }

  // 🔹 Marka bilgisi (OFF yoksa OFF’tan, yoksa null)
  const normalizedBrand = product?.brands
    ? product.brands.split(",")[0].trim()
    : null;

  // 🔹 Sertifikasyon HER ZAMAN çalışır
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productFamily: product?.categories || ""
  });

  // 🔹 İçerik analizi SADECE OFF varsa yapılır
  const analysis = product?.ingredients_text
    ? analyzeGluten({
        ingredients: product.ingredients_text,
        productName: product.product_name || ""
      })
    : null;

  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: analysis,
    manufacturerClaim: analysis?.claimsGlutenFree === true
  });

  // ❌ Ne OFF var ne sertifika → gerçek bilinmezlik
  if (offUnavailable && certifications.length === 0) {
    return res.json({
      barcode,
      name: "Bilinmiyor",
      brand: normalizedBrand || "Bilinmiyor",
      ingredients: null,
      analysis: null,
      decision: {
        status: "unknown",
        level: "insufficient_data",
        reason:
          "Ürün veritabanında bulunamadı ve sertifikasyon bilgisi mevcut değil.",
        sources: []
      }
    });
  }

  // ✅ NORMAL / PARTIAL CEVAP
  res.json({
    barcode,
    name: product?.product_name || "Bilinmiyor",
    brand: normalizedBrand || "Bilinmiyor",
    ingredients: product?.ingredients_text || null,
    analysis,
    decision,
    meta: {
      openFoodFactsAvailable: !offUnavailable
    }
  });
});

app.listen(PORT, () => {
  console.log("API çalışıyor");
});
