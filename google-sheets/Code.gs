const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access';
const FIRST_LEAD_ROW = 6;
const SUBMITTED_COLUMN = 2; // Column B in the lead tracker.
const EMAIL_COLUMN = 4; // Column D in the lead tracker.
const PHONE_COLUMN = 5; // Column E in the lead tracker.
const ZIP_COLUMN = 11; // Column K in the lead tracker.
const MARKETING_CONSENT_COLUMN = 14; // Column N in the lead tracker.

function doPost(event) {
  try {
    const parameters = (event && event.parameter) || {};
    verifyTurnstile(parameters['cf-turnstile-response']);
    const lead = normalizeLead(parameters);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw submissionError('server');
    }

    try {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) throw submissionError('server');

      if (hasDuplicateLead(sheet, lead)) {
        return json({
          success: true,
          duplicate: true,
          message: "You're already on the Early Access List!"
        });
      }

      writeLead(sheet, lead);
      return json({ success: true, duplicate: false });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({
      success: false,
      error: error && error.code === 'turnstile' ? 'turnstile' : 'server'
    });
  }
}

function doGet(event) {
  if (!event || !event.parameter || event.parameter.action !== 'count') {
    return json({ success: false, error: 'server' });
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Early Access sheet is unavailable.');

    const lastRow = sheet.getLastRow();
    const count = lastRow < FIRST_LEAD_ROW
      ? 0
      : sheet.getRange(FIRST_LEAD_ROW, SUBMITTED_COLUMN, lastRow - FIRST_LEAD_ROW + 1, 1)
        .getValues()
        .filter(([submittedAt]) => submittedAt)
        .length;

    return json({ success: true, count });
  } catch (error) {
    return json({ success: false, error: 'server' });
  }
}

function verifyTurnstile(tokenValue) {
  const token = String(tokenValue || '').trim();
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!token || !secret) throw submissionError('turnstile');

  let response;
  try {
    response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      muteHttpExceptions: true
    });
  } catch (error) {
    throw submissionError('turnstile');
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw submissionError('turnstile');
  }

  try {
    if (JSON.parse(response.getContentText()).success !== true) {
      throw submissionError('turnstile');
    }
  } catch (error) {
    throw submissionError('turnstile');
  }
}

function normalizeLead(parameters) {
  if (String(parameters.website || '').trim()) throw submissionError('server');

  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = String(parameters.phone || '').replace(/\D/g, '');
  const zip = String(parameters.zip || '').replace(/\D/g, '');
  const eventType = String(parameters.eventType || '').trim();

  if (name.length < 2 || !/[a-zA-Z]/.test(name)) throw submissionError('server');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw submissionError('server');
  if (phoneDigits.length !== 10 || isObviousFakePhone(phoneDigits)) throw submissionError('server');
  if (zip.length !== 5) throw submissionError('server');
  if (!eventType) throw submissionError('server');

  return {
    name,
    email,
    phoneDigits,
    phone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
    zip,
    eventType,
    marketingConsent: parameters.marketingConsent === 'Yes' ? 'Yes' : 'No'
  };
}

function hasDuplicateLead(sheet, lead) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_LEAD_ROW) return false;

  return sheet
    .getRange(FIRST_LEAD_ROW, EMAIL_COLUMN, lastRow - FIRST_LEAD_ROW + 1, PHONE_COLUMN - EMAIL_COLUMN + 1)
    .getValues()
    .some(([existingEmail, existingPhone]) => (
      String(existingEmail || '').trim().toLowerCase() === lead.email
      || String(existingPhone || '').replace(/\D/g, '') === lead.phoneDigits
    ));
}

function writeLead(sheet, lead) {
  const row = getFirstOpenLeadRow(sheet);
  sheet.getRange(row, SUBMITTED_COLUMN, 1, 6).setValues([[
    new Date(),
    lead.name,
    lead.email,
    lead.phone,
    '',
    lead.eventType
  ]]);
  sheet.getRange(row, ZIP_COLUMN).setValue(lead.zip);
  sheet.getRange(row, MARKETING_CONSENT_COLUMN).setValue(lead.marketingConsent);
}

function getFirstOpenLeadRow(sheet) {
  const availableRows = sheet.getMaxRows() - FIRST_LEAD_ROW + 1;
  const submittedValues = sheet
    .getRange(FIRST_LEAD_ROW, SUBMITTED_COLUMN, availableRows, 1)
    .getValues();
  const firstEmptyIndex = submittedValues.findIndex(([submittedAt]) => !submittedAt);

  if (firstEmptyIndex === -1) throw submissionError('server');
  return FIRST_LEAD_ROW + firstEmptyIndex;
}

function isObviousFakePhone(phoneDigits) {
  return /^(\d)\1{9}$/.test(phoneDigits)
    || ['0123456789', '1234567890', '9876543210'].includes(phoneDigits);
}

function submissionError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

