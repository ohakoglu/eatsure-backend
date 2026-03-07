const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const { findCertificationsForProduct } = require("./certifications");
const { analyzeGluten } = require("./glutenAnalyzer");
const { decideGlutenStatus } = require("./decisionEngine");
const { fetchProductByBarcode } = require("./openFoodFacts");

const app = express();
app.use(cors());
// Görsel base64 payload için limit yükseltildi
app.use(express.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
 * ✅ Basit JSON parse helper
 * - markdown code fence varsa temizler
 */
function parseJsonFromModelText(text) {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * ✅ String listeleri tek metne dönüştür
 */
function joinList(value) {
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "string") return value.trim();
  return "";
}

/**
 * ✅ OpenAI extraction sonucunu normalize et
 */
function normalizeVisionExtraction(raw) {
  const data = raw && typeof raw === "object" ? raw : {};

  const barcode =
    typeof data.barcode === "string" && data.barcode.trim()
      ? data.barcode.trim()
      : null;

  const brand =
    typeof data.brand === "string" && data.brand.trim()
      ? data.brand.trim()
      : null;

  const productName =
    typeof data.product_name === "string" && data.product_name.trim()
      ? data.product_name.trim()
      : typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : null;

  const ingredients = joinList(data.ingredients);
  const allergens = joinList(data.allergens);
  const claims = joinList(data.claims);
  const logos = joinList(data.logos);
  const warnings = joinList(data.warnings);
  const generalText = joinList(data.general_text);

  return {
    barcode,
    brand,
    product_name: productName,
    ingredients,
    allergens,
    claims,
    logos,
    warnings,
    general_text: generalText
  };
}

/**
 * ✅ Vision extraction'dan analyzer input üret
 */
function buildAnalyzerInputFromVision(data) {
  const labelsText = [
    data.claims,
    data.logos,
    data.general_text
  ]
    .filter(Boolean)
    .join("\n");

  // warnings alanını traces'e bağlıyoruz:
  // "eser miktarda", "aynı hatta üretilmiştir", vb. burada gelebilir.
  return {
    ingredients: data.ingredients || "",
    productName: data.product_name || "",
    allergens: data.allergens || "",
    allergenTags: "",
    traces: data.warnings || "",
    labels: labelsText,
    labelsTags: ""
  };
}

/**
 * ✅ Vision extraction için prompt
 */
function buildVisionPrompt() {
  return [
    "Sen bir gıda etiketi alan çıkarma motorusun.",
    "Görselde gördüğün etiket bilgisini TÜMÜYLE uydurmadan çıkar.",
    "Sadece aşağıdaki JSON formatında cevap ver.",
    "JSON dışında hiçbir açıklama yazma.",
    "",
    "{",
    '  "barcode": "string | null",',
    '  "brand": "string | null",',
    '  "product_name": "string | null",',
    '  "ingredients": ["string", "..."],',
    '  "allergens": ["string", "..."],',
    '  "claims": ["string", "..."],',
    '  "logos": ["string", "..."],',
    '  "warnings": ["string", "..."],',
    '  "general_text": ["string", "..."]',
    "}",
    "",
    "Kurallar:",
    "- Barkodu yalnız net görüyorsan yaz; emin değilsen null.",
    "- Brand için marka adını yaz.",
    "- product_name için ürün adını yaz.",
    "- ingredients alanına yalnız içindekiler bölümünü yaz.",
    "- allergens alanına yalnız alerjen/contains/may contain/iz/eser miktarda bölümlerini yaz.",
    "- claims alanına 'glutensiz', 'gluten free', 'glutenfrei', 'sans gluten' gibi iddiaları yaz.",
    "- logos alanına GFCO, crossed grain, gluten free logo gibi metin/amblemleri yaz.",
    "- warnings alanına çapraz bulaş, aynı hatta üretim, eser miktarda vb. uyarıları yaz.",
    "- general_text alanına karar vermede işe yarayabilecek diğer kısa metinleri yaz.",
    "- Hiçbir alanı uydurma. Emin değilsen boş liste veya null kullan."
  ].join("\n");
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

  let resolvedBrand = inputBrand;
  let resolvedName = inputName;
  let offAvailable = false;

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
 * ✅ IMAGE ANALYZE ENDPOINT (YENİ)
 * Fotoğrafı OpenAI Vision ile alanlara ayırır,
 * sonra decisionEngine çalıştırır.
 *
 * POST /analyze-image
 * body: {
 *   imageBase64: "...."  (zorunlu, raw base64)
 *   mimeType?: "image/jpeg" | "image/png"
 *   barcode?: "..."      (opsiyonel, barkod ayrıca geldiyse)
 * }
 */
app.post("/analyze-image", async (req, res) => {
  const evaluatedAt = new Date().toISOString();

  if (!openai) {
    return res.status(500).json({
      error: "OPENAI_NOT_CONFIGURED",
      message: "OPENAI_API_KEY environment variable tanımlı değil.",
      meta: { evaluatedAt }
    });
  }

  const imageBase64 =
    typeof req.body?.imageBase64 === "string" ? req.body.imageBase64.trim() : "";

  const mimeType =
    typeof req.body?.mimeType === "string" && req.body.mimeType.trim()
      ? req.body.mimeType.trim()
      : "image/jpeg";

  const inputBarcode =
    typeof req.body?.barcode === "string" && req.body.barcode.trim()
      ? req.body.barcode.trim()
      : null;

  if (!imageBase64 || imageBase64.length < 100) {
    return res.status(400).json({
      error: "INVALID_INPUT",
      message: "imageBase64 zorunludur.",
      meta: { evaluatedAt }
    });
  }

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionPrompt()
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`
            }
          ]
        }
      ]
    });

    const rawText = response.output_text || "";
    const parsed = parseJsonFromModelText(rawText);

    if (!parsed) {
      return res.status(502).json({
        error: "VISION_PARSE_FAILED",
        message: "OpenAI çıktısı JSON olarak parse edilemedi.",
        raw: rawText,
        meta: {
          evaluatedAt,
          model: OPENAI_MODEL
        }
      });
    }

    const extracted = normalizeVisionExtraction(parsed);

    // Barkod ayrıca geldiyse ve model boş bıraktıysa onu kullan
    if (!extracted.barcode && inputBarcode) {
      extracted.barcode = inputBarcode;
    }

    let offAvailable = false;
    let offName = null;
    let offBrand = null;

    if (extracted.barcode && (!extracted.product_name || !extracted.brand)) {
      try {
        const offData = await fetchProductByBarcode(extracted.barcode);
        if (offData && offData.status === 1 && offData.product) {
          offAvailable = true;
          const p = offData.product;
          if (p.product_name) offName = p.product_name;
          if (p.brands) offBrand = String(p.brands).split(",")[0].trim();
        }
      } catch {
        // OFF başarısızsa extraction ile devam
      }
    }

    const resolvedName = extracted.product_name || offName || null;
    const resolvedBrand = extracted.brand || offBrand || null;

    const certifications = resolvedBrand
      ? findCertificationsForProduct({
          brand: resolvedBrand,
          productName: resolvedName || "",
          productFamily: ""
        })
      : [];

    const analyzerInput = buildAnalyzerInputFromVision({
      ...extracted,
      product_name: resolvedName
    });

    const analysis = analyzeGluten(analyzerInput);

    const decision = decideGlutenStatus({
      certifications,
      ingredientAnalysis: analysis
    });

    return res.json({
      barcode: extracted.barcode || null,
      name: resolvedName,
      brand: resolvedBrand,
      extracted: {
        ingredients: extracted.ingredients || null,
        allergens: extracted.allergens || null,
        claims: extracted.claims || null,
        logos: extracted.logos || null,
        warnings: extracted.warnings || null,
        general_text: extracted.general_text || null
      },
      analysis,
      decision,
      meta: {
        evaluatedAt,
        source: "openai_vision",
        model: OPENAI_MODEL,
        openFoodFactsUsedForPrefill: offAvailable
      }
    });
  } catch (err) {
    return res.status(502).json({
      error: "OPENAI_VISION_FAILED",
      message: err?.message || "OpenAI vision request failed.",
      meta: {
        evaluatedAt,
        model: OPENAI_MODEL
      }
    });
  }
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
