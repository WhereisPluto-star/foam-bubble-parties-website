# Connect the early-access form to Google Sheets

1. Create a Google Sheet and add a tab named `Early Access`.
2. Add this header row: `Submitted at`, `Name`, `Email`, `Phone`, `Event type`.
3. In the Sheet, select **Extensions → Apps Script**. Replace the starter code with the contents of `Code.gs` and paste the Sheet ID into `SPREADSHEET_ID`. (The ID is the part of the Sheet URL between `/d/` and `/edit`.)
4. Select **Deploy → New deployment → Web app**. Set **Execute as** to yourself and **Who has access** to Anyone. Deploy and authorize it.
5. Copy the Web app URL and paste it into `GOOGLE_SHEETS_WEB_APP_URL` at the top of `coming-soon.js`.

Submissions will then append to the Sheet. If the Apps Script deployment is updated later, redeploy it and replace the URL only if Google provides a new one.
