const SPREADSHEET_ID = '1HlOOeIg6Ggc8FgAN3GtPIX_3MBW2Mi9GHEU0m2S69Wg';
const SHEET_NAME = 'Early Access';
const FIRST_LEAD_ROW = 6;
const SUBMITTED_COLUMN = 2; // Column B in the lead tracker.
const EMAIL_COLUMN = 4; // Column D in the lead tracker.
const PHONE_COLUMN = 5; // Column E in the lead tracker.
const ZIP_COLUMN = 11; // Column K in the lead tracker.
const MARKETING_CONSENT_COLUMN = 14; // Column N in the lead tracker.
const TURNSTILE_SECRET_PROPERTY = 'TURNSTILE_SECRET';

function doPost(event) {
  const parameters = (event && event.parameter) || {};
  const diagnosticLead = normalizeLeadForDiagnostics(parameters);
  let validationPassed = false;
  let turnstileVerified = false;

  logIncomingDiagnostics(parameters, diagnosticLead);

  try {
    let lead;
    try {
      lead = validateLead(parameters);
    } catch (error) {
      throw createDiagnosticError('validation', 'Submission validation failed.');
    }
    validationPassed = true;
    verifyTurnstile(parameters);
    turnstileVerified = true;
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw createDiagnosticError('duplicate-check', 'The early-access list is busy. Please try again shortly.');
    }

    try {
      let sheet;
      let duplicateCheck;
      try {
        sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
        if (!sheet) throw new Error('Early Access sheet is unavailable.');
        duplicateCheck = findExistingLead(sheet, lead);
      } catch (error) {
        throw createDiagnosticError('duplicate-check', 'We could not check the Early Access List.');
      }
      logDuplicateCheck(diagnosticLead, duplicateCheck);
      if (duplicateCheck.duplicate) {
        logFinalDecision('duplicate');
        return createJsonResponse({
          success: true,
          duplicate: true,
          message: "You're already on the Early Access List!"
        });
      }

      try {
        const row = getFirstOpenLeadRow(sheet);
        logFinalDecision('accepted');
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
      } catch (error) {
        throw createDiagnosticError('sheet-write', 'We could not save your details. Please try again shortly.');
      }

      return createJsonResponse({ success: true });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (!turnstileVerified) {
      logSkippedDuplicateCheck();
    }
    const stage = error.stage || (!validationPassed
      ? 'validation'
      : !turnstileVerified
        ? 'turnstile'
        : 'unexpected');
    const decision = stage === 'validation'
      ? 'validation failed'
      : ['missing-token', 'missing-secret', 'siteverify-request', 'siteverify-response', 'turnstile'].includes(stage)
        ? 'Turnstile failed'
        : 'other error';
    logFinalDecision(decision);
    console.error(`Early Access submission error stage: ${stage}`);
    return createJsonResponse({
      success: false,
      stage,
      errorCodes: safeErrorCodes(error.errorCodes),
      message: error.publicMessage || 'We could not save your details. Please try again shortly.'
    });
  }
}

function verifyTurnstile(parameters) {
  const token = String(parameters['cf-turnstile-response'] || '').trim();
  if (!token) {
    throw createDiagnosticError('missing-token', 'Turnstile token is missing.');
  }

  // Apps Script has no process.env. Store this secret in Script Properties under
  // TURNSTILE_SECRET so it is never committed to this project.
  const secret = PropertiesService.getScriptProperties().getProperty(TURNSTILE_SECRET_PROPERTY);
  if (!secret) {
    console.error('TURNSTILE_SECRET is not configured in Script Properties.');
    throw createDiagnosticError('missing-secret', 'Turnstile verification is unavailable.');
  }

  let response;
  try {
    response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
      muteHttpExceptions: true
    });
  } catch (error) {
    console.error('Turnstile siteverify request failed.');
    throw createDiagnosticError('siteverify-request', 'Turnstile verification is unavailable.');
  }

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    console.error(`Turnstile siteverify response status: ${response.getResponseCode()}`);
    throw createDiagnosticError('siteverify-response', 'Turnstile verification is unavailable.');
  }

  let verification;
  try {
    verification = JSON.parse(response.getContentText());
  } catch (error) {
    console.error('Turnstile siteverify response could not be parsed.');
    throw createDiagnosticError('siteverify-response', 'Turnstile verification is unavailable.');
  }

  if (verification.success !== true) {
    const errorCodes = safeErrorCodes(verification['error-codes']);
    console.warn(`Turnstile rejected submission: ${JSON.stringify(errorCodes)}`);
    throw createDiagnosticError('turnstile', 'Turnstile verification failed.', errorCodes);
  }
}

