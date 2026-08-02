/* Run with: node google-sheets/Code.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createHandler(turnstileResult = { success: true }) {
  const rows = [];
  const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
  const factory = new Function('SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'ContentService', `${source}\nreturn { doPost };`);
  const handler = factory(
    { openById: () => ({ getSheetByName: () => ({ appendRow: (row) => rows.push(row) }) }) },
    { getScriptProperties: () => ({ getProperty: () => 'test-secret' }) },
    { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(turnstileResult) }) },
    { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ body, setMimeType() { return this; } }) }
  );
  return { ...handler, rows };
}

function lead(overrides = {}) {
  return {
    name: '  Jamie   Taylor ', email: 'JAMIE@EXAMPLE.COM ', phone: '(937) 555-1234', zip: '45402',
    eventType: 'Birthday party', marketingConsent: 'Yes', source: 'Website Early Access', status: 'New',
    'cf-turnstile-response': 'test-token', ...overrides
  };
}

const result = (response) => JSON.parse(response.body);
const accepted = createHandler();
assert.deepEqual(result(accepted.doPost({ parameter: lead() })), { success: true });
assert.equal(accepted.rows.length, 1, 'one valid submission should append one row');
assert.deepEqual(accepted.rows[0].slice(1), [
  'Jamie Taylor', 'jamie@example.com', '(937) 555-1234', '45402', 'Birthday party', 'Yes',
  'Website Early Access', 'New', ''
]);

const rejected = createHandler({
  success: false,
  'error-codes': ['invalid-input-response'],
  hostname: 'www.foambubbleparties.com',
  action: 'turnstile-spin-v2',
  cdata: ''
});
assert.deepEqual(result(rejected.doPost({ parameter: lead() })), {
  success: false,
  stage: 'turnstile',
  errorCodes: ['invalid-input-response'],
  hostname: 'www.foambubbleparties.com',
  action: 'turnstile-spin-v2',
  cdata: '',
  message: 'Turnstile verification failed.'
});
assert.equal(rejected.rows.length, 0, 'failed Turnstile should not append a row');

const missingToken = createHandler();
const withoutToken = lead();
delete withoutToken['cf-turnstile-response'];
const missingTokenResponse = result(missingToken.doPost({ parameter: withoutToken }));
assert.equal(missingTokenResponse.success, false);
assert.equal(missingTokenResponse.message, 'Turnstile verification failed.');
assert.match(missingTokenResponse.stack, /verifyTurnstile/);
assert.equal(missingToken.rows.length, 0, 'missing Turnstile token should not append a row');

console.log('Minimal Early Access integration tests passed.');
