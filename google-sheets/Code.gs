const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access Leads';

function doPost(event) {
  try {
    const parameters = (event && event.parameter) || {};
    verifyTurnstile(parameters['cf-turnstile-response']);
    const lead = validateLead(parameters);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Early Access Leads sheet is missing.');

    sheet.appendRow([
      new Date(),
      lead.name,
      lead.email,
      lead.phone,
      lead.zip,
      lead.eventType,
      lead.marketingConsent,
      'Website Early Access',
      'New',
      ''
    ]);

    return json({ success: true });
  } catch (error) {
    return json({ success: false, message: 'Unable to save submission.' });
  }
}

function verifyTurnstile(tokenValue) {
  const token = String(tokenValue || '').trim();
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!token || !secret) throw new Error('Turnstile verification failed.');

  let response;
  try {
    response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      muteHttpExceptions: true
    });
  } catch (error) {
    throw new Error('Turnstile verification failed.');
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Turnstile verification failed.');
  }

  try {
    if (JSON.parse(response.getContentText()).success !== true) {
      throw new Error('Turnstile verification failed.');
    }
  } catch (error) {
    throw new Error('Turnstile verification failed.');
  }
}

function validateLead(parameters) {
  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = String(parameters.phone || '').replace(/\D/g, '');
  const zip = String(parameters.zip || '').replace(/\D/g, '');
  const eventType = String(parameters.eventType || '').trim();

  if (name.length < 2 || !/[a-zA-Z]/.test(name)) throw new Error('Invalid name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (phoneDigits.length !== 10) throw new Error('Invalid phone.');
  if (zip.length !== 5) throw new Error('Invalid ZIP code.');
  if (!eventType) throw new Error('Invalid event type.');

  return {
    name,
    email,
    phone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
    zip,
    eventType,
    marketingConsent: parameters.marketingConsent === 'Yes' ? 'Yes' : 'No'
  };
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
