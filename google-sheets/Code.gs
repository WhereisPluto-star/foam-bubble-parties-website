const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access Leads';

function doPost(event) {
  console.log('[Early Access] Request received.');

  try {
    const parameters = runStep('Parameters parsed', () => (event && event.parameter) || {}, (value) => (
      `keys=${JSON.stringify(Object.keys(value).sort())}`
    ));
    runStep('Turnstile verification', () => verifyTurnstile(parameters['cf-turnstile-response']));
    const lead = runStep('Lead validation', () => validateLead(parameters));
    const spreadsheet = runStep('Spreadsheet opened', () => SpreadsheetApp.openById(SPREADSHEET_ID));
    const sheet = runStep('Sheet found', () => {
      const foundSheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!foundSheet) throw new Error('Early Access Leads sheet is missing.');
      return foundSheet;
    });
    runStep('Row append', () => sheet.appendRow([
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
    ]));

    return respond({ success: true });
  } catch (error) {
    logException('doPost', error);
    if (error && error.stage === 'turnstile') {
      return respond({
        success: false,
        stage: 'turnstile',
        errorCodes: error.errorCodes,
        hostname: error.hostname,
        action: error.action,
        cdata: error.cdata,
        message: 'Turnstile verification failed.'
      });
    }
    return respond({ success: false, message: 'Unable to save submission.' });
  }
}

function verifyTurnstile(tokenValue) {
  const token = String(tokenValue || '').trim();
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  console.log(`[Early Access] Turnstile inputs present: token=${Boolean(token)}, secret=${Boolean(secret)}.`);
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
    logException('Turnstile Siteverify request', error);
    throw new Error('Turnstile verification failed.');
  }

  console.log(`[Early Access] Turnstile Siteverify HTTP status: ${response.getResponseCode()}.`);
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Turnstile verification failed.');
  }

  let verification;
  try {
    verification = JSON.parse(response.getContentText());
  } catch (error) {
    logException('Turnstile Siteverify response', error);
    throw new Error('Turnstile verification failed.');
  }

  if (verification.success !== true) {
    const diagnostic = {
      errorCodes: Array.isArray(verification['error-codes']) ? verification['error-codes'] : [],
      hostname: String(verification.hostname || ''),
      action: String(verification.action || ''),
      cdata: String(verification.cdata || '')
    };
    console.log(`[Early Access] Turnstile failure diagnostics: ${JSON.stringify(diagnostic)}`);
    throw turnstileDiagnosticError(diagnostic);
  }
}

function turnstileDiagnosticError(diagnostic) {
  const error = new Error('Turnstile verification failed.');
  error.stage = 'turnstile';
  error.errorCodes = diagnostic.errorCodes;
  error.hostname = diagnostic.hostname;
  error.action = diagnostic.action;
  error.cdata = diagnostic.cdata;
  return error;
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

function runStep(name, operation, describeResult) {
  console.log(`[Early Access] ${name}: start.`);
  try {
    const result = operation();
    const details = describeResult ? ` ${describeResult(result)}` : '';
    console.log(`[Early Access] ${name}: complete.${details}`);
    return result;
  } catch (error) {
    logException(name, error);
    throw error;
  }
}

function logException(step, error) {
  const message = error && error.message ? error.message : String(error);
  const stack = error && error.stack ? error.stack : '[no stack available]';
  console.error(`[Early Access] ${step}: ${message}\n${stack}`);
}

function respond(data) {
  console.log(`[Early Access] JSON response returned: ${JSON.stringify(data)}`);
  return json(data);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
