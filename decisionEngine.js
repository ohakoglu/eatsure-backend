/**
 * Decision Engine v2.3 – FINAL
 * Certification-first, evidence-aware, UX-honest
 */

function decideGlutenStatus({
  certifications = [],
  ingredientAnalysis,
  manufacturerClaim
}) {
  // --- CERTIFICATION ANALYSIS ---

  const activeCerts = certifications.filter(c => c.status === "active");
  const suspendedCerts = certifications.filter(
    c => c.status === "suspended" || c.status === "revoked"
  );

  // 1️⃣ ACTIVE CERTIFICATION → SAFE
  if (activeCerts.length > 0) {
    const sources = activeCerts.map(c => c.certifier);
    const scopes = activeCerts.map(c => c.scope);

    const notes = [];

    if (scopes.includes("brand")) {
      notes.push(
        "Bu değerlendirme, markaya ait sertifikasyon bilgilerine dayanmaktadır."
      );
    }

    if (scopes.includes("brand+family")) {
      notes.push(
        "Sertifikasyon belirli ürün ailesi kapsamında geçerlidir."
      );
    }

    if (suspendedCerts.length > 0) {
      notes.push(
        "Bazı sertifikaların durumu askıya alınmış veya iptal edilmiş olabilir. Detaylar sertifikasyon kaynağında görülebilir."
      );
    }

    return {
      status: "safe",
      level: "certified",
      reason: "Ürün en az bir geçerli glutensiz sertifikasına sahiptir.",
      sources,
      notes
    };
  }

  // 2️⃣ CERTIFICATION SUSPENDED / REVOKED
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      status: "unsafe",
      level: "certification_suspended",
      reason:
        "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier)
    };
  }

  // --- INGREDIENT ANALYSIS ---

  if (ingredientAnalysis?.status === "unsafe") {
    return {
      status: "unsafe",
      level: "ingredient_risk",
      reason: ingredientAnalysis.reason,
      sources: ["ingredients"]
    };
  }

  // --- MANUFACTURER DECLARATION (NO CERT FOUND) ---

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
