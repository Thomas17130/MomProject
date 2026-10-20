const categoryLabels = {
  noel: 'Noël',
  bapteme: 'Baptême',
  mariage: 'Mariage',
  'plaisir-offrir': "Plaisir d'offrir",
  anniversaire: 'Anniversaire',
  deco: 'Déco',
  'bien-etre': 'Bien-être',
  composition: 'Composition'
};
const detail = document.getElementById('productDetail');
const productId = new URLSearchParams(window.location.search).get('id');

function showError(message) {
  const paragraph = document.createElement('p');
  paragraph.className = 'empty-state';
  paragraph.textContent = message;
  detail.replaceChildren(paragraph);
}

if (!productId) {
  showError('Aucune création n’a été sélectionnée.');
} else {
  fetch(`/api/products/${encodeURIComponent(productId)}`)
    .then(response => {
      if (!response.ok) throw new Error('Cette création est introuvable.');
      return response.json();
    })
    .then(product => {
      document.title = `${product.name} — Lueur d'Âme`;
      const image = document.createElement('img');
      image.className = 'product-detail-image';
      image.src = product.image;
      image.alt = product.name;
      const imageLink = document.createElement('a');
      imageLink.className = 'product-detail-image-link';
      imageLink.href = product.image;
      imageLink.target = '_blank';
      imageLink.rel = 'noopener';
      imageLink.setAttribute('aria-label', `Agrandir la photo de ${product.name}`);
      imageLink.append(image);

      const content = document.createElement('div');
      content.className = 'product-detail-copy';
      const category = document.createElement('p');
      category.className = 'eyebrow';
      category.textContent = categoryLabels[product.category] || product.category;
      const name = document.createElement('h1');
      name.textContent = product.name;
      const reference = document.createElement('p');
      reference.className = 'detail-reference';
      reference.textContent = `Référence ${product.ref}`;
      const price = document.createElement('p');
      price.className = 'detail-price';
      price.textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(product.price);
      const descriptionLabel = document.createElement('h2');
      descriptionLabel.textContent = 'Description';
      const description = document.createElement('p');
      description.className = 'detail-description';
      description.textContent = product.description;
      const contact = document.createElement('a');
      contact.className = 'btn btn-dark';
      contact.href = `index.html#contact`;
      contact.textContent = 'Poser une question';
      content.append(category, name, reference, price, descriptionLabel, description, contact);
      detail.replaceChildren(imageLink, content);
    })
    .catch(error => showError(error.message));
}
