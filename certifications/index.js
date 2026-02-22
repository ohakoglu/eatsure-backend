const fs = require("fs");
const path = require("path");

const allCertifications = fs
  .readdirSync(__dirname)
  .filter(file => file.endsWith(".json"))
  .map(file => require(path.join(__dirname, file)));

/**
 * Normalize text for reliable comparison
 */
function normalize(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
}

/**
 * Find matching certifications for a given product
 *
 * Öncelik sırası (KRİTİK):
 * 1️⃣ Ürün bazlı sertifika
 * 2️⃣ Ürün ailesi bazlı sertifika
 * 3️⃣ Marka bazlı sertifika
 */
function findCertificationsForProduct({
  brand,
  productName,
  productFamily
}) {
  if (!brand) {
    return [];
  }

  const normalizedBrand = normalize(brand);
  const normalizedProductName = normalize(productName || "");
  const normalizedProductFamily = normalize(productFamily || "");

  const productMatches = [];
  const familyMatches = [];
  const brandMatches = [];

  for (const certData of allCertifications) {
    if (!certData.entries) continue;

    for (const entry of certData.entries) {
      const entryBrand = entry.brand_normalized
        ? normalize(entry.brand_normalized)
        : null;

      // ❌ Marka eşleşmiyorsa geç
      if (!entryBrand || entryBrand !== normalizedBrand) {
        continue;
      }

      /**
       * 1️⃣ ÜRÜN BAZLI SERTİFİKA
       */
      if (
        entry.product_name &&
        normalizedProductName &&
        normalize(entry.product_name) === normalizedProductName
      ) {
        productMatches.push(buildResult(entry, "product", certData));
        continue;
      }

      /**
       * 2️⃣ ÜRÜN AİLESİ BAZLI SERTİFİKA
       */
      if (
        entry.product_family &&
        normalizedProductFamily &&
        normalizedProductFamily.includes(normalize(entry.product_family))
      ) {
        familyMatches.push(buildResult(entry, "product_family", certData));
        continue;
      }

      /**
       * 3️⃣ MARKA BAZLI SERTİFİKA
       */
      if (!entry.product_name && !entry.product_family) {
        brandMatches.push(buildResult(entry, "brand", certData));
      }
    }
  }

  // 🎯 SADECE EN YÜKSEK ÖNCELİK DÖNER
  if (productMatches.length > 0) return productMatches;
  if (familyMatches.length > 0) return familyMatches;
  return brandMatches;
}

/**
 * Ortak çıktı formatı
 */
function buildResult(entry, scope, certData) {
  let status = entry.status;
  if (status === "active" && entry.valid_until) {
    const now = new Date();
    const until = new Date(entry.valid_until);
    if (until < now) {
      status = "expired";
    }
  }

  return {
    certifier: certData.certifier.id,
    certifier_name: certData.certifier.name,
    status,
    scope,
    status_note: entry.status_note || null,
    valid_from: entry.valid_from || null,
    valid_until: entry.valid_until || null,
    snapshot_date: certData.snapshot.snapshot_date
  };
}

module.exports = {
  findCertificationsForProduct
};
