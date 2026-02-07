// ===================================
// Decision Engine v4.2 – FINAL
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
    manufacturerClaim = false,
    negativeClaim = false
  } = ingredientAnalysis || {};

  const crossNote = hasCrossContaminationRisk
    ? " Çapraz bulaş riski olabilir."
    : "";

  // ⛔ AÇIK RED
  if (negativeClaim) {
    return {
      level: "gluten_present",
      reason:
        "Üretici ürünün çölyak için güvenli olmadığını açıkça belirtmiştir.",
      sources: ["manufacturer"]
    };
  }

  // 🟩 SEVİYE 1
  if (activeCerts.length > 0) {
    return {
      level: "certified",
      reason:
        "Ürün en az bir geçerli glutensiz sertifikasına sahiptir." + crossNote,
      sources: activeCerts.map(c => c.certifier)
    };
  }

  // ❌ Sertifika iptal
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      level: "certification_suspended",
      reason:
        "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier)
    };
  }

  // 🟧 SEVİYE 6
  if (manufacturerClaim && containsGluten) {
    return {
      level: "declaration_conflict",
      reason:
        "Üretici glutensiz beyanında bulunmuştur ancak içerik gluten içermektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  // 🔴 SEVİYE 7
  if (!manufacturerClaim && containsGluten) {
    return {
      level: "gluten_present",
      reason: "Ürün içeriğinde gluten veya gluten kaynağı bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  // 🟩 SEVİYE 2
  if (manufacturerClaim && !containsGluten) {
    return {
      level: "declared_gf_with_ingredients",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir.",
      sources: ["manufacturer"]
    };
  }

  // 🟨 SEVİYE 4
  if (!manufacturerClaim && !containsGluten && ingredientAnalysis) {
    return {
      level: "ingredients_safe_no_claim",
      reason:
        "İçerik gluten kaynağı içermemektedir ancak glutensiz beyan veya sertifika yoktur." +
        crossNote,
      sources: ["ingredients"]
    };
  }

  // ⚪️ SEVİYE 5
  return {
    level: "insufficient_data",
    reason:
      "Ürün hakkında yeterli içerik, sertifika veya üretici beyanı bilgisi bulunmamaktadır.",
    sources: []
  };
}

module.exports = { decideGlutenStatus };
