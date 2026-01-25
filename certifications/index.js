const gfco = require("./gfco.json");

/**
 * Find matching certifications for a given product
 * based on brand and product family.
 */
function findCertificationsForProduct({ brand, productFamily }) {
  const matches = [];

  for (const cert of gfco) {
    const brandMatch =
      cert.scope.brand &&
      brand &&
      cert.scope.brand.toLowerCase() === brand.toLowerCase();

    const familyMatch =
      cert.scope.product_family &&
      productFamily &&
      productFamily.toLowerCase().includes(
        cert.scope.product_family.toLowerCase()
      );

    if (brandMatch || familyMatch) {
      matches.push(cert);
    }
  }

  return matches;
}

module.exports = {
  findCertificationsForProduct
};
