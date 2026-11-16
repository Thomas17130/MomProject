const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

toggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(isOpen));
  toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
});

document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Ouvrir le menu');
}));

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const carousel = document.querySelector('.carousel-viewport');
const cards = [...(carousel?.querySelectorAll('.creation') || [])];

if (carousel && cards.length > 1) {
  let activeIndex = cards.findIndex(card => card.classList.contains('is-active'));
  if (activeIndex < 0) activeIndex = 0;
  const controls = document.querySelectorAll('.carousel-control');
  const autoplayEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let autoplayTimer;

  function showCard(index) {
    activeIndex = (index + cards.length) % cards.length;
    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeIndex;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-hidden', String(!isActive));
    });
  }

  function startAutoplay() {
    window.clearInterval(autoplayTimer);
    if (autoplayEnabled) {
      autoplayTimer = window.setInterval(() => showCard(activeIndex + 1), 5000);
    }
  }

  showCard(activeIndex);
  controls.forEach(control => control.addEventListener('click', () => {
    showCard(activeIndex + Number(control.dataset.carouselDirection));
    startAutoplay();
  }));

  startAutoplay();
}

const contactForm = document.getElementById('contactForm');
if (contactForm) contactForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const status = document.getElementById('formMessage');
  const formData = new FormData(contactForm);
  const values = Object.fromEntries(formData);
  values.receiveCopy = formData.has('receiveCopy');
  submitButton.disabled = true;
  status.textContent = 'Envoi de votre message…';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values)
    });
    if (response.status === 405) {
      throw new Error('Le serveur d’envoi du site est indisponible. Lancez le site avec « npm start » plutôt qu’avec Live Server.');
    }
    const responseText = await response.text();
    let result = {};
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Le serveur du formulaire a renvoyé une réponse invalide (HTTP ${response.status}). Vérifiez que le site est lancé avec son serveur Node.js.`);
      }
    }
    if (!response.ok) {
      throw new Error(result.error || `Le serveur du formulaire a répondu avec une erreur (HTTP ${response.status}).`);
    }
    if (!result.sent || !result.message) {
      throw new Error('Le serveur du formulaire n’a pas confirmé l’envoi. Vérifiez sa configuration e-mail.');
    }
    status.textContent = result.message;
    contactForm.reset();
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? 'Impossible de joindre le serveur d’envoi. Vérifiez que le site est lancé avec « npm start ».'
      : error.message || 'Une erreur est survenue. Réessayez plus tard.';
  } finally {
    submitButton.disabled = false;
  }
});
