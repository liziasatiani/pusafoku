# Panels

Each panel is one module in `modules/`. A panel shows "not connected" until its data source is set up,. Every panel has a FILE button that opens its case file: what it is, when it last updated, how often it refreshes and which settings it needs.

## Pages
Six pages, chosen with the tabs under the title (at the bottom of the screen on a phone): HOME has the clock, sky, schedule, operations and messages around the globe and command line; TODAY has the day as a timeline; STUDY has the schedule and operations; WORK has signals, network and authorizations; MAP has the world map; ARCHIVE has the archive. The page is kept in the address (`#work`), so a reload or a bookmark opens the same page. The command line is on every page, and the WALL and LINE switch only appears on HOME. Each panel belongs to one or more pages through the `pages` list in its manifest.

## Settings
The SETTINGS button opens a form for your name, language (English or Georgian), currency and city. Choosing Georgian switches the whole screen: buttons, panel names, messages, the case files, the command answers and the date, and it also accepts Georgian commands such as `დღის დაწყება`, `ქსელი` and `ცა`. The login screen stays in English because the language is only known after you log in. Type a city, press FIND and pick the match: its coordinates and time zone are filled in for you, using Open-Meteo's place search. Saving updates the Clock greeting, the Sky weather, the time zone of Schedule and Archive times, and the default voice language. Messages that include a number limit (for example a maximum of 10 feeds) stay in English. Needs the database to save; without it the defaults are shown.

## Clock
Time, date and a greeting in your time zone, with your name from Settings. Updates every second in the browser.

## Sky
Current weather for the city in your Settings (Tbilisi by default) from Open-Meteo. Needs nothing. Refreshes every 15 minutes, cached for 10.

## Schedule
Today's events in your time zone, earliest first, all-day events at the top.
- **Your own events:** Add an event with a title, a date, optional start and end times, an optional room and an optional repeat (every day, week, month or year). A repeating event can have a Repeats until date, so a class stops at the end of the term. Delete from My events.
- **Timetable:** add each class once as a weekly event with its room and the last day of the term. When the next term starts, open Move classes to the next term and enter the number of weeks to move forward (26 by default). Every weekly class with an end date moves by that many whole weeks, so weekdays stay the same, and its hidden days move with it.
- **Hide classes on certain days:** pick a first and last day (up to 62 days) and every weekly class with an end date is hidden on those days, for example during midterms or a holiday. One-off events such as exams are not affected. SHOW ALL CLASSES brings them back.
- **Connected calendars:** paste the address from Google, Apple, Outlook or any calendar app, up to 5. `webcal://` addresses work. Addresses are stored privately and never sent back to the browser.
- Handles time zones, events past midnight, repeats with counts, end dates and skipped dates, and leaves out cancelled events. A single moved occurrence of a repeating event still shows at its original time.
- Needs the database. Refreshes every 10 minutes; connected calendars are cached for 5.

## Operations
Your to-do list. Add a task, tick it off, delete it. Needs the database. Refreshes every minute.

## Archive
Short notes with the time they were saved. Add and delete. Needs the database. Refreshes every minute.

## Network
Websites you want watched, up to 20. Shows up or down and the response time. A page that answers with anything below 500 counts as up. Add a website by its full `https://` address, remove it with the cross, or press CHECK NOW. The scheduled check runs every 30 minutes from an outside timer (see README.md) and keeps 30 days of results. Needs the database and `CRON_SECRET`.

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

## Messages
Your unread Gmail: the count plus the sender, subject and time of the newest unread messages, each linking to the message in Gmail. It uses Google's read-only metadata permission, so it can see who wrote and the subject but never the message text, and it cannot send, delete or change anything. Nothing is stored in the database; messages are fetched live and cached for one minute. Needs the three `GOOGLE_` variables in README.md. Refreshes every two minutes. Say `messages` or `email` in the command line.

## Today
The day on one page, in your city's time zone. A headline says what is on now or what comes next and how long until it. Under it is a timeline of today's classes and events (from Schedule), the free gaps of 30 minutes or more between 07:00 and 22:00, and your open Operations placed into those gaps as 45 minute FOCUS blocks, in the order you added them. Past items fade and the current one is outlined. Tasks that do not fit are counted, and you can tick, add and finish tasks right on the page. Weather, unread email and total free time are summarised under the headline. Nothing is stored: the plan is worked out each time from the schedule and the task list, so moving a class or ticking a task changes it at once. An event with no end time counts as an hour. Say `plan`, `free time` or `what's next` in the command line.

## Map
A zoomable world map drawn on the device from Natural Earth country outlines (public domain, via the `world-atlas` package, bundled in the app so no map server is contacted). Drag to move, scroll or pinch to zoom up to 60 times, double-click to zoom in, use the + − ⌂ buttons, or the arrow keys, plus, minus and 0 on a keyboard. The shaded area is night and the dot is the sun's position, both worked out from the clock. Your city from SETTINGS is marked; tap anywhere to read its coordinates. Type a place under the map, press FIND, then FLY by tapping the result or PIN to keep it. Pins live in the `places` table (up to 100) and are listed under the map; tap one to fly there, or ✕ to remove it. Needs the database for pins; the map itself works without it. Say `map` or `places` in the command line.

## Command line and voice
Under the globe. Commands: `start my day`, `authorizations`, `network`, `sky`, `schedule`, `operations`, `signals`, `archive`, `help`. Answers come only from your own panels; anything else gets "NO DATA ON FILE". MIC listens for one phrase after a tap, only when the browser can understand speech on the device. SPEAK REPLIES reads answers with a voice installed on the device. EN and KA choose the language.

## Adding a panel
Create `modules/<name>/index.tsx` exporting a module definition (manifest, Panel, `lines` for the command line), add it to `modules/registry.ts`, and add a loader to `lib/server/modules.ts` if it needs server data.
