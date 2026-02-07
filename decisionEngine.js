/**
 * Decision Engine v4.1 – FINAL
 * Status-less, 7-level deterministic model
 * Cross-contamination is informational, not level-changing
 */

function decideGlutenStatus({
  certifications = [],
  ingredientAnalysis
}) {
  const activeCerts = certifications.filter(c => c.status === "active");
  const suspendedCerts = certifications.filter(
    c => c.status === "suspended" || c.status === "revoked"
  );

  const hasIngredients = ingredientAnalysis !== null;

  const {
    containsGluten = false,
    hasCrossContaminationRisk = false,
    manufacturerClaim = false,
    negativeClaim = false
  } = ingredientAnalysis || {};

  const crossNote = hasCrossContaminationRisk
    ? " İçerikte gluten kaynağı bulunmamaktadır ancak çapraz bulaş riski olabilir."
    : "";

  /**
   * 🟩 SEVİYE 1 — Sertifikalı
   */
  if (activeCerts.length > 0) {
    return {
      level: "certified",
      reason:
        "Ürün en az bir geçerli glutensiz sertifikasına sahiptir." + crossNote,
      sources: activeCerts.map(c => c.certifier)
    };
  }

  /**
   * ❌ Sertifika askıda / iptal
   */
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      level: "certification_suspended",
      reason:
        "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier)
    };
  }

  /**
   * 🟧 SEVİYE 6 — Beyan VAR ama gluten VAR (çelişki)
   */
  if (manufacturerClaim && containsGluten) {
    return {
      level: "declaration_conflict",
      reason:
        "Üretici glutensiz beyanında bulunmuştur ancak içerik gluten içermektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  /**
   * 🔴 SEVİYE 7 — Beyan YOK + gluten VAR
   */
  if (!manufacturerClaim && containsGluten) {
    return {
      level: "gluten_present",
      reason: "Ürün içeriğinde gluten veya gluten kaynağı bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  /**
   * 🟩 SEVİYE 2 — Beyan VAR + içerik VAR + gluten YOK
   */
  if (manufacturerClaim && hasIngredients && !containsGluten) {
    return {
      level: "declared_gf_with_ingredients",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir ve içerik gluten içermemektedir." +
        crossNote,
      sources: ["manufacturer", "ingredients"]
    };
  }

  /**
   * 🟨 SEVİYE 3 — Beyan VAR + içerik YOK
   */
  if (manufacturerClaim && !hasIngredients) {
    return {
      level: "declared_gf_no_ingredients",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir ancak içerik bilgisi mevcut değildir.",
      sources: ["manufacturer"]
    };
  }

  /**
   * 🟨 SEVİYE 4 — Beyan YOK + içerik VAR + gluten YOK
   */
  if (!manufacturerClaim && hasIngredients && !containsGluten) {
    return {
      level: "ingredients_safe_no_claim",
      reason:
        "İçerik gluten içermemektedir ancak glutensiz beyan veya sertifika yoktur." +
        crossNote,
      sources: ["ingredients"]
    };
  }

  /**
   * ⚪️ SEVİYE 5 — Hiçbir şey yok
   */
  return {
    level: "insufficient_data",
    reason:
      "Ürün hakkında yeterli içerik, sertifika veya üretici beyanı bilgisi bulunmamaktadır.",
    sources: []
  };
}

module.exports = { decideGlutenStatus };