function createDiagnosticError(stage, message, errorCodes = []) {
  const error = new Error(message);
  error.stage = stage;
  error.publicMessage = message;
  error.errorCodes = safeErrorCodes(errorCodes);
  return error;
}

function safeErrorCodes(errorCodes) {
  return Array.isArray(errorCodes)
    ? errorCodes.filter((code) => typeof code === 'string').slice(0, 5)
    : [];
}

function validateLead(parameters) {
  if (String(parameters.website || '').trim()) {
    throw new Error('We could not verify this submission. Please try again.');
  }

  const name = String(parameters.name || '').trim().replace(/\s+/g, ' ');
  const email = String(parameters.email || '').trim().toLowerCase();
  const phoneDigits = normalizePhone(parameters.phone);
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

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function findExistingLead(sheet, lead) {
  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_LEAD_ROW) {
    return { duplicate: false, rowsScanned: 0, emailMatch: false, phoneMatch: false };
  }

  const leads = sheet
    .getRange(FIRST_LEAD_ROW, EMAIL_COLUMN, lastRow - FIRST_LEAD_ROW + 1, PHONE_COLUMN - EMAIL_COLUMN + 1)
    .getValues();
  const emailMatch = leads.some(([existingEmail]) => (
    String(existingEmail || '').trim().toLowerCase() === lead.email
  ));
  const phoneMatch = leads.some(([, existingPhone]) => (
    normalizePhone(existingPhone) === normalizePhone(lead.phone)
  ));

  return {
    duplicate: emailMatch || phoneMatch,
    rowsScanned: leads.length,
    emailMatch,
    phoneMatch
  };
}

function normalizeLeadForDiagnostics(parameters) {
  return {
    email: String(parameters.email || '').trim().toLowerCase(),
    phone: normalizePhone(parameters.phone)
  };
}

function logIncomingDiagnostics(parameters, lead) {
  console.log(`Incoming parameter names: ${JSON.stringify(Object.keys(parameters).sort())}`);
  console.log(`Turnstile token received: ${Boolean(String(parameters['cf-turnstile-response'] || '').trim())}`);
  console.log(`Normalized email: ${maskEmail(lead.email)}`);
  console.log(`Normalized phone: ${maskPhone(lead.phone)}`);
  console.log(`Sheet name to open: ${SHEET_NAME}`);
  console.log(`Duplicate columns: email D (${EMAIL_COLUMN}), phone E (${PHONE_COLUMN})`);
}

function logDuplicateCheck(lead, duplicateCheck) {
  console.log(`Existing rows scanned: ${duplicateCheck.rowsScanned}`);
  console.log(`Email match found: ${duplicateCheck.emailMatch}`);
  console.log(`Phone match found: ${duplicateCheck.phoneMatch}`);
  console.log(`Duplicate check values: email ${maskEmail(lead.email)}, phone ${maskPhone(lead.phone)}`);
}

function logSkippedDuplicateCheck() {
  console.log('Existing rows scanned: 0 (not checked)');
  console.log('Email match found: not checked');
  console.log('Phone match found: not checked');
}

function logFinalDecision(decision) {
  console.log(`Final decision: ${decision}`);
}

function maskEmail(email) {
  if (!email) return '[empty]';
  const [localPart, domain = ''] = email.split('@');
  return `${localPart.slice(0, 1) || '*'}***${domain ? `@${domain}` : ''}`;
}

function maskPhone(phone) {
  if (!phone) return '[empty]';
  return `***-***-${phone.slice(-4)}`;
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
