/**
 * Decision Engine v2.2
 * Handles certifications, conflicts, ingredient risks,
 * and explicit manufacturer gluten-free declarations.
 */

function decideGlutenStatus({
  certifications = [],
  ingredientAnalysis,
  manufacturerClaim
}) {
  // --- CERTIFICATION ANALYSIS ---

  const activeCerts = certifications.filter(
    (c) => c.status === "active"
  );

  const suspendedCerts = certifications.filter(
    (c) => c.status === "suspended" || c.status === "revoked"
  );

  // 1️⃣ At least one ACTIVE certification → SAFE (CERTIFIED)
  if (activeCerts.length > 0) {
    const notes = [];

    if (suspendedCerts.length > 0) {
      notes.push(
        "Bazı sertifikalar askıya alınmış veya iptal edilmiş olabilir. Detaylar sertifikasyon sayfasında görülebilir."
      );
    }

    return {
      status: "safe",
      level: "certified",
      reason: "Ürün en az bir geçerli glutensiz sertifikasına sahiptir.",
      sources: ["certification"],
      notes
    };
  }

  // 2️⃣ No active certs, but suspended/revoked exist → UNSAFE
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      status: "unsafe",
      level: "certification_suspended",
      reason:
        "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiş olabilir.",
      sources: ["certification"]
    };
  }

  // --- INGREDIENT ANALYSIS ---

  if (ingredientAnalysis?.containsGluten === true) {
    return {
      status: "unsafe",
      level: "ingredient_risk",
      reason: "İçerikte gluten veya gluten içeren bileşenler bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  // --- MANUFACTURER DECLARATION (NO CERTIFICATION FOUND) ---

  if (manufacturerClaim === true) {
    return {
      status: "declared_gluten_free",
      level: "manufacturer_claim",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir. Ancak şu anda taranan sertifikasyon kaynaklarında bu ürüne ait doğrulanmış bir sertifika bilgisi yer almamaktadır.",
      sources: ["manufacturer"]
    };
  }

  // --- INSUFFICIENT DATA ---

  return {
    status: "unknown",
    level: "insufficient_data",
    reason: "Ürün hakkında yeterli ve doğrulanabilir bilgi bulunmamaktadır.",
    sources: []
  };
}

module.exports = {
  decideGlutenStatus
};
