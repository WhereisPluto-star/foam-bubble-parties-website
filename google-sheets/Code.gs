const SPREADSHEET_ID = '1WQBydVbWZVXUTO2f-Q-wS8cpd5HQTHmeU7c_fsJGnFU';
const SHEET_NAME = 'Early Access Leads';

function doPost(event) {
  try {
    const lead = validateLead((event && event.parameter) || {});
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    if (!sheet) throw new Error('Early Access Leads sheet is missing.');

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

  if (name.length < 2) throw new Error('Invalid name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (phoneDigits.length !== 10) throw new Error('Invalid phone.');
  if (zip.length !== 5) throw new Error('Invalid ZIP code.');
  if (!eventType || marketingConsent !== 'Yes') throw new Error('Invalid form data.');

  return { name, email, phoneDigits, zip, eventType, marketingConsent };
}

function formatPhone(digits) {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
