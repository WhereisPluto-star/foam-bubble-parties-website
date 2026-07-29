/* ==========================================================================
   FOAM BUBBLE PARTIES (foambubbleparties.com) — TOP 1% CRO LOGIC & ENGINE
   ========================================================================== */

let currentPackagePrice = 399;
let currentPackageName = 'Ultimate Glow Rave';
let selectedAddons = new Map();

// Valid Dayton & SW Ohio Zip Codes database
const daytonZipMap = {
  '45458': 'Centerville, OH',
  '45459': 'Centerville / Washington Twp, OH',
  '45440': 'Beavercreek / Kettering, OH',
  '45430': 'Beavercreek, OH',
  '45431': 'Beavercreek / WPAFB, OH',
  '45432': 'Beavercreek, OH',
  '45434': 'Beavercreek, OH',
  '45066': 'Springboro, OH',
  '45419': 'Oakwood, OH',
  '45420': 'Kettering, OH',
  '45429': 'Kettering, OH',
  '45409': 'Kettering / UD Area, OH',
  '45324': 'Fairborn, OH',
  '45342': 'Miamisburg / Austin Landing, OH',
  '45377': 'Vandalia, OH',
  '45040': 'Mason, OH',
  '45373': 'Troy, OH',
  '45402': 'Downtown Dayton, OH'
};

document.addEventListener('DOMContentLoaded', () => {
  // Sticky Header Scroll Effect
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Set default date picker min to tomorrow
  const datePicker = document.getElementById('booking-date');
  if (datePicker) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    datePicker.min = tomorrow.toISOString().split('T')[0];
    datePicker.value = tomorrow.toISOString().split('T')[0];
  }
});

// Guest Estimator & Package Recommender
function updateGuestRecommendation(count) {
  const countDisplay = document.getElementById('guest-count-display');
  const badgeDiv = document.getElementById('recommendation-badge');
  if (countDisplay) countDisplay.textContent = `${count} Guests`;

  const pkgClassic = document.getElementById('pkg-classic');
  const pkgGlow = document.getElementById('pkg-glow');
  const pkgMega = document.getElementById('pkg-mega');

  if (pkgClassic) pkgClassic.style.borderColor = 'var(--color-border)';
  if (pkgGlow) pkgGlow.style.borderColor = 'var(--logo-pink)';
  if (pkgMega) pkgMega.style.borderColor = 'var(--color-border)';

  if (count <= 20) {
    if (badgeDiv) badgeDiv.innerHTML = `💡 Recommended for ${count} guests: <strong>Classic Bubble Blast Package</strong> ($299 — 60 Mins)`;
    if (pkgClassic) pkgClassic.style.borderColor = 'var(--logo-teal)';
  } else if (count <= 45) {
    if (badgeDiv) badgeDiv.innerHTML = `💡 Recommended for ${count} guests: <strong>Ultimate Glow Rave Package</strong> ($399 — 90 Mins with UV Blacklight Cannons)`;
    if (pkgGlow) pkgGlow.style.borderColor = 'var(--logo-pink)';
  } else {
    if (badgeDiv) badgeDiv.innerHTML = `💡 Recommended for ${count} guests: <strong>Mega Community Festival Package</strong> ($599 — 2 Hours Dual Cannons for Large Crowds)`;
    if (pkgMega) pkgMega.style.borderColor = 'var(--logo-purple)';
  }
}

// Zip Code Availability Checker
function checkZipCode() {
  const zipInput = document.getElementById('hero-zip-input').value.trim();
  const resultDiv = document.getElementById('zip-result');

  if (!zipInput || zipInput.length < 5) {
    resultDiv.style.display = 'block';
    resultDiv.className = 'zip-result';
    resultDiv.style.background = 'rgba(255, 8, 116, 0.15)';
    resultDiv.style.borderColor = 'var(--logo-pink)';
    resultDiv.style.color = 'var(--logo-pink)';
    resultDiv.innerHTML = '⚠️ Please enter a 5-digit Dayton zip code (e.g. 45458).';
    return;
  }

  const locationName = daytonZipMap[zipInput] || 'Dayton Metro Area, OH';

  resultDiv.className = 'zip-result success';
  resultDiv.innerHTML = `
    <i class="fa-solid fa-circle-check"></i> <strong>EXCELLENT NEWS!</strong> Foam Bubble Parties delivers to <strong>${locationName}</strong> with <strong>$0 Travel Fee!</strong> <br>
    <span style="font-size: 0.85rem; opacity: 0.9;">🎁 Unlocked Coupon Code: <strong>BUBBLE25</strong> ($25 Off Auto-Applied at Booking)</span>
  `;

  // Pre-fill modal zip input
  const bookingZip = document.getElementById('booking-zip');
  if (bookingZip) bookingZip.value = zipInput;
}

// Package Selection & Add-on Calculator
function selectPackage(name, price) {
  currentPackageName = name;
  currentPackagePrice = price;
  updateLiveTotal();
  openBookingModal();

  const selectElem = document.getElementById('modal-package-select');
  if (selectElem) {
    for (let i = 0; i < selectElem.options.length; i++) {
      if (selectElem.options[i].value.includes(name) || selectElem.options[i].value === name) {
        selectElem.selectedIndex = i;
        break;
      }
    }
  }
}

function toggleAddon(element, name, price) {
  const checkbox = element.querySelector('.addon-checkbox');
  checkbox.checked = !checkbox.checked;

  if (checkbox.checked) {
    element.classList.add('active');
    selectedAddons.set(name, price);
  } else {
    element.classList.remove('active');
    selectedAddons.delete(name);
  }

  updateLiveTotal();
}

function updateLiveTotal() {
  let addonsSum = 0;
  selectedAddons.forEach((price) => { addonsSum += price; });

  const grandTotal = currentPackagePrice + addonsSum;
  const displayElem = document.getElementById('live-total-display');
  if (displayElem) {
    displayElem.textContent = `$${grandTotal}`;
  }
}

// Gallery Filtering
function filterGallery(category) {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');

  const items = document.querySelectorAll('.gallery-card');
  items.forEach(item => {
    if (category === 'all') {
      item.style.display = 'block';
    } else if (category === 'glow' && item.classList.contains('gallery-item-glow')) {
      item.style.display = 'block';
    } else if (category === 'day' && item.classList.contains('gallery-item-day')) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// FAQ Accordion
function toggleFaq(element) {
  const isActive = element.classList.contains('active');
  const allFaqs = document.querySelectorAll('.faq-item');
  allFaqs.forEach(item => item.classList.remove('active'));

  if (!isActive) {
    element.classList.add('active');
  }
}

// Booking Modal Controls
function openBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) {
    modal.classList.add('active');
    document.getElementById('modal-step-1').style.display = 'block';
    document.getElementById('modal-step-2').style.display = 'none';
  }
}

function openBookingModalWithCustoms() {
  openBookingModal();
}

function closeBookingModal() {
  const modal = document.getElementById('booking-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function submitBooking(event) {
  event.preventDefault();
  document.getElementById('modal-step-1').style.display = 'none';
  document.getElementById('modal-step-2').style.display = 'block';

  // Trigger Confetti Explosion!
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00d2df', '#ff0874', '#8a2be2', '#ffffff']
    });
  }
}

function toggleMobileMenu() {
  const nav = document.querySelector('.nav-links');
  if (nav.style.display === 'flex') {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'absolute';
    nav.style.top = '70px';
    nav.style.left = '0';
    nav.style.width = '100%';
    nav.style.background = '#ffffff';
    nav.style.padding = '20px';
    nav.style.borderBottom = '2px solid var(--logo-pink)';
    nav.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
  }
}
