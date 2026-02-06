// ===================================
// Gluten Analysis Engine – FINAL v1.3
// Multi-language, safety-first, UX-safe
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
  /\bnon adatto ai celiaci\b/,        // IT
  /\bpas adapte aux celi[aâ]ques\b/,  // FR
  /\bnicht fur zoliakie\b/             // DE
];

// 2️⃣ KESİN GLUTEN KAYNAKLARI (MULTI-LANGUAGE)
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
  // COMMON / DERIVATIVES
  "wheat flour", "ble farine", "farine de ble",
  "weizenmehl", "farina di frumento"
];

// 3️⃣ GLUTEN ÇAPRAZ BULAŞ
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/,
  /puo contenere.*glutine/,        // IT
  /peut contenir.*gluten/,         // FR
  /kann.*gluten enthalten/         // DE
];

// 4️⃣ POZİTİF (ÜRETİCİ) BEYANLAR
const SAFE_TERMS = [
  // TR
  "glutensiz", "gluten icermez", "glutensizdir",
  // EN
  "gluten free", "free from gluten", "without gluten",
  "for people with gluten intolerance",
  "designed for people with gluten intolerance",
  "safe for celiac", "safe for coeliac",
  "suitable for celiac", "suitable for coeliac",
  // IT
  "senza glutine",
  // ES / PT
  "sin gluten", "sem gluten",
  // FR
  "sans gluten",
  // DE
  "glutenfrei"
];

// 5️⃣ DİĞER ALERJENLER (BİLGİ AMAÇLI)
const OTHER_ALLERGENS = [
  "soy", "soya",
  "milk", "sut", "lait", "milch",
  "egg", "oeuf", "ei", "uovo",
  "nuts", "findik", "noisette",
  "sesame", "susam"
];

// -------------------------------
// NORMALIZATION
// -------------------------------
function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/glutene/g, "gluten")
    .replace(/glúten/g, "gluten")
    .replace(/gluten[e]?\s*intolerance/g, "gluten intolerance")
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

  const ingredientsRaw = input.ingredients || "";
  const productNameRaw = input.productName || "";

  if (!ingredientsRaw && !productNameRaw) {
    return {
      status: "unknown",
      reason: "İçerik bilgisi bulunamadı",
      warnings: [],
      claimsGlutenFree: false,
      containsGluten: false,
      hasCrossContaminationRisk: false
    };
  }

  const ingredientsText = normalizeText(ingredientsRaw);
  const productNameText = normalizeText(productNameRaw);
  const combinedText = `${productNameText} ${ingredientsText}`;

  const allergenWarnings = OTHER_ALLERGENS.filter(a =>
    ingredientsText.includes(a)
  );

  // 1️⃣ AÇIK OLUMSUZLUK (KİLİT)
  if (NEGATIVE_PATTERNS.some(p => p.test(combinedText))) {
    return {
      status: "unsafe",
      reason: "Üretici çölyak için güvenli olmadığını belirtmiş",
      warnings: allergenWarnings,
      claimsGlutenFree: false,
      containsGluten: true,
      hasCrossContaminationRisk: false
    };
  }

  // 2️⃣ KESİN GLUTEN
  const containsDefiniteGluten =
    DEFINITE_GLUTEN.some(term => ingredientsText.includes(term));

  // 3️⃣ ÜRETİCİ BEYANI
  const hasManufacturerClaim =
    SAFE_TERMS.some(term => combinedText.includes(term));

  // ❗ GLUTEN VAR + GF BEYANI VAR → SEVİYE 6 İÇİN KRİTİK
  if (containsDefiniteGluten) {
    return {
      status: "unsafe",
      reason: "Kesin gluten içeren bileşen bulundu",
      warnings: allergenWarnings,
      claimsGlutenFree: hasManufacturerClaim,
      containsGluten: true,
      hasCrossContaminationRisk: false
    };
  }

  // 4️⃣ ÇAPRAZ BULAŞ
  if (GLUTEN_RISK_PATTERNS.some(p => p.test(ingredientsText))) {
    return {
      status: "risky",
      reason: "Etikette glutenle ilgili çapraz bulaş uyarısı var",
      warnings: allergenWarnings,
      claimsGlutenFree: false,
      containsGluten: false,
      hasCrossContaminationRisk: true
    };
  }

  // 5️⃣ POZİTİF BEYAN (GLUTEN YOK)
  if (hasManufacturerClaim) {
    return {
      status: "safe",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir",
      warnings: allergenWarnings,
      claimsGlutenFree: true,
      containsGluten: false,
      hasCrossContaminationRisk: false
    };
  }

  // 6️⃣ BELİRSİZ
  return {
    status: "unknown",
    reason: "Gluten durumu net değil",
    warnings: allergenWarnings,
    claimsGlutenFree: false,
    containsGluten: false,
    hasCrossContaminationRisk: false
  };
}

module.exports = { analyzeGluten };
