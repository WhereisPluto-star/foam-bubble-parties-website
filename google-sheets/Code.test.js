/* Run with: node google-sheets/Code.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createHandler() {
  const rows = [];
  const source = fs.readFileSync(`${__dirname}/Code.gs`, 'utf8');
  const factory = new Function('SpreadsheetApp', 'ContentService', `${source}\nreturn { doPost };`);
  const handler = factory(
    { openById: () => ({ getSheetByName: () => ({ appendRow: (row) => rows.push(row) }) }) },
    { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ body, setMimeType() { return this; } }) }
  );
  return { ...handler, rows };
}

const lead = {
  name: 'Jamie Taylor',
  email: 'jamie@example.com',
  phone: '(937) 555-1234',
  zip: '45402',
  eventType: 'Birthday party',
  marketingConsent: 'Yes'
};

const handler = createHandler();
const response = JSON.parse(handler.doPost({ parameter: lead }).body);

assert.deepEqual(response, { success: true });
assert.equal(handler.rows.length, 1, 'one valid submission should append exactly one row');
assert.deepEqual(handler.rows[0].slice(1), [
  'Jamie Taylor', 'jamie@example.com', '(937) 555-1234', '45402', 'Birthday party', 'Yes',
  'Website Early Access', 'New', ''
]);

console.log('Append-only Early Access integration test passed.');
