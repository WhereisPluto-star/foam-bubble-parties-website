// Paste the deployed Google Apps Script web-app URL here after completing google-sheets/SETUP.md.
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx0LqHFz9e4NZTT5sY7QB9BXYQNkLTFU-sz8jzdVl00QND7haAjd2xzU1qVrW_PnjNZQQ/exec';
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
const earlyAccessCount = document.getElementById('early-access-count');
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

async function updateEarlyAccessCount() {
  if (!GOOGLE_SHEETS_WEB_APP_URL || !earlyAccessCount) return;

  try {
    const countUrl = new URL(GOOGLE_SHEETS_WEB_APP_URL);
    countUrl.searchParams.set('action', 'count');
    const response = await fetch(countUrl);
    const result = await response.json();
    if (!response.ok || !result.success || !Number.isInteger(result.count)) return;

    earlyAccessCount.querySelector('strong').textContent = result.count;
    earlyAccessCount.hidden = false;
  } catch (error) {
    console.error('Early-access count could not be loaded:', error);
  }
}

updateEarlyAccessCount();

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
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams(new FormData(form))
    });

    if (!response.ok) throw new Error('The early-access service returned an error.');

    const result = await response.json();
    if (!result.ok && !result.success) {
      throw new Error(result.error || 'The early-access service did not confirm the submission.');
    }

    form.reset();
    updateEarlyAccessCount();
    status.className = 'form-status success';
    status.textContent = 'You’re on the list. We’ll be in touch before booking opens.';
  } catch (error) {
    console.error('Early-access form submission failed:', error);
    status.className = 'form-status error';
    status.textContent = 'We couldn’t save your details. Please try again shortly.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Join the early-access list <span aria-hidden="true">→</span>';
  }
});
