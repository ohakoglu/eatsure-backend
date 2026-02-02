const axios = require("axios");

console.log(">>> OPENFOODFACTS LOADED <<<");

async function fetchProductByBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

  try {
    const response = await axios.get(url, {
      timeout: 8000 // ⏱ 8 saniye
    });

    // OFF düzgün cevap vermediyse
    if (!response || !response.data) {
      return {
        status: 0,
        message: "OpenFoodFacts boş cevap döndü"
      };
    }

    return response.data;

  } catch (error) {
    console.error("OFF ERROR:", error.message);

    // ⛑ Kontrollü fallback
    return {
      status: 0,
      message: "OpenFoodFacts erişilemedi"
    };
  }
}

module.exports = {
  fetchProductByBarcode
};
