const loginPanel = document.getElementById('loginPanel');
const workspace = document.getElementById('adminWorkspace');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const logoutButton = document.getElementById('logoutButton');
const productForm = document.getElementById('productForm');
const productList = document.getElementById('adminProductList');
const formMessage = document.getElementById('productFormMessage');
const listMessage = document.getElementById('adminListMessage');
const countLabel = document.getElementById('adminProductCount');
const categoryNames = {
  noel: 'Noël', bapteme: 'Baptême', mariage: 'Mariage',
  'plaisir-offrir': "Plaisir d'offrir", anniversaire: 'Anniversaire',
  deco: 'Déco', 'bien-etre': 'Bien-être', composition: 'Composition'
};

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
  return result;
}

function setAuthenticated(authenticated) {
  loginPanel.hidden = authenticated;
  workspace.hidden = !authenticated;
  logoutButton.hidden = !authenticated;
  if (authenticated) loadProducts();
}

function resetProductForm() {
  productForm.reset();
  document.getElementById('productId').value = '';
  document.getElementById('productFormTitle').textContent = 'Nouvelle création';
  document.getElementById('saveProductButton').textContent = 'Ajouter le produit';
  document.getElementById('cancelEditButton').hidden = true;
  formMessage.textContent = '';
}

function beginEdit(product) {
  document.getElementById('productId').value = product.id;
  document.getElementById('productName').value = product.name;
  document.getElementById('productRef').value = product.ref;
  document.getElementById('productCategory').value = product.category;
  document.getElementById('productPrice').value = product.price;
  document.getElementById('productImage').value = product.image;
  document.getElementById('productDescription').value = product.description;
  document.getElementById('productFormTitle').textContent = 'Modifier la création';
  document.getElementById('saveProductButton').textContent = 'Enregistrer les changements';
  document.getElementById('cancelEditButton').hidden = false;
  document.getElementById('productName').focus();
}

function renderProducts(products) {
  countLabel.textContent = `${products.length} produit${products.length > 1 ? 's' : ''}`;
  productList.replaceChildren(...products.map(product => {
    const row = document.createElement('article');
    row.className = 'admin-product-row';
    const image = document.createElement('img');
    image.src = product.image;
    image.alt = '';
    image.loading = 'lazy';
    const details = document.createElement('div');
    details.className = 'admin-product-info';
    const name = document.createElement('h3');
    name.textContent = product.name;
    const metadata = document.createElement('p');
    metadata.textContent = `${product.ref} · ${categoryNames[product.category]} · ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(product.price)}`;
    details.append(name, metadata);
    const actions = document.createElement('div');
    actions.className = 'admin-product-actions';
    const editButton = document.createElement('button');
    editButton.className = 'text-button';
    editButton.type = 'button';
    editButton.textContent = 'Modifier';
    editButton.addEventListener('click', () => beginEdit(product));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-button danger-button';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
      try {
        await apiRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
        await loadProducts();
        if (document.getElementById('productId').value === product.id) resetProductForm();
      } catch (error) {
        listMessage.textContent = error.message;
      }
    });
    actions.append(editButton, deleteButton);
    row.append(image, details, actions);
    return row;
  }));
}

async function loadProducts() {
  listMessage.textContent = '';
  try {
    renderProducts(await apiRequest('/api/products'));
  } catch (error) {
    listMessage.textContent = error.message;
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginMessage.textContent = '';
  try {
    await apiRequest('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: new FormData(loginForm).get('password') })
    });
    loginForm.reset();
    setAuthenticated(true);
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await apiRequest('/api/admin/logout', { method: 'POST', body: '{}' });
    setAuthenticated(false);
  } catch (error) {
    listMessage.textContent = error.message;
  }
});

productForm.addEventListener('submit', async event => {
  event.preventDefault();
  formMessage.textContent = '';
  const productId = document.getElementById('productId').value;
  const data = Object.fromEntries(new FormData(productForm));
  data.price = Number(data.price);
  const editing = Boolean(productId);
  try {
    await apiRequest(editing ? `/api/admin/products/${encodeURIComponent(productId)}` : '/api/admin/products', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    resetProductForm();
    formMessage.textContent = editing ? 'Les changements ont été enregistrés.' : 'Le produit a été ajouté.';
    await loadProducts();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

document.getElementById('cancelEditButton').addEventListener('click', resetProductForm);

apiRequest('/api/admin/session')
  .then(result => setAuthenticated(result.authenticated))
  .catch(() => {
    loginMessage.textContent = 'Le serveur est indisponible.';
  });
