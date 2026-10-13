# PUSAFOKU

A private command centre for one person. It shows your tasks, notes, websites, news, calendar and approvals on one screen, in a dark green theme or a light paper theme, and answers short commands by typing or by voice.

## Four-line how-to

1. Open the site and log in with your password.
2. Press SETTINGS to set your name, language (English or Georgian) and city, then fill the panels: tasks in Operations, notes in Archive, websites in Network, news feeds in Signals, events or calendar addresses in Schedule.
3. Type or tap MIC and say a command: `start my day`, `network`, `sky`, `authorizations`.
4. Items other tools send to the inbox wait in Authorizations until you Approve, Edit or Reject them.

Each panel is explained in [MODULES.md](MODULES.md).

## Environment variables

Set these in Vercel under Settings, Environment Variables (Production, mark secrets as Sensitive), then redeploy. Locally, put them in `.env.local`, which is never committed. `.env.example` lists the names.

| Name | Needed | What it does |
| --- | --- | --- |
| `PUSAFOKU_PASSWORD_HASH` | yes | Hash of your login password. Make it with `node scripts/hash-password.mjs "your password"`. |
| `PUSAFOKU_SESSION_SECRET` | yes | Random text of 32 or more characters that signs the login cookie. |
| `SUPABASE_URL` | for stored data | Address of your database project. |
| `SUPABASE_SERVICE_ROLE_KEY` | for stored data | Secret key of your database project. Server only; never exposed to the browser. |
| `INBOX_TOKEN` | for the inbox | 24 or more characters. Other tools send it as `Authorization: Bearer <token>`. |
| `GOOGLE_CLIENT_ID` | for Messages | Client ID of your own Google OAuth app. |
| `GOOGLE_CLIENT_SECRET` | for Messages | Client secret of the same app. Server only. |
| `GOOGLE_REFRESH_TOKEN` | for Messages | Long-lived token for read-only Gmail access (metadata only). Server only. |
| `CRON_SECRET` | for the timer | 24 or more characters. The scheduled website check sends it. |
| `CALENDAR_ICS_URL` | optional | One extra calendar address. Calendars can also be connected inside the Schedule panel. |

A random value: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

## Setting it up

1. Create a database project and run `supabase/schema.sql` in its SQL editor. It creates every table with row level security on and no public access.
2. Create the Vercel project from this repository and add the variables above.
3. For the 30 minute website check, add two repository secrets in GitHub under Settings, Secrets and variables, Actions: `CRON_SECRET` (same value as in Vercel) and `SITE_URL` (your site address with no slash at the end). The workflow in `.github/workflows/monitor.yml` does the rest.
4. For Messages, create a Google OAuth app at console.cloud.google.com: new project, enable the Gmail API, set up the consent screen with yourself as the test user, then publish it (Audience, Publish app) so the token does not expire after 7 days. Create an OAuth client of type Web application with `https://developers.google.com/oauthplayground` as an authorized redirect address. In the OAuth Playground (gear icon), tick Use your own OAuth credentials, paste the client ID and secret, authorize only the scope `https://www.googleapis.com/auth/gmail.metadata`, exchange the code and copy the refresh token. Add the three `GOOGLE_` variables in Vercel and redeploy. The scope shows senders, subjects and dates only; it cannot read message bodies, send, delete or change anything.
5. Your name, language, city, time zone and currency are set with the SETTINGS button on the page. They are stored in the single row of the `settings` table.

## Commands

```
npm run dev        start locally
npm run build      production build
npm run test:unit  fast checks of the calendar, feed, validation and login code
npm test           build, then run every check including the security checks
```

## Security in short

- One password, checked on the server. The login cookie is HttpOnly, SameSite Strict and signed. Five wrong passwords lock the door for ten minutes.
- Every page and route except the login, the inbox and the timer needs a valid session. Writes also need a matching Origin header.
- The inbox and the timer have their own secrets, compared in constant time.
- The database is reachable only from the server with the service key. Row level security is on and forced, with no public policies.
- Website, feed and calendar addresses must be public https addresses. Private networks, IP addresses and unusual ports are refused, redirects are checked, and downloads are size and time limited.
- Voice recognition runs on the device only. If the browser cannot do that, the microphone stays off. Nothing is recorded.
- `npm test` fails if a secret reaches a browser file, a response or the repository.
