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
 * 🧪 OFF-TEST
 */
app.get("/off-test/:barcode", async (req, res) => {
  const { barcode } = req.params;

  try {
    const offData = await fetchProductByBarcode(barcode);

    if (offData.status !== 1) {
      return res.json({
        barcode,
        offStatus: offData.status,
        message: "OpenFoodFacts ürünü bulamadı",
        raw: offData
      });
    }

    const product = offData.product || {};

    return res.json({
      barcode,
      offStatus: offData.status,
      product: {
        name: product.product_name || null,
        brand: product.brands || null,
        ingredients: product.ingredients_text || null,
        categories: product.categories || null
      }
    });
  } catch (error) {
    return res.json({
      barcode,
      offStatus: "error",
      message: "OpenFoodFacts çağrısı başarısız",
      error: error.message
    });
  }
});

/**
 * 🧠 BİLİNEN GLUTENLİ ÜRÜNLER (LOCAL FALLBACK)
 */
const KNOWN_GLUTEN_BARCODES = {
  "8690570042017": {
    name: "Buğday Unu",
    brand: "Söke"
  },
  "8690105000017": {
    name: "Spaghetti",
    brand: "Barilla"
  }
};

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

  // 🔹 Sertifikasyon HER ZAMAN çalışır
  const certifications = findCertificationsForProduct({
    brand: normalizedBrand,
    productFamily: product.categories || ""
  });

  /**
   * 🔑 İçerik YOKSA bile ürün adı üzerinden analiz
   */
  let analysis = null;

  if (product.ingredients_text || productName) {
    analysis = analyzeGluten({
      ingredients: product.ingredients_text || "",
      productName: productName || ""
    });
  }

  /**
   * 🔥 GERÇEK BİLİNMEZLİK
   * SADECE: OFF YOK + sertifika YOK
   */
  if (!offAvailable && certifications.length === 0) {
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
          reason:
            "Bu ürün bilinen gluten içeren ürünler listesinde yer almaktadır.",
          sources: ["local_fallback"]
        },
        meta: {
          evaluatedAt
        }
      });
    }

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
      },
      meta: {
        evaluatedAt
      }
    });
  }

  // 🔹 Karar motoru
  const decision = decideGlutenStatus({
    certifications,
    ingredientAnalysis: analysis,
    manufacturerClaim: analysis?.claimsGlutenFree === true
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
