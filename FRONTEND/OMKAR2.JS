const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

async function loadProducts(query = "") {
  const products = await api(`/products?q=${encodeURIComponent(query)}`);
  renderProducts(products);
}

function renderProducts(products) {
  productGrid.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${
        p.images && p.images.length > 0
          ? "http://localhost:4000" + p.images[0].url
          : "https://via.placeholder.com/150"
      }" alt="${p.title}">
      <h3>${p.title}</h3>
      <p>$${p.price}</p>
      <a href="product.html?id=${p.id}" class="view-btn">View</a>
    `;
    productGrid.appendChild(card);
  });
}


searchBtn.addEventListener("click", () => loadProducts(searchInput.value));


socket.on("newProduct", (p) => {
  loadProducts(searchInput.value);
});


loadProducts();
