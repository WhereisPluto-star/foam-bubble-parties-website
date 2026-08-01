# Connect the early-access form to Google Sheets

1. Create a Google Sheet and add one tab named `Early Access Leads`.
2. Add this header row, in this exact order: `Timestamp`, `Name`, `Email`, `Phone`, `ZIP Code`, `Event Type`, `Marketing Consent`, `Source`, `Status`, `Notes`.
3. In the Sheet, select **Extensions → Apps Script**. Replace the starter code with the contents of `Code.gs` and paste the Sheet ID into `SPREADSHEET_ID`. (The ID is the part of the Sheet URL between `/d/` and `/edit`.)
4. In Apps Script, select **Project Settings → Script properties**, add a property named `TURNSTILE_SECRET`, and set its value to the secret from your existing Cloudflare Turnstile widget. Do not place the secret in `Code.gs` or the website files.
5. Select **Deploy → New deployment → Web app**. Set **Execute as** to yourself and **Who has access** to Anyone. Deploy and authorize it.
6. Copy the Web app URL and paste it into `GOOGLE_SHEETS_WEB_APP_URL` at the top of `coming-soon.js`.

Each verified submission appends one simple export-ready row. If the Apps Script deployment is updated later, redeploy it and replace the URL only if Google provides a new one.
