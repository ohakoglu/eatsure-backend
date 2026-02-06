// ===================================
// Gluten Analysis Engine – FINAL v2.0
// Status-free, multi-language, safety-first
// ===================================

// ❌ AÇIK OLUMSUZ BEYANLAR (HER ZAMAN ÖNCELİKLİ)
const NEGATIVE_PATTERNS = [
  /\bnot safe for celiac\b/,
  /\bnot safe for coeliac\b/,
  /\bnot suitable for celiac\b/,
  /\bnot suitable for coeliac\b/,
  /\bnot suitable for coeliacs\b/,
  /\bnot for celiac\b/,
  /\bnot for coeliac\b/,
  /\bnon adatto ai celiaci\b/,        // IT
  /\bpas adapte aux celi[aâ]ques\b/,  // FR
  /\bnicht fur zoliakie\b/             // DE
];

// 🌾 KESİN GLUTEN KAYNAKLARI (MULTI-LANGUAGE)
const DEFINITE_GLUTEN = [
  // TR
  "bugday", "arpa", "cavdar", "irmik", "bulgur",
  // EN
  "wheat", "barley", "rye", "semolina",
  // DE
  "weizen", "gerste", "roggen", "dinkel",
  // FR
  "ble", "orge", "seigle", "semoule",
  // IT
  "frumento", "orzo", "segale", "semola",
  // Türevler
  "wheat flour", "farine de ble", "weizenmehl", "farina di frumento"
];

// ⚠️ ÇAPRAZ BULAŞ UYARILARI
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/,
  /puo contenere.*glutine/,
  /peut contenir.*gluten/,
  /kann.*gluten enthalten/
];

// ✅ POZİTİF (ÜRETİCİ) BEYANLARI
const SAFE_TERMS = [
  // TR
  "glutensiz", "gluten icermez", "glutensizdir",
  // EN
  "gluten free", "free from gluten", "without gluten",
  "safe for celiac", "safe for coeliac",
  "suitable for celiac", "suitable for coeliac",
  // IT / FR / DE / ES
  "senza glutine", "sans gluten", "glutenfrei",
  "sin gluten", "sem gluten"
];

// -------------------------------
// NORMALIZATION
// -------------------------------
function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/glutene|glúten/g, "gluten")
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------
// ANA ANALİZ (SADECE BOOLEAN GERÇEKLER)
// -------------------------------
function analyzeGluten(input = {}) {
  if (typeof input === "string") {
    input = { ingredients: input };
  }

  const {
    ingredients = "",
    productName = "",
    allergens = "",
    allergenTags = "",
    traces = ""
  } = input;

  const pool = normalizeText(
    `${ingredients} ${productName} ${allergens} ${allergenTags} ${traces}`
  );

  if (!pool) {
    return {
      containsGluten: false,
      hasCrossContaminationRisk: false,
      manufacturerClaim: false,
      negativeClaim: false
    };
  }

  const negativeClaim =
    NEGATIVE_PATTERNS.some(p => p.test(pool));

  const containsGluten =
    DEFINITE_GLUTEN.some(term => pool.includes(term));

  const hasCrossContaminationRisk =
    GLUTEN_RISK_PATTERNS.some(p => p.test(pool));

  const manufacturerClaim =
    SAFE_TERMS.some(term => pool.includes(term));

  return {
    containsGluten,
    hasCrossContaminationRisk,
    manufacturerClaim,
    negativeClaim
  };
}

module.exports = { analyzeGluten };
