// ===================================
// Gluten Analysis Engine – v2.5
// Status-free, multi-language, safety-first
// ===================================
const GENERIC_CONFIG = require("./config/gluten.genericIngredients.json");

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

// ❎ "GLUTEN YOK" BEYANLARI
const GLUTEN_NEGATION_PATTERNS = [
  /\bgluten[\s\-]free\b/,
  /\bno[\s\-]gluten\b/,
  /\bsenza\s+(frumento|glutine)\b/,
  /\bwithout\s+(wheat|gluten)\b/,
  /\bsans\s+(ble|gluten)\b/,
  /\bohne\s+(weizen|gluten)\b/
];

// 🌾 NET GLUTEN KAYNAKLARI (YULAF HARİÇ)
const DEFINITE_GLUTEN_PATTERNS = [
  /\bbugday\b/, /\barpa\b/, /\bcavdar\b/, /\birmik\b/, /\bbulgur\b/,
  /\bwheat\b/, /\bbarley\b/, /\brye\b/, /\bsemolina\b/,
  /\bweizen\b/, /\bgerste\b/, /\broggen\b/, /\bdinkel\b/,
  /\bble\b/, /\borge\b/, /\bseigle\b/, /\bsemoule\b/,
  /\bfrumento\b/, /\borzo\b/, /\bsegale\b/, /\bsemola\b/,
  /\bwheat flour\b/, /\bfarine de ble\b/, /\bweizenmehl\b/, /\bfarina di frumento\b/,
  /\bgluten\b/
];

// ⚠️ ETİKET KAYNAKLI ÇAPRAZ BULAŞ İFADELERİ
const CROSS_CONTAMINATION_PATTERNS = [
  /may contain[^.,;]{0,50}gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility[^.]*gluten/,
  /puo contenere[^.]*glutine/,
  /peut contenir[^.]*gluten/,
  /kann[^.]*gluten enthalten/
];

// 🌾 YULAF GÖSTERGELERİ (AYRI FLAG)
const OAT_PATTERNS = [
  /\boats?\b/,
  /\bavena\b/,
  /\bavena integrale\b/,
  /\baveia\b/
];

// ✅ POZİTİF BEYANLAR
const SAFE_TERMS = [
  "glutensiz", "gluten icermez", "glutensizdir",
  "gluten free", "free from gluten", "without gluten",
  "safe for celiac", "safe for coeliac",
  "suitable for celiac", "suitable for coeliac",
  "senza glutine", "sans gluten", "glutenfrei",
  "sin gluten", "sem gluten", "no gluten", "gluten-free"
];

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

function analyzeGluten(input = {}) {
  const {
    ingredients = "",
    productName = "",
    allergens = "",
    allergenTags = "",
    traces = "",
    labels = "",
    labelsTags = ""
  } = input;

  const pool = normalizeText(
    `${ingredients} ${productName} ${allergens} ${allergenTags} ${traces} ${labels} ${labelsTags}`
  );

  // ❌ GERÇEK VERİ YOK
  if (!pool) {
    return {
      containsGluten: false,
      hasCrossContaminationRisk: false,
      containsOats: false,
      manufacturerClaim: false,
      negativeClaim: false
    };
  }

  const negativeClaim = NEGATIVE_PATTERNS.some(p => p.test(pool));
  const manufacturerClaim = SAFE_TERMS.some(t => pool.includes(t));
  const hasGlutenNegation = GLUTEN_NEGATION_PATTERNS.some(p => p.test(pool));

  const containsGluten =
    !hasGlutenNegation &&
    DEFINITE_GLUTEN_PATTERNS.some(p => p.test(pool));

  // 🟡 Tek bileşenli / jenerik içerik kontrolü (CONFIG'TEN)
  const isGenericSingleIngredient =
    GENERIC_CONFIG.single_ingredient_terms.some(term => pool === term);

  // ⚠️ ÇAPRAZ BULAŞ — debug ile hangi pattern tetikleniyor görelim
  const matchedCrossPattern = CROSS_CONTAMINATION_PATTERNS.find(p => p.test(pool));
  const hasCrossContaminationRisk = !!matchedCrossPattern || isGenericSingleIngredient;

  // 🌾 YULAF — ayrı flag
  const containsOats = OAT_PATTERNS.some(p => p.test(pool));

  return {
    containsGluten,
    hasCrossContaminationRisk,
    containsOats,
    manufacturerClaim,
    negativeClaim,
    _debug: {
      matchedCrossPattern: matchedCrossPattern ? matchedCrossPattern.toString() : null,
      isGenericSingleIngredient
    }
  };
}

module.exports = { analyzeGluten };
