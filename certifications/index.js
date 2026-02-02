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
 * Brand-first, scope-aware, MVP-safe
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

    // 2️⃣ Ürün ailesi varsa daralt
    if (
      entry.product_family &&
      productFamily &&
      !productFamily
        .toLowerCase()
        .includes(entry.product_family.toLowerCase())
    ) {
      continue;
    }

    // 3️⃣ Geçerli eşleşme
    matches.push({
      certifier: gfcoData.certifier.id,
      certifier_name: gfcoData.certifier.name,
      status: entry.status,
      scope: entry.product_family ? "brand+family" : "brand",
      snapshot_date: gfcoData.snapshot.snapshot_date
    });
  }

  return matches;
}

module.exports = {
  findCertificationsForProduct
};
