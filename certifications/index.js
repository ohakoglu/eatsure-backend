const gfcoData = require("./gfco.json");

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
  if (!brand || !gfcoData.entries) {
    return [];
  }

  const normalizedBrand = normalize(brand);
  const normalizedProductName = normalize(productName || "");
  const normalizedProductFamily = normalize(productFamily || "");

  const productMatches = [];
  const familyMatches = [];
  const brandMatches = [];

  for (const entry of gfcoData.entries) {
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
      productMatches.push(buildResult(entry, "product"));
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
      familyMatches.push(buildResult(entry, "product_family"));
      continue;
    }

    /**
     * 3️⃣ MARKA BAZLI SERTİFİKA
     */
    if (!entry.product_name && !entry.product_family) {
      brandMatches.push(buildResult(entry, "brand"));
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
function buildResult(entry, scope) {
  let status = entry.status;
  if (status === "active" && entry.valid_until) {
    const now = new Date();
    const until = new Date(entry.valid_until);
    if (until < now) {
      status = "expired";
    }
  }
  return {
    certifier: gfcoData.certifier.id,
    certifier_name: gfcoData.certifier.name,
    status,
    scope,
    status_note: entry.status_note || null,
    valid_from: entry.valid_from || null,
    valid_until: entry.valid_until || null,
    snapshot_date: gfcoData.snapshot.snapshot_date
  };
}

module.exports = {
  findCertificationsForProduct
};
