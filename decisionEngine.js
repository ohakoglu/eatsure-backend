/**
 * Decision Engine v4.0 – FINAL
 * 7-level gluten safety model
 * SINGLE SOURCE OF TRUTH
 */

function decideGlutenStatus({
  certifications = [],
  analysis,
  hasIngredients
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
  } = analysis || {};

  // 🟩 SEVİYE 1 — Sertifikalı
  if (activeCerts.length > 0) {
    return {
      level: 1,
      key: "certified",
      color: "green",
      message: "Ürün geçerli bir glutensiz sertifikasına sahiptir.",
      sources: activeCerts.map(c => c.certifier)
    };
  }

  // ❌ Sertifika askıda / iptal
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      level: 6,
      key: "certification_suspended",
      color: "red",
      message: "Ürüne ait glutensiz sertifika askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier)
    };
  }

  // 🔴 SEVİYE 7 — Gluten var, beyan yok
  if (containsGluten && !manufacturerClaim) {
    return {
      level: 7,
      key: "gluten_present",
      color: "red",
      message: "Ürün içeriğinde gluten veya gluten kaynağı bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  // 🟧 SEVİYE 6 — Gluten var + beyan var (çelişki)
  if (containsGluten && manufacturerClaim) {
    return {
      level: 6,
      key: "declaration_conflict",
      color: "red",
      message:
        "Üretici glutensiz beyanında bulunmuştur ancak içerik gluten içermektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  // 🟩 SEVİYE 2 — Beyan var + içerik var + gluten yok
  if (manufacturerClaim && hasIngredients && !containsGluten) {
    return {
      level: 2,
      key: "declared_gluten_free_with_ingredients",
      color: "lightgreen",
      message:
        "Üretici ürünü glutensiz olarak beyan etmektedir ve içerik gluten içermemektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  // 🟨 SEVİYE 3 — Beyan var + içerik yok
  if (manufacturerClaim && !hasIngredients) {
    return {
      level: 3,
      key: "declared_gluten_free_no_ingredients",
      color: "yellow",
      message:
        "Üretici ürünü glutensiz olarak beyan etmektedir ancak içerik bilgisi yoktur.",
      sources: ["manufacturer"]
    };
  }

  // 🟨 SEVİYE 4 — İçerik var, gluten yok, beyan yok
  if (!manufacturerClaim && hasIngredients && !containsGluten) {
    return {
      level: 4,
      key: "ingredients_safe_no_claim",
      color: "yellow",
      message:
        "İçerik gluten içermemektedir ancak üretici tarafından glutensiz beyanı yapılmamıştır.",
      sources: ["ingredients"]
    };
  }

  // ⚪️ SEVİYE 5 — Hiçbir veri yok
  return {
    level: 5,
    key: "insufficient_data",
    color: "gray",
    message:
      "Ürün hakkında yeterli içerik, sertifika veya üretici beyanı bilgisi bulunmamaktadır.",
    sources: []
  };
}

module.exports = { decideGlutenStatus };
