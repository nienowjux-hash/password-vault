import { clipboard } from 'electron';
import {
  getForegroundWindow,
  restoreForegroundWindow,
  typeUnicodeText,
  pressVirtualKey,
  VK_TAB,
  VK_RETURN,
  type WindowHandle,
} from './win32';
import { getSettings } from '../config';

let capturedWindow: WindowHandle | null = null;

/** Chamar assim que o atalho global disparar, antes de mostrar qualquer janela do popup. */
export function captureForegroundWindow(): void {
  capturedWindow = getForegroundWindow();
}

const CLIPBOARD_CLEAR_DELAY_MS = 10_000;

// Tempo de espera após o Enter em logins de duas etapas (ex.: Microsoft), para a
// próxima página carregar e o campo de senha ganhar foco antes de digitarmos nela.
const TWO_STEP_WAIT_MS = 1200;

export interface AutotypePayload {
  username: string;
  password: string;
  /** Ex.: login Microsoft — usuário numa página, senha só aparece na página seguinte. */
  twoStepLogin?: boolean;
}

/**
 * Restaura o foco para a janela capturada e digita usuário + Tab + senha nela
 * (sequência padrão de autotype, como no KeePass). Se não houver usuário
 * cadastrado, digita só a senha, sem o Tab.
 *
 * Quando `twoStepLogin` é true, usa Enter em vez de Tab após o usuário e espera
 * a próxima página carregar antes de digitar a senha (sem Tab, pois o campo de
 * senha normalmente já vem focado nessas páginas).
 */
export async function autotypeIntoCapturedWindow({ username, password, twoStepLogin }: AutotypePayload): Promise<void> {
  if (!capturedWindow) throw new Error('Nenhuma janela capturada para autopreenchimento');

  restoreForegroundWindow(capturedWindow);
  capturedWindow = null;

  // pequena pausa para a janela alvo assumir o foco antes de receber teclas
  await new Promise((resolve) => setTimeout(resolve, 120));

  const settings = getSettings();
  if (settings.clipboardFallback) {
    await clipboardPasteFallback(password);
    return;
  }

  if (username) {
    await typeUnicodeText(username);
    if (twoStepLogin) {
      await pressVirtualKey(VK_RETURN);
      await new Promise((resolve) => setTimeout(resolve, TWO_STEP_WAIT_MS));
    } else {
      await pressVirtualKey(VK_TAB);
    }
  }

  await typeUnicodeText(password);
  password = '';
}

async function clipboardPasteFallback(password: string): Promise<void> {
  clipboard.writeText(password);
  // Modo de compatibilidade: o usuário precisa colar manualmente (Ctrl+V) — evitamos
  // simular o próprio Ctrl+V para não brigar com apps que tratam colar de forma diferente.
  setTimeout(() => {
    if (clipboard.readText() === password) {
      clipboard.writeText('');
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
