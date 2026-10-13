export function sessionSecret(): string | undefined {
  const value = process.env.PUSAFOKU_SESSION_SECRET;
  return value && value.length >= 32 ? value : undefined;
}

export function passwordHash(): string | undefined {
  return process.env.PUSAFOKU_PASSWORD_HASH || undefined;
}

export function supabaseConfig(): { url: string; key: string } | undefined {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith("https://")) return undefined;
  return { url: url.replace(/\/$/, ""), key };
}

export function cronSecret(): string | undefined {
  const value = process.env.CRON_SECRET;
  return value && value.length >= 24 ? value : undefined;
}

export function inboxToken(): string | undefined {
  const value = process.env.INBOX_TOKEN;
  return value && value.length >= 24 ? value : undefined;
}

export function calendarUrl(): string | undefined {
  return process.env.CALENDAR_ICS_URL || undefined;
}

export function googleConfig(): { clientId: string; clientSecret: string; refreshToken: string } | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return undefined;
  return { clientId, clientSecret, refreshToken };
}
