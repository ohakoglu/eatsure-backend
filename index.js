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
 * 🧠 BİLİNEN GLUTENLİ ÜRÜNLER (LOCAL FALLBACK)
 * OFF yoksa ama bu barkodlardan biriyse → UNSAFE
 */
const KNOWN_GLUTEN_BARCODES = {
  // Buğday unu – Türkiye
  "8690570042017": {
    name: "Buğday Unu",
    brand: "Söke"
  },
  // Makarna (wheat)
  "8690105000017": {
    name: "Spaghetti",
    brand: "Barilla"
  }
};

app.get("/scan/:barcode", async (req, res) => {
  const { barcode } = req.params;

  let offData;
  let offUnavailable = false;

  try {
    offData = await fetchProductByBarcode(barcode);

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

  // 🔹 Marka (OFF varsa al, yoksa null)
  const normalizedBrand = product?.brands
    ? product.brands.split(",")[0].trim()
    : null;

  // 🔹 Sertifikasyon HER ZAMAN çalışır
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productFamily: product?.categories || ""
  });

  // 🔹 İçerik analizi SADECE OFF varsa
  const analysis = product?.ingredients_text
    ? analyzeGluten({
        ingredients: product.ingredients_text,
        productName: product.product_name || ""
      })
    : null;

  // 🔥 1️⃣ BİLİNEN GLUTEN FALLBACK
  if (offUnavailable && certifications.length === 0) {
    const known = KNOWN_GLUTEN_BARCODES[barcode];

    if (known) {
      return res.json({
        barcode,
        name: known.name,
        brand: known.brand,
        ingredients: null,
        analysis: {
          status: "unsafe",
          reason: "Bilinen gluten içeren üründür",
          claimsGlutenFree: false
        },
        decision: {
          status: "unsafe",
          level: "known_gluten_product",
          reason: "Bu ürün bilinen gluten içeren ürünler listesinde yer almaktadır.",
          sources: ["local_fallback"]
        }
      });
    }

    // ❓ GERÇEK BİLİNMEZLİK
    return res.json({
      barcode,
      name: "Bilinmiyor",
      brand: "Bilinmiyor",
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

  // 🔹 Normal karar motoru
  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: analysis,
    manufacturerClaim: analysis?.claimsGlutenFree === true
  });

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
