import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

interface LockoutState {
  failedAttempts: number;
  lastFailureAt: number;
}

const STEPS: Array<{ attempts: number; lockoutMs: number }> = [
  { attempts: 15, lockoutMs: 60 * 60 * 1000 },
  { attempts: 11, lockoutMs: 10 * 60 * 1000 },
  { attempts: 8, lockoutMs: 2 * 60 * 1000 },
  { attempts: 5, lockoutMs: 30 * 1000 },
];

function statePath(): string {
  return join(app.getPath('userData'), 'lockout-state.json');
}

function readState(): LockoutState {
  const p = statePath();
  if (!existsSync(p)) return { failedAttempts: 0, lastFailureAt: 0 };
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return { failedAttempts: 0, lastFailureAt: 0 };
  }
}

function writeState(state: LockoutState): void {
  writeFileSync(statePath(), JSON.stringify(state), 'utf8');
}

/** Retorna quantos ms faltam de bloqueio (0 = liberado para tentar). Nunca apaga o cofre. */
export function getLockoutRemainingMs(): number {
  const state = readState();
  const step = STEPS.find((s) => state.failedAttempts >= s.attempts);
  if (!step) return 0;
  const elapsed = Date.now() - state.lastFailureAt;
  const remaining = step.lockoutMs - elapsed;
  return remaining > 0 ? remaining : 0;
}

export function recordFailure(): void {
  const state = readState();
  writeState({ failedAttempts: state.failedAttempts + 1, lastFailureAt: Date.now() });
}

export function recordSuccess(): void {
  writeState({ failedAttempts: 0, lastFailureAt: 0 });
}

export function getFailedAttempts(): number {
  return readState().failedAttempts;
}
