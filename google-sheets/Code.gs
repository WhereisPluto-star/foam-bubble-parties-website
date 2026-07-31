const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access';
const FIRST_LEAD_ROW = 6;
const SUBMITTED_COLUMN = 2; // Column B in the lead tracker.
const EMAIL_COLUMN = 4; // Column D in the lead tracker.
const ZIP_COLUMN = 11; // Column K in the lead tracker.
const MARKETING_CONSENT_COLUMN = 14; // Column N in the lead tracker.

function doPost(event) {
  try {
    const parameters = (event && event.parameter) || {};
    const lead = validateLead(parameters);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Create a sheet tab named "${SHEET_NAME}" first.`);
    if (hasExistingEmail(sheet, lead.email)) {
      return createJsonResponse({ success: false, error: 'This email is already on the early-access list.' });
    }

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
    sheet.getRange(row, MARKETING_CONSENT_COLUMN).setValue(
      lead.marketingConsent === 'Yes' ? 'Yes' : 'No'
    );

    return createJsonResponse({ success: true });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function validateLead(parameters) {
  if (String(parameters.website || '').trim()) {
    throw new Error('We could not verify this submission. Please try again.');
  }

  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = String(parameters.phone || '').replace(/\D/g, '');
  const zip = String(parameters.zip || '').trim();
  const eventType = String(parameters.eventType || '').trim();

  if (name.length < 2 || !/[a-zA-Z]/.test(name)) {
    throw new Error('Please enter your name.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (phoneDigits.length !== 10 || isObviousFakePhone(phoneDigits)) {
    throw new Error('Please enter a valid 10-digit U.S. phone number.');
  }
  if (!/^\d{5}$/.test(zip)) {
    throw new Error('Please enter a valid 5-digit ZIP code.');
  }
  if (!eventType) {
    throw new Error('Please select an event type.');
  }

  return {
    name,
    email,
    phone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
    zip,
    eventType,
    marketingConsent: parameters.marketingConsent
  };
}

function isObviousFakePhone(phoneDigits) {
  return /^(\d)\1{9}$/.test(phoneDigits)
    || ['0123456789', '1234567890', '9876543210'].includes(phoneDigits);
}

function hasExistingEmail(sheet, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_LEAD_ROW) return false;

  return sheet
    .getRange(FIRST_LEAD_ROW, EMAIL_COLUMN, lastRow - FIRST_LEAD_ROW + 1, 1)
    .getValues()
    .some(([existingEmail]) => String(existingEmail || '').trim().toLowerCase() === email);
}

function doGet(event) {
  if (event.parameter.action !== 'count') {
    return createJsonResponse({ success: false, error: 'Unknown action.' });
  }

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Create a sheet tab named "${SHEET_NAME}" first.`);

    const lastRow = sheet.getLastRow();
    const count = lastRow < FIRST_LEAD_ROW
      ? 0
      : sheet.getRange(FIRST_LEAD_ROW, SUBMITTED_COLUMN, lastRow - FIRST_LEAD_ROW + 1, 1)
        .getValues()
        .filter(([submittedAt]) => submittedAt)
        .length;

    return createJsonResponse({ success: true, count });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getFirstOpenLeadRow(sheet) {
  const availableRows = sheet.getMaxRows() - FIRST_LEAD_ROW + 1;
  const submittedValues = sheet
    .getRange(FIRST_LEAD_ROW, SUBMITTED_COLUMN, availableRows, 1)
    .getValues();
  const firstEmptyIndex = submittedValues.findIndex(([submittedAt]) => !submittedAt);

  if (firstEmptyIndex === -1) {
    throw new Error('The lead tracker is full. Add more rows before accepting new submissions.');
  }

  return FIRST_LEAD_ROW + firstEmptyIndex;
}
