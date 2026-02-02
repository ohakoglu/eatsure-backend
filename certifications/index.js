const gfcoData = require("./gfco.json");

/**
 * Normalize brand names for reliable comparison
 */
function normalizeBrand(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
}

/**
 * Find matching certifications for a given product
 * OPTION A:
 * - Brand match is sufficient
 * - Product family only affects scope, NOT eligibility
 */
function findCertificationsForProduct({ brand, productFamily }) {
  const matches = [];

  if (!brand || !gfcoData.entries) {
    return matches;
  }

  const normalizedInputBrand = normalizeBrand(brand);

  for (const entry of gfcoData.entries) {
    const entryBrand = entry.brand_normalized
      ? normalizeBrand(entry.brand_normalized)
      : null;

    // 1️⃣ Marka eşleşmesi ZORUNLU
    if (!entryBrand || entryBrand !== normalizedInputBrand) {
      continue;
    }

    // 2️⃣ Scope belirleme (bilgi amaçlı)
    let scope = "brand";

    if (
      entry.product_family &&
      productFamily &&
      productFamily
        .toLowerCase()
        .includes(entry.product_family.toLowerCase())
    ) {
      scope = "brand+family";
    }

    // 3️⃣ Sertifika geçerli
    matches.push({
      certifier: gfcoData.certifier.id,
      certifier_name: gfcoData.certifier.name,
      status: entry.status,
      scope,
      snapshot_date: gfcoData.snapshot.snapshot_date
    });
  }

  return matches;
}

module.exports = {
  findCertificationsForProduct
};
