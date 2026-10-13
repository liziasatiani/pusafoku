# Panels

Each panel is one module in `modules/`. A panel shows "not connected" until its data source is set up,. Every panel has a FILE button that opens its case file: what it is, when it last updated, how often it refreshes and which settings it needs.

## Settings
The SETTINGS button opens a form for your name, language (English or Georgian), currency and city. Choosing Georgian switches the whole screen: buttons, panel names, messages, the case files, the command answers and the date, and it also accepts Georgian commands such as `დღის დაწყება`, `ქსელი` and `ცა`. The login screen stays in English because the language is only known after you log in. Type a city, press FIND and pick the match: its coordinates and time zone are filled in for you, using Open-Meteo's place search. Saving updates the Clock greeting, the Sky weather, the time zone of Schedule and Archive times, and the default voice language. Messages that include a number limit (for example a maximum of 10 feeds) stay in English. Needs the database to save; without it the defaults are shown.

## Clock
Time, date and a greeting in your time zone, with your name from Settings. Updates every second in the browser.

## Sky
Current weather for the city in your Settings (Tbilisi by default) from Open-Meteo. Needs nothing. Refreshes every 15 minutes, cached for 10.

## Schedule
Today's events in your time zone, earliest first, all-day events at the top.
- **Your own events:** Add an event with a title, a date, optional start and end times and an optional repeat (every day, week, month or year). Delete from My events.
- **Connected calendars:** paste the address from Google, Apple, Outlook or any calendar app, up to 5. `webcal://` addresses work. Addresses are stored privately and never sent back to the browser.
- Handles time zones, events past midnight, repeats with counts, end dates and skipped dates, and leaves out cancelled events. A single moved occurrence of a repeating event still shows at its original time.
- Needs the database. Refreshes every 10 minutes; connected calendars are cached for 5.

## Operations
Your to-do list. Add a task, tick it off, delete it. Needs the database. Refreshes every minute.

## Archive
Short notes with the time they were saved. Add and delete. Needs the database. Refreshes every minute.

## Network
Websites you want watched, up to 20. Shows up or down and the response time. A page that answers with anything below 500 counts as up. Add a website by its full `https://` address, remove it with the cross, or press CHECK NOW. The scheduled check runs every 30 minutes through GitHub Actions and keeps 30 days of results. Needs the database and `CRON_SECRET`.

## Signals
Headlines from news feeds you add, up to 10 feeds. Reads RSS and Atom, shows the 12 newest across all feeds with their source and age, each linking to the article. Cached for 5 minutes. Needs the database.

## Authorizations
Items waiting for your decision. Other tools add an item:

```
curl -X POST https://your-site/api/inbox \
  -H "Authorization: Bearer $INBOX_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Reply to a customer","source":"store","draft":"Thanks for asking."}'
```

`title` is required (300 characters), `source` (80) and `draft` (8000) are optional. At most 200 items can wait, and 60 requests a minute are accepted.

You press Approve, Edit or Reject. Approving only marks the item approved and records the decision in the audit log. Nothing is sent anywhere. A tool can fetch what you approved with `GET /api/inbox` and the same token, then act on it itself. Needs the database and `INBOX_TOKEN`.

## Command line and voice
Under the globe. Commands: `start my day`, `authorizations`, `network`, `sky`, `schedule`, `operations`, `signals`, `archive`, `help`. Answers come only from your own panels; anything else gets "NO DATA ON FILE". MIC listens for one phrase after a tap, only when the browser can understand speech on the device. SPEAK REPLIES reads answers with a voice installed on the device. EN and KA choose the language.

## Adding a panel
Create `modules/<name>/index.tsx` exporting a module definition (manifest, Panel, `lines` for the command line), add it to `modules/registry.ts`, and add a loader to `lib/server/modules.ts` if it needs server data.
