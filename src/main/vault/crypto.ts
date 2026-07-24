import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import argon2 from 'argon2';
import type { KdfParams, VaultFile, VaultPayload } from './schema';
import { vaultPayloadSchema } from './schema';

const DEFAULT_KDF_COST = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export class WrongPinError extends Error {
  constructor() {
    super('PIN incorreto');
    this.name = 'WrongPinError';
  }
}

export function newKdfParams(): KdfParams {
  return {
    type: 'argon2id',
    salt: randomBytes(16).toString('base64'),
    ...DEFAULT_KDF_COST,
  };
}

/** Deriva a chave AES-256 a partir do PIN. Custo intencional (~0.3-0.8s) — funciona como limitador de força bruta. */
export async function deriveKey(pin: string, kdf: KdfParams): Promise<Buffer> {
  return argon2.hash(pin, {
    type: argon2.argon2id,
    raw: true,
    salt: Buffer.from(kdf.salt, 'base64'),
    memoryCost: kdf.memoryCost,
    timeCost: kdf.timeCost,
    parallelism: kdf.parallelism,
    hashLength: 32,
  }) as Promise<Buffer>;
}

/** Criptografa o payload com uma chave já derivada. Gera um IV novo a cada chamada (nunca reusar IV+chave). */
export function encryptPayload(key: Buffer, kdf: KdfParams, payload: VaultPayload): VaultFile {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    kdf,
    cipher: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/** Decripta o payload. Lança WrongPinError se a chave estiver errada (falha na checagem de autenticação do GCM). */
export function decryptPayload(key: Buffer, file: VaultFile): VaultPayload {
  const iv = Buffer.from(file.iv, 'base64');
  const authTag = Buffer.from(file.authTag, 'base64');
  const ciphertext = Buffer.from(file.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new WrongPinError();
  }

  return vaultPayloadSchema.parse(JSON.parse(plaintext.toString('utf8')));
}

export function zeroBuffer(buf: Buffer): void {
  buf.fill(0);
}
