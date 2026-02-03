const axios = require("axios");

console.log(">>> OPENFOODFACTS LOADED <<<");

async function fetchProductByBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

  try {
    const response = await axios.get(url, {
      timeout: 8000, // ⏱️ 8 saniye
      validateStatus: () => true // 4xx / 5xx axios'u patlatmasın
    });

    // OFF cevap verdi ama ürün yok
    if (!response.data) {
      return {
        status: 0,
        error: "OFF_EMPTY_RESPONSE",
        message: "OpenFoodFacts boş cevap döndü"
      };
    }

    return response.data;

  } catch (error) {
    // 🔍 Hata türünü AYIRIYORUZ
    let errorType = "OFF_UNKNOWN_ERROR";

    if (error.code === "ECONNABORTED") {
      errorType = "OFF_TIMEOUT";
    } else if (error.code === "ENOTFOUND") {
      errorType = "OFF_DNS_ERROR";
    } else if (error.code === "ECONNRESET") {
      errorType = "OFF_CONNECTION_RESET";
    }

    console.error("OFF ERROR:", {
      type: errorType,
      message: error.message
    });

    // ❗ THROW YOK — kontrollü dönüş
    return {
      status: 0,
      error: errorType,
      message: "OpenFoodFacts erişilemedi"
    };
  }
}

module.exports = {
  fetchProductByBarcode
};
