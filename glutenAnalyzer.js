// ===================================
// Gluten Analysis Engine – FINAL v1.4
// Multi-language, safety-first, OFF-aware
// ===================================

// 1️⃣ AÇIK OLUMSUZ BEYANLAR (HER ZAMAN ÖNCE)
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

// 2️⃣ KESİN GLUTEN KAYNAKLARI (MULTI-LANGUAGE)
const DEFINITE_GLUTEN = [
  "bugday", "arpa", "cavdar", "irmik", "bulgur",
  "wheat", "barley", "rye", "semolina",
  "weizen", "gerste", "roggen", "dinkel",
  "ble", "orge", "seigle", "semoule",
  "frumento", "orzo", "segale", "semola",
  "wheat flour", "farine de ble", "weizenmehl",
  "farina di frumento"
];

// 3️⃣ GLUTEN ÇAPRAZ BULAŞ
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/,
  /puo contenere.*glutine/,
  /peut contenir.*gluten/,
  /kann.*gluten enthalten/
];

// 4️⃣ POZİTİF (ÜRETİCİ) BEYANLAR
const SAFE_TERMS = [
  "glutensiz", "gluten icermez", "glutensizdir",
  "gluten free", "free from gluten", "without gluten",
  "safe for celiac", "safe for coeliac",
  "suitable for celiac", "suitable for coeliac",
  "senza glutine", "sin gluten", "sem gluten",
  "sans gluten", "glutenfrei"
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
// ANA ANALİZ
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
      status: "unknown",
      reason: "İçerik ve alerjen bilgisi bulunamadı",
      claimsGlutenFree: false,
      containsGluten: false,
      hasCrossContaminationRisk: false
    };
  }

  // 1️⃣ AÇIK OLUMSUZLUK
  if (NEGATIVE_PATTERNS.some(p => p.test(pool))) {
    return {
      status: "unsafe",
      reason: "Üretici çölyak için güvenli olmadığını belirtmiş",
      claimsGlutenFree: false,
      containsGluten: true,
      hasCrossContaminationRisk: false
    };
  }

  const containsDefiniteGluten =
    DEFINITE_GLUTEN.some(term => pool.includes(term));

  const hasManufacturerClaim =
    SAFE_TERMS.some(term => pool.includes(term));

  // ❗ GLUTEN VAR (BEYAN OLSA BİLE)
  if (containsDefiniteGluten) {
    return {
      status: "unsafe",
      reason: "Kesin gluten içeren bileşen bulundu",
      claimsGlutenFree: hasManufacturerClaim,
      containsGluten: true,
      hasCrossContaminationRisk: false
    };
  }

  // 3️⃣ ÇAPRAZ BULAŞ
  if (GLUTEN_RISK_PATTERNS.some(p => p.test(pool))) {
    return {
      status: "risky",
      reason: "Etikette glutenle ilgili çapraz bulaş uyarısı var",
      claimsGlutenFree: false,
      containsGluten: false,
      hasCrossContaminationRisk: true
    };
  }

  // 4️⃣ SADECE ÜRETİCİ BEYANI
  if (hasManufacturerClaim) {
    return {
      status: "safe",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir",
      claimsGlutenFree: true,
      containsGluten: false,
      hasCrossContaminationRisk: false
    };
  }

  return {
    status: "unknown",
    reason: "Gluten durumu net değil",
    claimsGlutenFree: false,
    containsGluten: false,
    hasCrossContaminationRisk: false
  };
}

module.exports = { analyzeGluten };
