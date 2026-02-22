// ===================================
// Decision Engine v4.3
// Status-less, 7-level deterministic model
// ===================================
function decideGlutenStatus({
  certifications = [],
  ingredientAnalysis
}) {
  const activeCerts = certifications.filter(c => c.status === "active");
  const suspendedCerts = certifications.filter(
    c => c.status === "suspended" || c.status === "revoked"
  );

  const {
    containsGluten = false,
    hasCrossContaminationRisk = false,
    containsOats = false,
    manufacturerClaim = false,
    negativeClaim = false
  } = ingredientAnalysis || {};

  // ⛔ AÇIK RED
  if (negativeClaim) {
    return {
      level: "gluten_present",
      reason: "Üretici ürünün çölyak için güvenli olmadığını açıkça belirtmiştir.",
      sources: ["manufacturer"],
      warnings: []
    };
  }

  // 🟩 SEVİYE 1
  if (activeCerts.length > 0) {
    const warnings = hasCrossContaminationRisk ? ["label_conflict"] : [];
    return {
      level: "certified",
      reason: "Ürün en az bir geçerli glutensiz sertifikasına sahiptir.",
      sources: activeCerts.map(c => c.certifier),
      warnings
    };
  }

  // ❌ Sertifika iptal
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      level: "certification_suspended",
      reason: "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier),
      warnings: []
    };
  }

  // 🟧 SEVİYE 6 — İçerik gluteni
  if (manufacturerClaim && containsGluten) {
    return {
      level: "declaration_conflict",
      reason: "Üretici glutensiz beyanında bulunmuştur ancak içerik gluten içermektedir.",
      sources: ["manufacturer", "ingredients"],
      warnings: []
    };
  }

  // 🟧 SEVİYE 6 — Etiket çapraz bulaş çelişkisi
  if (manufacturerClaim && hasCrossContaminationRisk) {
    return {
      level: "declaration_conflict",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir ancak etikette çapraz bulaş riski belirtilmektedir.",
      sources: ["manufacturer", "label"],
      warnings: []
    };
  }

  // 🔴 SEVİYE 7
  if (!manufacturerClaim && containsGluten) {
    return {
      level: "gluten_present",
      reason: "Ürün içeriğinde gluten veya gluten kaynağı bulunmaktadır.",
      sources: ["ingredients"],
      warnings: []
    };
  }

  // 🟩 SEVİYE 2
  if (manufacturerClaim && !containsGluten) {
    return {
      level: "declared_gf_with_ingredients",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir.",
      sources: ["manufacturer"],
      warnings: []
    };
  }

  // 🟨 SEVİYE 4
  if (!manufacturerClaim && !containsGluten && ingredientAnalysis) {
    const warnings = hasCrossContaminationRisk ? ["cross_contamination"] : [];
    return {
      level: "ingredients_safe_no_claim",
      reason: "İçerik gluten kaynağı içermemektedir ancak glutensiz beyan veya sertifika yoktur.",
      sources: ["ingredients"],
      warnings
    };
  }

  // ⚪️ SEVİYE 5
  return {
    level: "insufficient_data",
    reason: "Ürün hakkında yeterli içerik, sertifika veya üretici beyanı bilgisi bulunmamaktadır.",
    sources: [],
    warnings: []
  };
}

module.exports = { decideGlutenStatus };
