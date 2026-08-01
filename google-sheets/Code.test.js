/* Run with: node google-sheets/Code.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createSheet() {
  const cells = new Map();
  const key = (row, column) => `${row}:${column}`;
  let openCalls = 0;

  const sheet = {
    getLastRow: () => Math.max(5, ...[...cells.keys()].map((entry) => Number(entry.split(':')[0]))),
    getMaxRows: () => 100,
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getValues: () => Array.from({ length: rowCount }, (_, rowOffset) => (
          Array.from({ length: columnCount }, (_, columnOffset) => cells.get(key(row + rowOffset, column + columnOffset)) || '')
        )),
        setValues: (values) => values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
          cells.set(key(row + rowOffset, column + columnOffset), value);
        })),
        setValue: (value) => cells.set(key(row, column), value)
      };
    }
  };

  return {
    open: () => { openCalls += 1; return { getSheetByName: () => sheet }; },
    count: () => [...cells.entries()].filter(([entry, value]) => entry.endsWith(':2') && value).length,
    get openCalls() { return openCalls; }
  };
}

function createHandler({ turnstile = { success: true }, secret = 'test-secret' } = {}) {
  const store = createSheet();
  const lock = { acquired: 0, released: 0, tryLock() { this.acquired += 1; return true; }, releaseLock() { this.released += 1; } };
  const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
  const factory = new Function('SpreadsheetApp', 'LockService', 'PropertiesService', 'UrlFetchApp', 'ContentService', `${source}\nreturn { doPost, doGet };`);
  const handler = factory(
    { openById: () => store.open() },
    { getScriptLock: () => lock },
    { getScriptProperties: () => ({ getProperty: () => secret }) },
    { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(turnstile) }) },
    { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ body, setMimeType() { return this; } }) }
  );
  return { ...handler, store, lock };
}

function lead(overrides = {}) {
  return {
    name: '  Jamie   Taylor ', email: 'JAMIE@EXAMPLE.COM ', phone: '(937) 555-1234', zip: '45402',
    eventType: 'Birthday party', 'cf-turnstile-response': 'test-token', ...overrides
  };
}

const result = (response) => JSON.parse(response.body);
const accepted = createHandler();

assert.deepEqual(result(accepted.doPost({ parameter: lead() })), { success: true, duplicate: false });
assert.equal(result(accepted.doGet({ parameter: { action: 'count' } })).count, 1);
assert.equal(result(accepted.doPost({ parameter: lead() })).duplicate, true, 'same person should be a duplicate');
assert.equal(result(accepted.doPost({ parameter: lead({ phone: '(513) 555-1212' }) })).duplicate, true, 'same email should be a duplicate');
assert.equal(result(accepted.doPost({ parameter: lead({ email: 'new@example.com', phone: '9375551234' }) })).duplicate, true, 'same phone should be a duplicate');
assert.equal(result(accepted.doGet({ parameter: { action: 'count' } })).count, 1, 'duplicates must not change the family count');
assert.equal(accepted.lock.acquired, 4);
assert.equal(accepted.lock.released, 4);

const missingToken = createHandler();
const withoutToken = lead();
delete withoutToken['cf-turnstile-response'];
assert.equal(result(missingToken.doPost({ parameter: withoutToken })).error, 'turnstile');
assert.equal(missingToken.store.openCalls, 0, 'missing token must not read or write the Sheet');

const invalidToken = createHandler({ turnstile: { success: false } });
assert.equal(result(invalidToken.doPost({ parameter: lead() })).error, 'turnstile');
assert.equal(invalidToken.store.openCalls, 0, 'invalid token must not read or write the Sheet');

console.log('Early Access integration tests passed.');
