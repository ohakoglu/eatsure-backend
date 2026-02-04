/**
 * OFF – Declared Gluten Free but NO INGREDIENTS
 *
 * Amaç:
 * - OFF kaydı VAR
 * - Ürün adında / etiket bilgisinde "gluten free / glutensiz" beyanı VAR
 * - ingredients_text YOK
 *
 * Bu dosya SADECE test ve doğrulama içindir.
 * Karar motoruna henüz bağlanmaz.
 */

module.exports = [
  {
    barcode: "8008698005070",
    expected: {
      offExists: true,
      hasIngredients: false,
      manufacturerClaim: true
    }
  },
  {
    barcode: "8008698004890",
    expected: {
      offExists: true,
      hasIngredients: false,
      manufacturerClaim: true
    }
  }
];
