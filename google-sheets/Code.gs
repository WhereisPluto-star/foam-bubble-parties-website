const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access Leads';

function doPost(event) {
  try {
    const lead = validateLead((event && event.parameter) || {});
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

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

function validateLead(parameters) {
  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = String(parameters.phone || '').replace(/\D/g, '');
  const zip = String(parameters.zip || '').replace(/\D/g, '');
  const eventType = String(parameters.eventType || '').trim();
  const marketingConsent = parameters.marketingConsent === 'Yes' ? 'Yes' : 'No';

  if (name.length < 2 || !/[a-zA-Z]/.test(name)) throw new Error('Invalid name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (phoneDigits.length !== 10) throw new Error('Invalid phone.');
  if (zip.length !== 5) throw new Error('Invalid ZIP code.');
  if (!eventType) throw new Error('Invalid event type.');
  if (marketingConsent !== 'Yes') throw new Error('Marketing consent is required.');

  return {
    name,
    email,
    phone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
    zip,
    eventType,
    marketingConsent
  };
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
