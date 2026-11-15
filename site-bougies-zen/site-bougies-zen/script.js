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
  submitButton.disabled = true;
  status.textContent = 'Envoi de votre message…';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(contactForm)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Le message n’a pas pu être envoyé.');
    status.textContent = result.message;
    contactForm.reset();
  } catch (error) {
    status.textContent = error.message || 'Une erreur est survenue. Réessayez plus tard.';
  } finally {
    submitButton.disabled = false;
  }
});
