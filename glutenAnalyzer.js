// ===================================
// Gluten Analysis Engine – FINAL v2.3
// Status-free, multi-language, safety-first
// ===================================

// ❌ AÇIK OLUMSUZ BEYANLAR
const NEGATIVE_PATTERNS = [
  /\bnot safe for celiac\b/,
  /\bnot safe for coeliac\b/,
  /\bnot suitable for celiac\b/,
  /\bnot suitable for coeliac\b/,
  /\bnot suitable for coeliacs\b/,
  /\bnot for celiac\b/,
  /\bnot for coeliac\b/,
  /\bnon adatto ai celiaci\b/,
  /\bpas adapte aux celi[aâ]ques\b/,
  /\bnicht fur zoliakie\b/
];

// ❎ “GLUTEN YOK” BEYANLARI
const GLUTEN_NEGATION_PATTERNS = [
  /\bsenza\s+(frumento|glutine)\b/,
  /\bwithout\s+(wheat|gluten)\b/,
  /\bsans\s+(ble|gluten)\b/,
  /\bohne\s+(weizen|gluten)\b/
];

// 🌾 NET GLUTEN KAYNAKLARI (YULAF YOK)
const DEFINITE_GLUTEN_PATTERNS = [
  /\bbugday\b/, /\barpa\b/, /\bcavdar\b/, /\birmik\b/, /\bbulgur\b/,
  /\bwheat\b/, /\bbarley\b/, /\brye\b/, /\bsemolina\b/,
  /\bweizen\b/, /\bgerste\b/, /\broggen\b/, /\bdinkel\b/,
  /\bble\b/, /\borge\b/, /\bseigle\b/, /\bsemoule\b/,
  /\bfrumento\b/, /\borzo\b/, /\bsegale\b/, /\bsemola\b/,
  /\bwheat flour\b/, /\bfarine de ble\b/, /\bweizenmehl\b/, /\bfarina di frumento\b/
];

// ⚠️ RİSK GÖSTERGELERİ (SADECE BİLGİ AMAÇLI)
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/,
  /puo contenere.*glutine/,
  /peut contenir.*gluten/,
  /kann.*gluten enthalten/,
  /\boats?\b/,
  /\bavena\b/,
  /\bavena integrale\b/
];

// ✅ POZİTİF BEYANLAR
const SAFE_TERMS = [
  "glutensiz", "gluten icermez", "glutensizdir",
  "gluten free", "free from gluten", "without gluten",
  "safe for celiac", "safe for coeliac",
  "suitable for celiac", "suitable for coeliac",
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
// ANA ANALİZ (SADECE GERÇEKLER)
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

  const manufacturerClaim =
    SAFE_TERMS.some(term => pool.includes(term));

  const hasGlutenNegation =
    GLUTEN_NEGATION_PATTERNS.some(p => p.test(pool));

  // ❗ KRİTİK DÜZELTME
  // Beyan varsa + gluten yok deniyorsa → yulaf vs. gluten sayılmaz
  const containsGluten =
    !hasGlutenNegation &&
    DEFINITE_GLUTEN_PATTERNS.some(p => p.test(pool));

  // Çapraz bulaş sadece bilgi amaçlı
  const hasCrossContaminationRisk =
    !manufacturerClaim &&
    GLUTEN_RISK_PATTERNS.some(p => p.test(pool));

  return {
    containsGluten,
    hasCrossContaminationRisk,
    manufacturerClaim,
    negativeClaim
  };
}

module.exports = { analyzeGluten };
