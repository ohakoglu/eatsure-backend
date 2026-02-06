/**
 * Decision Engine v3.1 – FINAL (FIXED)
 * 7-level gluten safety decision model
 * Certification > Conflict > Ingredients > Declaration > Availability
 */

function decideGlutenStatus({
  certifications = [],
  ingredientAnalysis,
  manufacturerClaim
}) {
  const activeCerts = certifications.filter(c => c.status === "active");
  const suspendedCerts = certifications.filter(
    c => c.status === "suspended" || c.status === "revoked"
  );

  const hasIngredients = ingredientAnalysis !== null;

  const ingredientsContainGluten =
    ingredientAnalysis?.status === "unsafe";

  const ingredientsAreSafe =
    ingredientAnalysis?.status === "safe";

  /**
   * 🟩 SEVİYE 1
   * Sertifikalı
   */
  if (activeCerts.length > 0) {
    return {
      status: "safe",
      level: "certified",
      reason: "Ürün en az bir geçerli glutensiz sertifikasına sahiptir.",
      sources: activeCerts.map(c => c.certifier),
      notes: [
        "Bu değerlendirme, markaya ait sertifikasyon bilgilerine dayanmaktadır."
      ]
    };
  }

  /**
   * ❌ Sertifika askıda / iptal
   */
  if (activeCerts.length === 0 && suspendedCerts.length > 0) {
    return {
      status: "unsafe",
      level: "certification_suspended",
      reason:
        "Ürüne ait glutensiz sertifikaların geçerliliği askıya alınmış veya iptal edilmiştir.",
      sources: suspendedCerts.map(c => c.certifier)
    };
  }

  /**
   * 🟧 SEVİYE 6
   * Beyan VAR + içerik glutenli (çelişki)
   */
  if (manufacturerClaim && ingredientsContainGluten) {
    return {
      status: "unsafe",
      level: "declaration_conflict",
      reason:
        "Üretici glutensiz beyanında bulunmuştur ancak içerik bilgisi gluten içermektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  /**
   * 🔴 SEVİYE 7
   * Beyan YOK + içerikte gluten VAR
   */
  if (!manufacturerClaim && ingredientsContainGluten) {
    return {
      status: "unsafe",
      level: "gluten_present",
      reason: "Ürün içeriğinde gluten veya gluten kaynağı bulunmaktadır.",
      sources: ["ingredients"]
    };
  }

  /**
   * 🟩 SEVİYE 2
   * Beyan VAR + içerik VAR + içerik GÜVENLİ
   */
  if (manufacturerClaim && hasIngredients && ingredientsAreSafe) {
    return {
      status: "safe",
      level: "declared_gluten_free_with_ingredients",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir ve içerik bilgisi gluten içermemektedir.",
      sources: ["manufacturer", "ingredients"]
    };
  }

  /**
   * 🟨 SEVİYE 3
   * Beyan VAR + içerik YOK
   */
  if (manufacturerClaim && !hasIngredients) {
    return {
      status: "declared_gluten_free",
      level: "manufacturer_claim_no_ingredients",
      reason:
        "Üretici ürünü glutensiz olarak beyan etmektedir ancak içerik bilgisi mevcut değildir.",
      sources: ["manufacturer"]
    };
  }

  /**
   * 🟨 SEVİYE 4
   * Beyan YOK + içerik VAR + içerik GÜVENLİ
   */
  if (!manufacturerClaim && hasIngredients && ingredientsAreSafe) {
    return {
      status: "unknown",
      level: "ingredients_safe_no_claim",
      reason:
        "İçerik bilgisi gluten içermemektedir ancak üretici tarafından glutensiz beyanı yapılmamıştır.",
      sources: ["ingredients"]
    };
  }

  /**
   * ⚪️ SEVİYE 5
   * İçerik yok + beyan yok + sertifika yok
   */
  return {
    status: "unknown",
    level: "insufficient_data",
    reason:
      "Ürün hakkında yeterli içerik, sertifika veya üretici beyanı bilgisi bulunmamaktadır.",
    sources: []
  };
}

module.exports = {
  decideGlutenStatus
};
