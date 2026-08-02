const SPREADSHEET_ID = '1WQBydVbWZVXUTO2f-Q-wS8cpd5HQTHmeU7c_fsJGnFU';
const SHEET_NAME = 'Early Access Leads';

function doPost(event) {
  const parameters = (event && event.parameter) || {};
  const token = String(parameters['cf-turnstile-response'] || '').trim();

  if (!token || !verifyTurnstile(token)) {
    return json({ success: false, stage: 'turnstile' });
  }

  let lead;
  try {
    lead = validateLead(parameters);
  } catch (error) {
    return json({ success: false, stage: 'validation' });
  }

  try {
    const result = saveLead(lead);
    return json({
      success: true,
      duplicate: result.duplicate,
      message: result.duplicate
        ? "You're already on the Early Access List!"
        : "You're on the Early Access List!"
    });
  } catch (error) {
    return json({ success: false, stage: 'save', message: 'Unable to save submission.' });
  }
}

function doGet() {
  try {
    const sheet = getLeadSheet();
    return json({ success: true, count: getLeadCount(sheet) });
  } catch (error) {
    return json({ success: false, count: 0 });
  }
}

function verifyTurnstile(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) return false;

  try {
    const response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret, response: token },
      muteHttpExceptions: true
    });
    const verification = JSON.parse(response.getContentText());
    return verification.success === true;
  } catch (error) {
    return false;
  }
}

function validateLead(parameters) {
  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = String(parameters.phone || '').replace(/\D/g, '');
  const zip = String(parameters.zip || '').replace(/\D/g, '');
  const eventType = String(parameters.eventType || '').trim();
  const marketingConsent = parameters.marketingConsent === 'Yes' ? 'Yes' : 'No';

  if (name.length < 2) throw new Error('Invalid name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (phoneDigits.length !== 10) throw new Error('Invalid phone.');
  if (zip.length !== 5) throw new Error('Invalid ZIP code.');
  if (!eventType || marketingConsent !== 'Yes') throw new Error('Invalid form data.');

  return { name, email, phoneDigits, zip, eventType, marketingConsent };
}

function saveLead(lead) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getLeadSheet();
    const lastRow = sheet.getLastRow();
    const existingLeads = lastRow > 1
      ? sheet.getRange(2, 3, lastRow - 1, 2).getValues()
      : [];
    const duplicate = existingLeads.some(([email, phone]) => (
      String(email || '').trim().toLowerCase() === lead.email
      || String(phone || '').replace(/\D/g, '') === lead.phoneDigits
    ));

    if (duplicate) return { duplicate: true };

    sheet.appendRow([
      new Date(),
      lead.name,
      lead.email,
      formatPhone(lead.phoneDigits),
      lead.zip,
      lead.eventType,
      lead.marketingConsent,
      'Website Early Access',
      'New',
      ''
    ]);

    return { duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function getLeadSheet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Early Access Leads sheet is missing.');
  return sheet;
}

function getLeadCount(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  return sheet.getRange(2, 1, lastRow - 1, 10).getValues()
    .filter((row) => row.slice(1, 7).some((value) => String(value || '').trim() !== ''))
    .length;
}

function formatPhone(digits) {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
