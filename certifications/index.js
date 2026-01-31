const gfcoData = require("./gfco.json");

/**
 * Find matching certifications for a given product
 * based on brand and product family.
 */
function findCertificationsForProduct({ brand, productFamily }) {
  const matches = [];

  // 🟢 Yeni veri modeline uygun: entries array
  const entries = gfcoData.entries || [];

  for (const entry of entries) {
    const brandMatch =
      entry.brand_normalized &&
      brand &&
      entry.brand_normalized.toLowerCase() === brand.toLowerCase();

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
