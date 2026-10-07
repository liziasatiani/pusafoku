export function sessionSecret(): string | undefined {
  const value = process.env.PUSAFOKU_SESSION_SECRET;
  return value && value.length >= 32 ? value : undefined;
}

export function passwordHash(): string | undefined {
  return process.env.PUSAFOKU_PASSWORD_HASH || undefined;
}
