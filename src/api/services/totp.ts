import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { totpConfig } from "../../config.js";
import { supabase } from "../supabase.js";

// --------------- Encriptacao (AES-256-GCM) ---------------

function getEncryptionKey(): Buffer {
  const hex = totpConfig.encryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error("TOTP_ENCRYPTION_KEY deve ser 32 bytes em hex (64 chars).");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Formato: iv:authTag:ciphertext (tudo em hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Formato de secret encriptado invalido.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

// --------------- TOTP ---------------

export function generateTotpSecret(): string {
  return generateSecret();
}

export function generateTotpUri(secret: string, email: string): string {
  return generateURI({
    issuer: totpConfig.issuer,
    label: email,
    secret,
    strategy: "totp",
  });
}

export async function generateQRCodeDataUrl(otpAuthUri: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUri);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const result = verifySync({ token: code, secret });
  return result.valid;
}

// --------------- Codigos de backup ---------------

export function generateBackupCodes(count: number = totpConfig.backupCodeCount): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8 caracteres alfanumericos, faceis de ler
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(code.toUpperCase(), salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyBackupCode(code: string, hashed: string): boolean {
  const [saltHex, hashHex] = hashed.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expectedHash = Buffer.from(hashHex, "hex");
  const actualHash = crypto.scryptSync(code.toUpperCase(), salt, 32);
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

// --------------- Tokens de desafio ---------------

export async function createChallengeToken(userId: string): Promise<string> {
  const challengeToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + totpConfig.challengeTtlMs).toISOString();

  const { error } = await supabase.from("totp_challenges").insert({
    user_id: userId,
    challenge_token: challengeToken,
    expires_at: expiresAt,
  });

  if (error) throw new Error("Erro ao criar challenge token.");
  return challengeToken;
}

export async function validateChallengeToken(
  challengeToken: string
): Promise<{ userId: string } | null> {
  const { data, error } = await supabase
    .from("totp_challenges")
    .select("id, user_id, expires_at, used")
    .eq("challenge_token", challengeToken)
    .single();

  if (error || !data) return null;
  if (data.used) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  return { userId: data.user_id };
}

export async function markChallengeUsed(challengeToken: string): Promise<void> {
  await supabase
    .from("totp_challenges")
    .update({ used: true })
    .eq("challenge_token", challengeToken);
}

export async function invalidateChallenge(challengeToken: string): Promise<void> {
  await supabase
    .from("totp_challenges")
    .update({ used: true })
    .eq("challenge_token", challengeToken);
}

// Rate limiting — em memoria por challenge token
const challengeAttempts = new Map<string, number>();

export function recordChallengeAttempt(challengeToken: string): boolean {
  const attempts = (challengeAttempts.get(challengeToken) || 0) + 1;
  challengeAttempts.set(challengeToken, attempts);
  if (attempts >= 5) {
    // Invalidar challenge de forma assincrona
    invalidateChallenge(challengeToken);
    challengeAttempts.delete(challengeToken);
    return false; // bloqueado
  }
  return true; // ainda pode tentar
}

export function clearChallengeAttempts(challengeToken: string): void {
  challengeAttempts.delete(challengeToken);
}

// Limpeza de challenges expirados
export async function cleanupExpiredChallenges(): Promise<void> {
  const { error } = await supabase
    .from("totp_challenges")
    .delete()
    .lt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[TOTP] Erro no cleanup de challenges:", error.message);
  }
}
