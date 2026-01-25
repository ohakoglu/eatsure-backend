console.log(">>> OPENFOODFACTS LOADED <<<");

async function fetchProductByBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

  const response = await fetch(url);
  const data = await response.json();

  return data;
}

module.exports = {
  fetchProductByBarcode
};
