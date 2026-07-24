import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { app } from 'electron';
import { newKdfParams, deriveKey, encryptPayload, decryptPayload, zeroBuffer, WrongPinError } from './crypto';
import { vaultFileSchema, type VaultFile, type VaultPayload } from './schema';
import type { Credential, CredentialMeta, NewCredentialInput, UpdateCredentialInput } from '@shared/types';
import { getLockoutRemainingMs, recordFailure, recordSuccess } from './lockout';

export { WrongPinError };

function vaultPath(): string {
  return join(app.getPath('userData'), 'vault.dat');
}

interface SessionState {
  file: VaultFile | null;
  key: Buffer | null;
  payload: VaultPayload | null;
}

const session: SessionState = { file: null, key: null, payload: null };

export function vaultExists(): boolean {
  return existsSync(vaultPath());
}

export function isUnlocked(): boolean {
  return session.key !== null && session.payload !== null;
}

function loadFileFromDisk(): VaultFile {
  const raw = JSON.parse(readFileSync(vaultPath(), 'utf8'));
  return vaultFileSchema.parse(raw);
}

function persist(): void {
  if (!session.file || !session.key || !session.payload) throw new Error('Cofre não está desbloqueado');
  const file = encryptPayload(session.key, session.file.kdf, session.payload);
  const p = vaultPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(file), 'utf8');
  session.file = file;
}

export async function createVault(pin: string): Promise<void> {
  if (vaultExists()) throw new Error('Já existe um cofre nesta máquina');
  const kdf = newKdfParams();
  const key = await deriveKey(pin, kdf);
  const payload: VaultPayload = { credentials: [] };
  const file = encryptPayload(key, kdf, payload);
  const p = vaultPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(file), 'utf8');
  session.file = file;
  session.key = key;
  session.payload = payload;
}

/** Desbloqueia o cofre (navegação de metadados). Lança WrongPinError ou um erro de lockout ativo. */
export async function unlock(pin: string): Promise<CredentialMeta[]> {
  const remaining = getLockoutRemainingMs();
  if (remaining > 0) throw new LockedOutError(remaining);

  const file = loadFileFromDisk();
  const key = await deriveKey(pin, file.kdf);
  let payload: VaultPayload;
  try {
    payload = decryptPayload(key, file);
  } catch (err) {
    recordFailure();
    throw err;
  }
  recordSuccess();

  session.file = file;
  session.key = key;
  session.payload = payload;

  return payload.credentials.map(stripPassword);
}

export class LockedOutError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super('Bloqueado temporariamente por tentativas erradas');
    this.name = 'LockedOutError';
    this.retryAfterMs = retryAfterMs;
  }
}

export function lock(): void {
  if (session.key) zeroBuffer(session.key);
  session.key = null;
  session.payload = null;
}

function stripPassword(c: Credential): CredentialMeta {
  const { password, ...meta } = c;
  return meta;
}

export function listCredentials(): CredentialMeta[] {
  requireUnlocked();
  return session.payload!.credentials.map(stripPassword);
}

/**
 * Reverifica o PIN independentemente do estado "desbloqueado" e retorna a senha em texto puro.
 * Satisfaz a exigência de PIN a cada revelação/autopreenchimento.
 */
export async function verifyPinAndRevealPassword(pin: string, credentialId: string): Promise<string> {
  requireUnlocked();
  const remaining = getLockoutRemainingMs();
  if (remaining > 0) throw new LockedOutError(remaining);

  const key = await deriveKey(pin, session.file!.kdf);
  let payload: VaultPayload;
  try {
    payload = decryptPayload(key, session.file!);
  } catch (err) {
    recordFailure();
    zeroBuffer(key);
    throw err;
  }
  recordSuccess();
  zeroBuffer(key);

  const credential = payload.credentials.find((c) => c.id === credentialId);
  if (!credential) throw new Error('Credencial não encontrada');
  return credential.password;
}

export function addCredential(input: NewCredentialInput): CredentialMeta {
  requireUnlocked();
  const now = Date.now();
  const credential: Credential = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
  session.payload!.credentials.push(credential);
  persist();
  return stripPassword(credential);
}

export function updateCredential(input: UpdateCredentialInput): CredentialMeta {
  requireUnlocked();
  const idx = session.payload!.credentials.findIndex((c) => c.id === input.id);
  if (idx === -1) throw new Error('Credencial não encontrada');
  const existing = session.payload!.credentials[idx];
  const updated: Credential = { ...existing, ...input, updatedAt: Date.now() };
  session.payload!.credentials[idx] = updated;
  persist();
  return stripPassword(updated);
}

export function deleteCredential(id: string): void {
  requireUnlocked();
  session.payload!.credentials = session.payload!.credentials.filter((c) => c.id !== id);
  persist();
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  requireUnlocked();
  const currentKey = await deriveKey(currentPin, session.file!.kdf);
  try {
    decryptPayload(currentKey, session.file!);
  } catch (err) {
    zeroBuffer(currentKey);
    throw err;
  }
  zeroBuffer(currentKey);

  const newKdf = newKdfParams();
  const newKey = await deriveKey(newPin, newKdf);
  const file = encryptPayload(newKey, newKdf, session.payload!);
  writeFileSync(vaultPath(), JSON.stringify(file), 'utf8');
  if (session.key) zeroBuffer(session.key);
  session.file = file;
  session.key = newKey;
}

function requireUnlocked(): void {
  if (!isUnlocked()) throw new Error('Cofre está bloqueado');
}
