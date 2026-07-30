const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access';
const FIRST_LEAD_ROW = 6;
const SUBMITTED_COLUMN = 2; // Column B in the lead tracker.
const ZIP_COLUMN = 11; // Column K in the lead tracker.
const MARKETING_CONSENT_COLUMN = 14; // Column N in the lead tracker.

function doPost(event) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Create a sheet tab named "${SHEET_NAME}" first.`);

    const row = getFirstOpenLeadRow(sheet);
    sheet.getRange(row, SUBMITTED_COLUMN, 1, 6).setValues([[
      new Date(),
      event.parameter.name || '',
      event.parameter.email || '',
      event.parameter.phone || '',
      '',
      event.parameter.eventType || ''
    ]]);
    sheet.getRange(row, ZIP_COLUMN).setValue(event.parameter.zip || '');
    sheet.getRange(row, MARKETING_CONSENT_COLUMN).setValue(
      event.parameter.marketingConsent === 'Yes' ? 'Yes' : 'No'
    );

    return createJsonResponse({ success: true });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
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
