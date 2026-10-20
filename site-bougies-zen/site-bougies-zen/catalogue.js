const categoryNames = {
  noel: 'Noël',
  bapteme: 'Baptême',
  mariage: 'Mariage',
  'plaisir-offrir': "Plaisir d'offrir",
  anniversaire: 'Anniversaire',
  deco: 'Déco',
  'bien-etre': 'Bien-être',
  composition: 'Composition'
};

const grid = document.getElementById('productGrid');
const searchInput = document.getElementById('catalogueSearch');
const categoryFilter = document.getElementById('categoryFilter');
const countLabel = document.getElementById('catalogueCount');
const emptyState = document.getElementById('emptyState');
const errorMessage = document.getElementById('catalogueError');
let products = [];

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase('fr');
  const category = categoryFilter.value;
  const matchingProducts = products.filter(product => {
    const matchesCategory = category === 'all' || product.category === category;
    const matchesQuery = `${product.name} ${product.ref}`.toLocaleLowerCase('fr').includes(query);
    return matchesCategory && matchesQuery;
  });

  grid.replaceChildren(...matchingProducts.map(product => {
    const link = document.createElement('a');
    link.className = 'catalogue-product';
    link.href = `produit.html?id=${encodeURIComponent(product.id)}`;
    link.setAttribute('aria-label', `Voir ${product.name}, ${Number(product.price).toFixed(2)} euros`);

    const image = document.createElement('img');
    image.src = product.image;
    image.alt = product.name;
    image.loading = 'lazy';
    const details = document.createElement('div');
    details.className = 'catalogue-product-info';
    const categoryTag = document.createElement('p');
    categoryTag.className = 'tag';
    categoryTag.textContent = categoryNames[product.category] || product.category;
    const name = document.createElement('h2');
    name.textContent = product.name;
    const reference = document.createElement('span');
    reference.className = 'product-reference';
    reference.textContent = `Réf. ${product.ref}`;
    const price = document.createElement('strong');
    price.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(product.price);
    details.append(categoryTag, name, reference, price);
    link.append(image, details);
    return link;
  }));

  countLabel.textContent = `${matchingProducts.length} création${matchingProducts.length > 1 ? 's' : ''}`;
  emptyState.hidden = matchingProducts.length > 0;
}

searchInput.addEventListener('input', renderProducts);
categoryFilter.addEventListener('change', renderProducts);

fetch('/api/products')
  .then(response => {
    if (!response.ok) throw new Error('Le catalogue est momentanément indisponible.');
    return response.json();
  })
  .then(data => {
    products = data;
    renderProducts();
  })
  .catch(error => {
    errorMessage.textContent = error.message;
  });
