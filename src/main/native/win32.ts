import koffi from 'koffi';

/**
 * Bindings diretos ao User32.dll via koffi (FFI com binário pré-compilado N-API,
 * sem necessidade de recompilar por versão do Electron — ver decisão no plano).
 *
 * Layouts de struct seguem exatamente o MSDN para x64:
 * KEYBDINPUT = 24 bytes, INPUT = 40 bytes (union dimensionada pelo MOUSEINPUT, o maior membro).
 */

const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16',
  wScan: 'uint16',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uint64',
});

// INPUT real é uma union { MOUSEINPUT; KEYBDINPUT; HARDWAREINPUT }; como só usamos o
// variante de teclado, replicamos o tamanho total (40 bytes) com padding explícito
// em vez de modelar a union inteira.
const INPUT_KB = koffi.struct('INPUT_KB', {
  type: 'uint32',
  _pad0: 'uint32',
  ki: KEYBDINPUT,
  _pad1: 'uint64',
});

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

const _SendInput = user32.func('SendInput', 'uint32', ['uint32', koffi.pointer(INPUT_KB), 'int32']);
const _GetForegroundWindow = user32.func('GetForegroundWindow', 'void *', []);
const _SetForegroundWindow = user32.func('SetForegroundWindow', 'bool', ['void *']);
const _GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32', ['void *', 'void *']);
const _AttachThreadInput = user32.func('AttachThreadInput', 'bool', ['uint32', 'uint32', 'bool']);
const _GetCurrentThreadId = kernel32.func('GetCurrentThreadId', 'uint32', []);

const INPUT_KEYBOARD = 1;
const KEYEVENTF_UNICODE = 0x0004;
const KEYEVENTF_KEYUP = 0x0002;

export type WindowHandle = unknown;

export function getForegroundWindow(): WindowHandle {
  return _GetForegroundWindow();
}

/**
 * Restaura o foco para `hwnd`. O Windows bloqueia SetForegroundWindow vindo de um
 * processo em segundo plano (foreground-lock); AttachThreadInput junta temporariamente
 * as filas de input das duas threads, o que é a forma documentada de contornar isso.
 */
export function restoreForegroundWindow(hwnd: WindowHandle): void {
  const currentThreadId = _GetCurrentThreadId();
  const targetThreadId = _GetWindowThreadProcessId(hwnd, null);

  if (targetThreadId === 0 || targetThreadId === currentThreadId) {
    _SetForegroundWindow(hwnd);
    return;
  }

  _AttachThreadInput(currentThreadId, targetThreadId, true);
  try {
    _SetForegroundWindow(hwnd);
  } finally {
    _AttachThreadInput(currentThreadId, targetThreadId, false);
  }
}

function makeKeyInput(charCode: number, keyUp: boolean) {
  return {
    type: INPUT_KEYBOARD,
    _pad0: 0,
    ki: {
      wVk: 0,
      wScan: charCode,
      dwFlags: KEYEVENTF_UNICODE | (keyUp ? KEYEVENTF_KEYUP : 0),
      time: 0,
      dwExtraInfo: 0n,
    },
    _pad1: 0n,
  };
}

function sendUnicodeChar(charCode: number): void {
  _SendInput(1, [makeKeyInput(charCode, false)], koffi.sizeof(INPUT_KB));
  _SendInput(1, [makeKeyInput(charCode, true)], koffi.sizeof(INPUT_KB));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Digita `text` caractere a caractere usando SendInput + KEYEVENTF_UNICODE.
 * Funciona independente do layout de teclado ativo e cobre caracteres especiais.
 * Itera por code unit UTF-16 (correto para pares substitutos, se houver).
 */
export async function typeUnicodeText(text: string, delayMs = 6): Promise<void> {
  for (let i = 0; i < text.length; i++) {
    sendUnicodeChar(text.charCodeAt(i));
    if (delayMs > 0) await sleep(delayMs);
  }
}

export const VK_TAB = 0x09;
export const VK_RETURN = 0x0d;

// Tecla virtual "de verdade" (não KEYEVENTF_UNICODE): necessário para Tab, já que
// muitos apps/formulários só reagem a um keydown de VK_TAB para mudar de campo,
// não a um caractere \t inserido como texto.
function makeVirtualKeyInput(vk: number, keyUp: boolean) {
  return {
    type: INPUT_KEYBOARD,
    _pad0: 0,
    ki: {
      wVk: vk,
      wScan: 0,
      dwFlags: keyUp ? KEYEVENTF_KEYUP : 0,
      time: 0,
      dwExtraInfo: 0n,
    },
    _pad1: 0n,
  };
}

export async function pressVirtualKey(vk: number, delayMs = 10): Promise<void> {
  _SendInput(1, [makeVirtualKeyInput(vk, false)], koffi.sizeof(INPUT_KB));
  await sleep(delayMs);
  _SendInput(1, [makeVirtualKeyInput(vk, true)], koffi.sizeof(INPUT_KB));
  await sleep(delayMs);
}
