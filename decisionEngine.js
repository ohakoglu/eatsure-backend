/**
 * Decision Engine
 * Combines certification, ingredient analysis and manufacturer claims
 * to produce a final gluten safety decision.
 */

function decideGlutenStatus({
  certification,        // object or null
  ingredientAnalysis,   // result from glutenAnalyzer
  manufacturerClaim     // true / false
}) {

  // 1️⃣ Sertifika her şeyin üstünde
  if (certification && certification.status === "active") {
    return {
      status: "safe",
      level: "certified",
      reason: "Ürün geçerli bir glutensiz sertifikasına sahiptir.",
      source: certification.certifier
    };
  }

  // Sertifika askıya alınmışsa
  if (certification && certification.status === "suspended") {
    return {
      status: "unsafe",
      level: "certification_suspended",
      reason: "Ürünün glutensiz sertifikası askıya alınmıştır.",
      source: certification.certifier
    };
  }

  // 2️⃣ İçerikte gluten varsa
  if (ingredientAnalysis.containsGluten === true) {
    return {
      status: "unsafe",
      level: "ingredient_risk",
      reason: "İçerikte gluten veya gluten içeren bileşenler bulunmaktadır.",
      source: "ingredients"
    };
  }

  // 3️⃣ Sertifika yok ama üretici glutensiz diyor
  if (manufacturerClaim === true) {
    return {
      status: "likely_safe",
      level: "manufacturer_claim",
      reason: "Üretici ürünü glutensiz olarak beyan etmektedir ancak sertifika yoktur.",
      source: "manufacturer"
    };
  }

  // 4️⃣ Bilgi yetersiz
  return {
    status: "unknown",
    level: "insufficient_data",
    reason: "Ürün hakkında yeterli bilgi bulunmamaktadır.",
    source: null
  };
}

module.exports = {
  decideGlutenStatus
};
