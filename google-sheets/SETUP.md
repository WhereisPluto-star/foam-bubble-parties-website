# Connect the early-access form to Google Sheets

1. Create a Google Sheet and add one tab named `Early Access Leads`.
2. Use the existing `Early Access Leads` tab and this exact header row, in this exact order: `Timestamp`, `Full Name`, `Email`, `Phone`, `ZIP Code`, `Event Type`, `Marketing Consent`, `Source`, `Status`, `Notes`.
3. In the Sheet, select **Extensions → Apps Script** and replace the starter code with the contents of `Code.gs`. The new spreadsheet ID is already set in that file.
4. In Apps Script, select **Project Settings → Script properties**, add a property named `TURNSTILE_SECRET`, and set its value to the secret from your existing Cloudflare Turnstile widget. Do not place the secret in `Code.gs` or the website files.
5. Select **Deploy → Manage deployments**, edit the existing Web app, select **New version**, and deploy it. Set **Execute as** to yourself and **Who has access** to Anyone.
6. The current Web app URL is already set in `coming-soon.js`; do not change it unless Google gives you a new `/exec` URL.

Each verified submission appends one simple export-ready row. If the Apps Script deployment is updated later, redeploy it and replace the URL only if Google provides a new one.
