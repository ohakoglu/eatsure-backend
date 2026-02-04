/**
 * OFF Declared Gluten Free Finder
 *
 * Amaç:
 * - OpenFoodFacts'te KAYITLI
 * - Ürün adında / etiketinde "gluten free / glutensiz" geçen
 * - ingredients_text OLMAYAN
 * ürünleri bulmak
 *
 * ÇIKTI:
 * - barcode
 * - product name
 * - brand
 */

const axios = require("axios");

async function findDeclaredGlutenFreeNoIngredients() {
  const url = "https://world.openfoodfacts.org/cgi/search.pl";

  const params = {
    search_terms: "gluten free",
    search_simple: 1,
    action: "process",
    json: 1,

    // 🔑 kritik filtreler
    ingredients_text_exists: 0,

    page_size: 20
  };

  try {
    const res = await axios.get(url, { params });

    const products = res.data.products || [];

    const results = products.map(p => ({
      barcode: p.code || null,
      name: p.product_name || null,
      brand: p.brands || null
    }));

    console.log("=== BULUNAN ÜRÜNLER ===");
    console.log(results);

    return results;
  } catch (err) {
    console.error("OFF SEARCH ERROR:", err.message);
  }
}

// ÇALIŞTIR
findDeclaredGlutenFreeNoIngredients();
