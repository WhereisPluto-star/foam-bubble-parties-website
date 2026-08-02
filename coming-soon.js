const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyBirAE1w9LV7HoOS9yhxbDtRfwfzebiBGoBraAJShyj51DVx0E-8KeUN0u2DGGwT1Q/exec';
const bookingOpens = new Date('2027-01-01T00:00:00-05:00').getTime();

function updateCountdown() {
  const remaining = Math.max(0, bookingOpens - Date.now());
  const units = { days: 86400000, hours: 3600000, minutes: 60000, seconds: 1000 };
  let value = remaining;
  Object.entries(units).forEach(([name, milliseconds]) => {
    const amount = Math.floor(value / milliseconds);
    value %= milliseconds;
    document.getElementById(name).textContent = String(amount).padStart(2, '0');
  });
}

updateCountdown();
setInterval(updateCountdown, 1000);

const form = document.getElementById('interest-form');
const status = document.getElementById('form-status');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const zipInput = document.getElementById('zip');
const consentInput = document.getElementById('marketing-consent');
const earlyAccessModal = document.getElementById('early-access-modal');
let formIsVisible = true;
let hasScrolled = false;
let offerTimer;
let lastFocusedElement;

function closeEarlyAccessOffer() {
  if (earlyAccessModal.hidden) return;
  earlyAccessModal.hidden = true;
  lastFocusedElement?.focus();
}

function showEarlyAccessOffer() {
  if (formIsVisible || sessionStorage.getItem('earlyAccessOfferShown')) return;

  lastFocusedElement = document.activeElement;
  earlyAccessModal.hidden = false;
  sessionStorage.setItem('earlyAccessOfferShown', 'true');
  earlyAccessModal.querySelector('.early-access-modal-close').focus();
}

function updateOfferTimer() {
  window.clearTimeout(offerTimer);
  if (!hasScrolled || formIsVisible || sessionStorage.getItem('earlyAccessOfferShown')) return;
  offerTimer = window.setTimeout(showEarlyAccessOffer, 30000);
}

const formVisibilityObserver = new IntersectionObserver(([entry]) => {
  formIsVisible = entry.isIntersecting;
  updateOfferTimer();
}, { threshold: 0.15 });

formVisibilityObserver.observe(form);
window.addEventListener('scroll', () => {
  hasScrolled = true;
  updateOfferTimer();
}, { passive: true, once: true });

document.querySelectorAll('[data-offer-close]').forEach((control) => {
  control.addEventListener('click', closeEarlyAccessOffer);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeEarlyAccessOffer();
});

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateLeadFields() {
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  const email = emailInput.value.trim().toLowerCase();
  const phoneDigits = phoneInput.value.replace(/\D/g, '');
  const zipDigits = zipInput.value.replace(/\D/g, '').slice(0, 5);

  nameInput.value = name;
  emailInput.value = email;
  phoneInput.value = formatPhoneNumber(phoneDigits);
  zipInput.value = zipDigits;

  nameInput.setCustomValidity(name.length >= 2 && /[a-zA-Z]/.test(name)
    ? ''
    : 'Please enter your name.');
  emailInput.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? ''
    : 'Please enter a valid email address.');
  phoneInput.setCustomValidity(phoneDigits.length === 10
    ? ''
    : 'Please enter a valid 10-digit U.S. phone number.');
  zipInput.setCustomValidity(zipDigits.length === 5
    ? ''
    : 'Please enter a valid 5-digit ZIP code.');
  consentInput.setCustomValidity(consentInput.checked
    ? ''
    : 'Please agree to receive updates to join the Early Access List.');
}

phoneInput.addEventListener('input', () => {
  phoneInput.value = formatPhoneNumber(phoneInput.value);
  phoneInput.setCustomValidity('');
});

[zipInput, consentInput].forEach((field) => {
  field.addEventListener('input', () => field.setCustomValidity(''));
  field.addEventListener('change', () => field.setCustomValidity(''));
});

[nameInput, emailInput, phoneInput, zipInput, consentInput].forEach((field) => {
  field.addEventListener('blur', validateLeadFields);
});

document.querySelectorAll('.faq-trigger').forEach((trigger) => {
  const toggleFaq = () => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

    trigger.setAttribute('aria-expanded', String(!isExpanded));
    panel.hidden = isExpanded;
  };

  trigger.addEventListener('click', toggleFaq);
  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleFaq();
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  validateLeadFields();
  if (!form.reportValidity()) return;
  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    status.className = 'form-status error';
    status.textContent = 'The early-access list is being connected. Please check back shortly.';
    return;
  }
  const submitButton = form.querySelector('button');
  submitButton.disabled = true;
  submitButton.textContent = 'Joining…';
  status.className = 'form-status';
  status.textContent = '';
  try {
    const submission = new FormData(form);
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams(submission)
    });

    const responseBody = await response.text();
    if (!response.ok) throw new Error('server');

    let result;
    try {
      result = JSON.parse(responseBody);
    } catch {
      throw new Error('server');
    }
    if (!result.success) throw new Error('save');

    status.className = 'form-status success';
    form.reset();
    status.textContent = 'You’re on the Early Access List!';
  } catch (error) {
    status.className = 'form-status error';
    status.textContent = 'We couldn’t save your details. Please try again shortly.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Join the early-access list <span aria-hidden="true">→</span>';
  }
});
