/* Run with: node google-sheets/Code.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createSheet() {
  const cells = new Map();
  let openCalls = 0;

  function key(row, column) {
    return `${row}:${column}`;
  }

  const sheet = {
    getLastRow() {
      return Math.max(5, ...[...cells.keys()].map((entry) => Number(entry.split(':')[0])));
    },
    getMaxRows() {
      return 100;
    },
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getValues() {
          return Array.from({ length: rowCount }, (_, rowOffset) => (
            Array.from({ length: columnCount }, (_, columnOffset) => (
              cells.get(key(row + rowOffset, column + columnOffset)) || ''
            ))
          ));
        },
        setValues(values) {
          values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
            cells.set(key(row + rowOffset, column + columnOffset), value);
          }));
        },
        setValue(value) {
          cells.set(key(row, column), value);
        }
      };
    }
  };

  return {
    cells,
    sheet,
    get openCalls() { return openCalls; },
    open() {
      openCalls += 1;
      return { getSheetByName: () => sheet };
    },
    countLeads() {
      return [...cells.entries()].filter(([entry, value]) => entry.endsWith(':2') && value).length;
    }
  };
}

function createHandler(turnstileSuccess = true) {
  const store = createSheet();
  const lock = { acquired: 0, released: 0, tryLock() { this.acquired += 1; return true; }, releaseLock() { this.released += 1; } };
  const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
  const factory = new Function('SpreadsheetApp', 'LockService', 'PropertiesService', 'UrlFetchApp', 'ContentService', 'console', `${source}\nreturn { doPost, doGet };`);
  const handler = factory(
    { openById: () => store.open() },
    { getScriptLock: () => lock },
    { getScriptProperties: () => ({ getProperty: () => 'test-secret' }) },
    { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ success: turnstileSuccess }) }) },
    { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ body, setMimeType() { return this; } }) },
    console
  );
  return { ...handler, store, lock };
}

function lead(overrides = {}) {
  return {
    name: '  Jamie   Taylor ',
    email: 'JAMIE@EXAMPLE.COM ',
    phone: '(937) 555-1234',
    zip: '45402',
    eventType: 'Birthday party',
    'cf-turnstile-response': 'test-token',
    ...overrides
  };
}

function response(result) {
  return JSON.parse(result.body);
}

const accepted = createHandler();
assert.deepEqual(response(accepted.doPost({ parameter: lead() })), { success: true });
assert.equal(accepted.store.countLeads(), 1, 'new lead should add exactly one row');
assert.equal(response(accepted.doGet({ parameter: { action: 'count' } })).count, 1, 'new lead should increase the family count once');
assert.equal(accepted.lock.acquired, 1);
assert.equal(accepted.lock.released, 1);

assert.equal(response(accepted.doPost({ parameter: lead() })).duplicate, true, 'same information should be a duplicate');
assert.equal(accepted.store.countLeads(), 1, 'duplicate should not add a row or count');
assert.equal(response(accepted.doPost({ parameter: lead({ phone: '(513) 555-1212' }) })).duplicate, true, 'matching normalized email should be a duplicate');
assert.equal(response(accepted.doPost({ parameter: lead({ email: 'new@example.com', phone: '9375551234' }) })).duplicate, true, 'matching normalized phone should be a duplicate');
assert.equal(accepted.store.countLeads(), 1, 'all duplicate paths should leave the count unchanged');
assert.equal(response(accepted.doGet({ parameter: { action: 'count' } })).count, 1, 'duplicates should not inflate the family count');

const rejected = createHandler(false);
const failedVerification = response(rejected.doPost({ parameter: lead({ email: 'other@example.com' }) }));
assert.equal(failedVerification.success, false, 'failed Turnstile should be rejected');
assert.equal(rejected.store.openCalls, 0, 'failed Turnstile should not check or write the sheet');
assert.equal(rejected.store.countLeads(), 0, 'failed Turnstile should not affect the count');
assert.equal(rejected.lock.acquired, 0, 'failed Turnstile should not enter the duplicate-check lock');

console.log('Early Access duplicate-prevention tests passed.');
