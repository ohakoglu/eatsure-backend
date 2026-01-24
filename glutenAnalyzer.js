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

// 4️⃣ POZİTİF (GÜVENLİ) BEYANLAR
const SAFE_TERMS = [
  // Türkçe
  "glutensiz",
  "gluten içermez",
  "glutensizdir",
  "çölyak hastaları için uygundur",
  "çölyaklara uygundur",

  // English – gluten free (etiket gerçekleri + yazım hataları)
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

// 5️⃣ DİĞER ALERJENLER (çölyak sonucunu ETKİLEMEZ)
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
      warnings: []
    };
  }

  const text = normalizeText(ingredientsRaw);

  // Diğer alerjenleri bilgi amaçlı topla
  const allergenWarnings = OTHER_ALLERGENS.filter(a => text.includes(a));

  // 1️⃣ AÇIK OLUMSUZLUK (en üst öncelik)
  if (NEGATIVE_PATTERNS.some(pattern => pattern.test(text))) {
    return {
      status: "unsafe",
      reason: "Üretici çölyak için güvenli olmadığını belirtmiş",
      warnings: allergenWarnings
    };
  }

  // 2️⃣ KESİN GLUTEN
  if (DEFINITE_GLUTEN.some(term => text.includes(term))) {
    return {
      status: "unsafe",
      reason: "Kesin gluten içeren bileşen bulundu",
      warnings: allergenWarnings
    };
  }

  // 3️⃣ GLUTENLE İLGİLİ ÇAPRAZ BULAŞ
  if (GLUTEN_RISK_PATTERNS.some(pattern => pattern.test(text))) {
    return {
      status: "risky",
      reason: "Etikette glutenle ilgili çapraz bulaş uyarısı var",
      warnings: allergenWarnings
    };
  }

  // 4️⃣ POZİTİF BEYAN
  if (SAFE_TERMS.some(term => text.includes(term))) {
    return {
      status: "safe",
      reason: "Etikette glutensiz / çölyak için uygun ibaresi var",
      warnings: allergenWarnings
    };
  }

  // 5️⃣ HİÇBİR ŞEY YOKSA
  return {
    status: "unknown",
    reason: "Gluten durumu net değil",
    warnings: allergenWarnings
  };
}

module.exports = { analyzeGluten };
