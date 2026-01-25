// ===================================
// Gluten Analysis Engine – FINAL
// Gluten-focused, allergy-aware, UX-safe
// ===================================

// 1️⃣ AÇIK OLUMSUZ BEYANLAR (sadece net "NOT" ifadeleri)
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
  "semolina"
];

// 3️⃣ SADECE GLUTENLE İLGİLİ ÇAPRAZ BULAŞ RİSKİ
const GLUTEN_RISK_PATTERNS = [
  /may contain.*gluten/,
  /may contain traces of gluten/,
  /traces of gluten/,
  /produced in a facility.*gluten/
];

// 4️⃣ POZİTİF (ÜRETİCİ) BEYANLAR
const SAFE_TERMS = [
  // Türkçe
  "glutensiz",
  "gluten içermez",
  "glutensizdir",
  "çölyak hastaları için uygundur",
  "çölyaklara uygundur",

  // English
  "gluten free",
  "gluten-free",
  "glutene free",
  "glutene-free",
  "free from gluten",
  "without gluten",

  // Gluten intolerance
  "gluten intolerance",
  "glutene intolerance",
  "for people with gluten intolerance",
  "for people with glutene intolerance",
  "designed for people with gluten intolerance",
  "designed for people with glutene intolerance",

  // Celiac-specific
  "safe for celiac",
  "safe for coeliac",
  "suitable for celiac",
  "suitable for coeliac",
  "for people with celiac disease",
  "for people with coeliac disease",
  "suitable for coeliacs"
];

// 5️⃣ DİĞER ALERJENLER (bilgi amaçlı)
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
// Yardımcı: normalize
// -------------------------------
function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------
// ANA ANALİZ
// -------------------------------
function analyzeGluten(ingredientsRaw = "") {
  if (!ingredientsRaw) {
    return {
      status: "unknown",
      reason: "İçerik bilgisi bulunamadı",
      warnings: [],
      claimsGlutenFree: false
    };
  }

  const text = normalizeText(ingredientsRaw);

  const allergenWarnings = OTHER_ALLERGENS.filter(a =>
    text.includes(a)
  );

  // 1️⃣ AÇIK OLUMSUZLUK
  if (NEGATIVE_PATTERNS.some(p => p.test(text))) {
    return {
      status: "unsafe",
      reason: "Üretici çölyak için güvenli olmadığını belirtmiş",
      warnings: allergenWarnings,
      claimsGlutenFree: false
    };
  }

  // 2️⃣ KESİN GLUTEN
  if (DEFINITE_GLUTEN.some(term => text.includes(term))) {
    return {
      status: "unsafe",
      reason: "Kesin gluten içeren bileşen bulundu",
      warnings: allergenWarnings,
      claimsGlutenFree: false
    };
  }

  // 3️⃣ GLUTEN ÇAPRAZ BULAŞ
  if (GLUTEN_RISK_PATTERNS.some(p => p.test(text))) {
    return {
      status: "risky",
      reason: "Etikette glutenle ilgili çapraz bulaş uyarısı var",
      warnings: allergenWarnings,
      claimsGlutenFree: false
    };
  }

  // 4️⃣ POZİTİF ÜRETİCİ BEYANI
  if (SAFE_TERMS.some(term => text.includes(term))) {
    return {
      status: "safe",
      reason: "Etikette glutensiz / çölyak için uygun ibaresi var",
      warnings: allergenWarnings,
      claimsGlutenFree: true
    };
  }

  // 5️⃣ HİÇBİR ŞEY YOKSA
  return {
    status: "unknown",
    reason: "Gluten durumu net değil",
    warnings: allergenWarnings,
    claimsGlutenFree: false
  };
}

module.exports = { analyzeGluten };
