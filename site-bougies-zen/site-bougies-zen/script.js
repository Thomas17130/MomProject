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
const track = document.querySelector('.carousel-track');
const previousButton = document.querySelector('[data-direction="previous"]');
const nextButton = document.querySelector('[data-direction="next"]');
const count = document.querySelector('.carousel-count');
const cards = [...document.querySelectorAll('.creation')];

if (carousel && track && previousButton && nextButton && count && cards.length > 1) {
  function updateCarousel() {
    const cardStep = cards[1].offsetLeft - cards[0].offsetLeft;
    const activeIndex = Math.min(cards.length, Math.round(carousel.scrollLeft / cardStep) + 1);
    previousButton.disabled = carousel.scrollLeft < 2;
    nextButton.disabled = carousel.scrollLeft + carousel.clientWidth >= track.scrollWidth - 2;
    count.textContent = `${String(activeIndex).padStart(2, '0')} — ${String(cards.length).padStart(2, '0')}`;
  }

  function moveCarousel(direction) {
    const cardStep = cards[1].offsetLeft - cards[0].offsetLeft;
    carousel.scrollBy({ left: direction * cardStep, behavior: 'smooth' });
  }

  previousButton.addEventListener('click', () => moveCarousel(-1));
  nextButton.addEventListener('click', () => moveCarousel(1));
  carousel.addEventListener('scroll', updateCarousel, { passive: true });
  window.addEventListener('resize', updateCarousel);
  updateCarousel();
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
