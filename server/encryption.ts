import crypto from "crypto";

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex)
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for email encryption"
    );
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32)
    throw new Error(
      "ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)"
    );
  return key;
}

// AES-256-GCM encryption. Output format: "ivHex:authTagHex:ciphertextHex"
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptField(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted field format");
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8"
  );
}

// HMAC-SHA256 — deterministic, case-insensitive, used for DB lookups
export function hashField(plaintext: string): string {
  const key = getKey();
  return crypto
    .createHmac("sha256", key)
    .update(plaintext.toLowerCase().trim())
    .digest("hex");
}

// Safely decrypt — returns plaintext as-is if it doesn't look encrypted.
// Handles migration window where some values may still be plaintext.
export function safeDecryptField(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  if (!value.includes(":")) return value; // plaintext (pre-migration)
  try {
    return decryptField(value);
  } catch {
    return value; // fallback if decryption fails
  }
}

// Apply to any object with email / campusEmail fields before returning to callers
export function decryptUserEmails<
  T extends { email: string; campusEmail?: string | null }
>(user: T): T {
  return {
    ...user,
    email: (safeDecryptField(user.email) ?? user.email) as string,
    campusEmail:
      user.campusEmail != null
        ? (safeDecryptField(user.campusEmail) as string)
        : user.campusEmail,
  };
}
