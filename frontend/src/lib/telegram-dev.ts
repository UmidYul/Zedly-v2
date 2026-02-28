const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(data));
}

async function hmacSha256(secret: ArrayBuffer, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toHex(signature);
}

export interface DevTelegramInput {
  telegramId: number;
  firstName: string;
  username: string;
  botToken: string;
}

export async function buildDevTelegramAuthData(input: DevTelegramInput): Promise<Record<string, string>> {
  const authDate = String(Math.floor(Date.now() / 1000));
  const payload: Record<string, string> = {
    id: String(input.telegramId),
    first_name: input.firstName,
    username: input.username,
    auth_date: authDate
  };
  const dataCheckString = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join("\n");
  const secret = await sha256(input.botToken);
  const hash = await hmacSha256(secret, dataCheckString);
  return {
    ...payload,
    hash
  };
}
