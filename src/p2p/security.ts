import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

export interface CardToken {
  keyId: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const keyStore: Record<string, Buffer> = {};

export function createCardKey(keyId: string) {
  const key = crypto.randomBytes(KEY_LENGTH);
  keyStore[keyId] = key;
  return key;
}

export function encryptCard(cardId: string, keyId: string) {
  const key = keyStore[keyId];
  if (!key) {
    throw new Error(`Missing key ${keyId}`);
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(cardId, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyId,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptCard(token: CardToken) {
  const key = keyStore[token.keyId];
  if (!key) {
    throw new Error(`Missing key ${token.keyId}`);
  }
  const iv = Buffer.from(token.iv, "base64");
  const tag = Buffer.from(token.tag, "base64");
  const cipherText = Buffer.from(token.ciphertext, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return plain.toString("utf8");
}

export function listKeys() {
  return Object.keys(keyStore);
}
