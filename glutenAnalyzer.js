// ===================================
// Gluten Analysis Engine – FINAL v1.2
// Gluten-focused, allergy-aware, UX-safe
// ===================================

// 1️⃣ AÇIK OLUMSUZ BEYANLAR
const NEGATIVE_PATTERNS = [
  /\bnot safe for celiac\b/,
  /\bnot safe for coeliac\b/,
  /\bnot suitable for celiac\b/,
  /\bnot suitable for coeliac\b/,
  /\bnot suitable for coeliacs\b/,
  /\bnot for celiac\b/,
  /\bnot for coeliac\b/
];

// 2️⃣ KESİN GLUTEN KAYNAKLARI
const DEFINITE_GLUTEN = [
  "buğday",
  "arpa",
  "çavdar",
  "irmik",
  "bulgur",
  "wheat",
  "barley",
  "rye",
  "semolina",
  "frumento"
];

// 3️⃣ GLUTEN ÇAPRAZ BULAŞ RİSKİ
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/
];

// 4️⃣ POZİTİF (ÜRETİCİ) BEYANLAR – CANONICAL
const SAFE_TERMS = [
  "glutensiz",
  "gluten icermez",
  "glutensizdir",
  "gluten free",
  "free from gluten",
  "without gluten",
  "gluten intolerance",
  "for people with gluten intolerance",
  "designed for people with gluten intolerance",
  "safe for celiac",
  "safe for coeliac",
  "suitable for celiac",
  "suitable for coeliac",
  "suitable for coeliacs",
  "senza glutine",
  "sin gluten",
  "sem gluten"
];

// 5️⃣ DİĞER ALERJENLER
const OTHER_ALLERGENS = [
  "soy",
  "soya",
  "milk",
  "süt",
  "dairy",
  "nuts",
  "fındık",
  "egg",
  "yumurta",
  "sesame",
  "susam"
];

// -------------------------------
// NORMALIZATION (KRİTİK KISIM)
// -------------------------------
function normalizeText(text = "") {
  return text
    .toLowerCase()
    // aksanları temizle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // sık görülen spelling varyasyonları
    .replace(/glutene/g, "gluten")
    .replace(/glúten/g, "gluten")
    .replace(/gluten[e]?\s*intolerance/g, "gluten intolerance")
    // whitespace temizliği
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------
// ANA ANALİZ
// -------------------------------
function analyzeGluten(input = {}) {
  // Geriye uyumluluk
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

  // 1️⃣ AÇIK OLUMSUZLUK
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
  if (DEFINITE_GLUTEN.some(term => ingredientsText.includes(term))) {
    return {
      status: "unsafe",
      reason: "Kesin gluten içeren bileşen bulundu",
      warnings: allergenWarnings,
      claimsGlutenFree: false,
      containsGluten: true,
      hasCrossContaminationRisk: false
    };
  }

  // 3️⃣ GLUTEN ÇAPRAZ BULAŞ
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

  // 4️⃣ POZİTİF ÜRETİCİ BEYANI (ÜRÜN ADI + İÇERİK)
  if (SAFE_TERMS.some(term => combinedText.includes(term))) {
    return {
      status: "safe",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir",
      warnings: allergenWarnings,
      claimsGlutenFree: true,
      containsGluten: false,
      hasCrossContaminationRisk: false
    };
  }

  // 5️⃣ HİÇBİR ŞEY YOK
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
