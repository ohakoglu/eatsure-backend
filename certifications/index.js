const gfcoData = require("./gfco.json");

/**
 * Normalize brand names for reliable comparison
 * - lowercase
 * - remove accents (ä → a, ö → o, etc.)
 * - remove dots and extra spaces
 */
function normalizeBrand(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")                // ä → a + ¨
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\./g, "")              // remove dots
    .trim();
}

/**
 * Find matching certifications for a given product
 * based on brand and product family.
 */
function findCertificationsForProduct({ brand, productFamily }) {
  const matches = [];

  const entries = gfcoData.entries || [];

  const normalizedInputBrand = brand
    ? normalizeBrand(brand)
    : null;

  for (const entry of entries) {
    const entryBrand = entry.brand_normalized
      ? normalizeBrand(entry.brand_normalized)
      : null;

    const brandMatch =
      entryBrand &&
      normalizedInputBrand &&
      entryBrand === normalizedInputBrand;

    const familyMatch =
      entry.product_family &&
      productFamily &&
      productFamily.toLowerCase().includes(
        entry.product_family.toLowerCase()
      );

    if (brandMatch || familyMatch) {
      matches.push({
        certifier: gfcoData.certifier.id,
        status: entry.status,
        snapshot_date: gfcoData.snapshot.snapshot_date
      });
    }
  }

  return matches;
}

module.exports = {
  findCertificationsForProduct
};
