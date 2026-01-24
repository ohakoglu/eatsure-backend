const axios = require("axios");

async function fetchProductByBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  const response = await axios.get(url);
  return response.data;
}

module.exports = { fetchProductByBarcode };
