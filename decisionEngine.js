/**
 * Decision Engine v2
 * Handles multiple certifications, conflicts, and produces
 * a single clear gluten safety decision.
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

  // 1️⃣ At least one ACTIVE certification → SAFE
  if (activeCerts.length > 0) {
    const notes = [];

    if (suspendedCerts.length > 0) {
      const suspendedNames = suspendedCerts
        .map((c) => c.certifier)
        .join(", ");

      notes.push(
        `Bazı sertifikalar askıda veya iptal edilmiş durumda: ${suspendedNames}.`
      );
    }

    return {
      status: "safe",
      level: "certified",
      reason: "Ürün en az bir geçerli glutensiz sertifikasına sahiptir.",
      sources: activeCerts.map((c) => c.certifier),
      notes
    };
  }

  // 2️⃣ No active certs, but suspended/revoked exist → UNSAFE
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      status: "unsafe",
      level: "certification_suspended",
      reason: "Ürünün glutensiz sertifikaları askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map((c) => c.certifier)
    };
  }

  // --- INGREDIENT ANALYSIS ---

  if (ingredientAnalysis.containsGluten === true) {
    return {
      status: "unsafe",
      level: "ingredient_risk",
      reason: "İçerikte gluten veya gluten içeren bileşenler bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  // --- MANUFACTURER CLAIM ---

  if (manufacturerClaim === true) {
    return {
      status: "likely_safe",
      level: "manufacturer_claim",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir ancak sertifika bulunmamaktadır.",
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
