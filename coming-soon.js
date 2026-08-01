// Paste the deployed Google Apps Script web-app URL here after completing google-sheets/SETUP.md.
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx0LqHFz9e4NZTT5sY7QB9BXYQNkLTFU-sz8jzdVl00QND7haAjd2xzU1qVrW_PnjNZQQ/exec';
const bookingOpens = new Date('2027-01-01T00:00:00-05:00').getTime();
const FORM_RATE_LIMIT_MS = 15000;
const FORM_RATE_LIMIT_KEY = 'foamBubbleEarlyAccessLastSubmitAt';

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
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
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

function isObviousFakePhone(digits) {
  return /^(\d)\1{9}$/.test(digits)
    || ['0123456789', '1234567890', '9876543210'].includes(digits);
}

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

  nameInput.value = name;
  emailInput.value = email;
  phoneInput.value = formatPhoneNumber(phoneDigits);

  nameInput.setCustomValidity(name.length >= 2 && /[a-zA-Z]/.test(name)
    ? ''
    : 'Please enter your name.');
  emailInput.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? ''
    : 'Please enter a valid email address.');
  phoneInput.setCustomValidity(phoneDigits.length === 10 && !isObviousFakePhone(phoneDigits)
    ? ''
    : 'Please enter a valid 10-digit U.S. phone number.');
}

function resetTurnstile() {
  if (window.turnstile) window.turnstile.reset();
}

function formatDiagnosticSubmissionError(result) {
  const stage = typeof result.stage === 'string' ? result.stage : '';
  const errorCode = Array.isArray(result.errorCodes)
    ? result.errorCodes.find((code) => typeof code === 'string')
    : '';

  if (stage) {
    return `Submission failed: ${stage}${errorCode ? ` — ${errorCode}` : ''}`;
  }
  return result.message || 'The early-access service did not confirm the submission.';
}

phoneInput.addEventListener('input', () => {
  phoneInput.value = formatPhoneNumber(phoneInput.value);
  phoneInput.setCustomValidity('');
});

[nameInput, emailInput, phoneInput].forEach((field) => {
  field.addEventListener('blur', validateLeadFields);
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
  validateLeadFields();
  if (!form.reportValidity()) return;
  if (!form.querySelector('[name="cf-turnstile-response"]')?.value) {
    status.className = 'form-status error';
    status.textContent = 'Please complete the security check.';
    return;
  }
  if (!GOOGLE_SHEETS_WEB_APP_URL) {
    status.className = 'form-status error';
    status.textContent = 'The early-access list is being connected. Please check back shortly.';
    return;
  }
  const lastSubmittedAt = Number(sessionStorage.getItem(FORM_RATE_LIMIT_KEY) || 0);
  if (Date.now() - lastSubmittedAt < FORM_RATE_LIMIT_MS) {
    status.className = 'form-status error';
    status.textContent = 'Please wait a few seconds before trying again.';
    return;
  }

  const submitButton = form.querySelector('button');
  submitButton.disabled = true;
  submitButton.textContent = 'Joining…';
  status.className = 'form-status';
  status.textContent = '';
  // Session-only timestamp: it limits rapid retries without storing personal data.
  sessionStorage.setItem(FORM_RATE_LIMIT_KEY, String(Date.now()));

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
      throw new Error(formatDiagnosticSubmissionError(result));
    }

    form.reset();
    resetTurnstile();
    if (result.duplicate) {
      status.className = 'form-status success';
      status.textContent = 'You’re already on the Early Access List! We’ll contact you when booking opens.';
      return;
    }
    updateEarlyAccessCount();
    status.className = 'form-status success';
    status.textContent = 'You’re on the list. We’ll be in touch before booking opens.';
  } catch (error) {
    console.error('Early-access form submission failed:', error);
    status.className = 'form-status error';
    status.textContent = error.message || 'We couldn’t save your details. Please try again shortly.';
    resetTurnstile();
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Join the early-access list <span aria-hidden="true">→</span>';
  }
});
