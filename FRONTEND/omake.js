const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");


async function loadProducts(query = "") {
  try {
    const products = await api(`/products?q=${encodeURIComponent(query)}`);
    renderProducts(products);
  } catch (error) {
    console.error("Error loading products:", error);
   
  }
}

function renderProducts(products) {
  
  productGrid.innerHTML = "";
 
  if (products.length === 0) {
    productGrid.innerHTML = "<p>No products found.</p>";
    return;
  }
 
  products.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${
        p.image_url 
          ? p.image_url
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


document.addEventListener("DOMContentLoaded", loadProducts);
