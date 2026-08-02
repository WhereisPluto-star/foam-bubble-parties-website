/* Run with: node google-sheets/Code.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createHandler({ turnstileSuccess = true } = {}) {
  const rows = [];
  const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
  const factory = new Function(
    'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'LockService', 'ContentService',
    `${source}\nreturn { doPost, doGet };`
  );
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: (row, column, numberOfRows, numberOfColumns) => ({
      getValues: () => rows.slice(row - 2, row - 2 + numberOfRows)
        .map((values) => values.slice(column - 1, column - 1 + numberOfColumns))
    }),
    appendRow: (values) => rows.push(values)
  };
  const handler = factory(
    { openById: () => ({ getSheetByName: () => sheet }) },
    { getScriptProperties: () => ({ getProperty: () => 'test-secret' }) },
    { fetch: () => ({ getContentText: () => JSON.stringify({ success: turnstileSuccess }) }) },
    { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ body, setMimeType() { return this; } }) }
  );
  return { ...handler, rows };
}

function lead(overrides = {}) {
  return {
    name: '  Jamie   Taylor ',
    email: 'JAMIE@EXAMPLE.COM ',
    phone: '(937) 555-1234',
    zip: '45402',
    eventType: 'Birthday Party',
    marketingConsent: 'Yes',
    'cf-turnstile-response': 'test-token',
    ...overrides
  };
}

const result = (response) => JSON.parse(response.body);
const accepted = createHandler();
assert.deepEqual(result(accepted.doPost({ parameter: lead() })), {
  success: true,
  duplicate: false,
  message: "You're on the Early Access List!"
});
assert.equal(accepted.rows.length, 1, 'a new valid lead appends exactly one row');
assert.deepEqual(accepted.rows[0].slice(1), [
  'Jamie Taylor', 'jamie@example.com', '(937) 555-1234', '45402', 'Birthday Party', 'Yes',
  'Website Early Access', 'New', ''
]);
assert.deepEqual(result(accepted.doGet()), { success: true, count: 1 });

assert.equal(result(accepted.doPost({ parameter: lead({ phone: '(513) 444-9999' }) })).duplicate, true);
assert.equal(accepted.rows.length, 1, 'a matching email does not append a second row');
assert.equal(result(accepted.doPost({ parameter: lead({ email: 'other@example.com' }) })).duplicate, true);
assert.equal(accepted.rows.length, 1, 'a matching phone does not append a second row');

const invalid = createHandler();
assert.equal(result(invalid.doPost({ parameter: lead({ email: 'not-an-email' }) })).stage, 'validation');
assert.equal(result(invalid.doPost({ parameter: lead({ phone: '937-55' }) })).stage, 'validation');
assert.equal(result(invalid.doPost({ parameter: lead({ zip: '4540' }) })).stage, 'validation');
assert.equal(result(invalid.doPost({ parameter: lead({ marketingConsent: 'No' }) })).stage, 'validation');
assert.equal(invalid.rows.length, 0, 'invalid fields never append a row');

const rejected = createHandler({ turnstileSuccess: false });
assert.equal(result(rejected.doPost({ parameter: lead() })).stage, 'turnstile');
assert.equal(rejected.rows.length, 0, 'a rejected Turnstile token never appends a row');
const missingToken = createHandler();
const noToken = lead();
delete noToken['cf-turnstile-response'];
assert.equal(result(missingToken.doPost({ parameter: noToken })).stage, 'turnstile');
assert.equal(missingToken.rows.length, 0, 'a missing Turnstile token never appends a row');

console.log('Early Access integration tests passed.');
