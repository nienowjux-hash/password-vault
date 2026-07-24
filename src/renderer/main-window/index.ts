import type { MainApi } from '../../preload/main-preload';
import type { CredentialMeta, AppSettings } from '@shared/types';

declare global {
  interface Window {
    api: MainApi;
  }
}

const { api } = window;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const views = {
  loading: $('view-loading'),
  create: $('view-create'),
  unlock: $('view-unlock'),
  vault: $('view-vault'),
};

function showView(name: keyof typeof views): void {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}

async function refreshStatus(): Promise<void> {
  const status = await api.vaultStatus();
  if (!status.exists) {
    showView('create');
  } else if (!status.unlocked) {
    showView('unlock');
  } else {
    showView('vault');
    await renderCredentialList();
  }
}

// --- criar cofre ---

$('form-create').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $<HTMLInputElement>('create-pin').value;
  const confirm = $<HTMLInputElement>('create-pin-confirm').value;
  const errorEl = $('create-error');
  errorEl.textContent = '';

  if (pin.length < 4) {
    errorEl.textContent = 'O PIN precisa ter pelo menos 4 caracteres.';
    return;
  }
  if (pin !== confirm) {
    errorEl.textContent = 'Os PINs não coincidem.';
    return;
  }

  await api.vaultCreate(pin);
  await refreshStatus();
});

// --- desbloquear ---

$('form-unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = $<HTMLInputElement>('unlock-pin').value;
  const errorEl = $('unlock-error');
  errorEl.textContent = '';

  const result = await api.vaultUnlock(pin);
  if (!result.ok) {
    errorEl.textContent = describeError(result.error);
    return;
  }
  $<HTMLInputElement>('unlock-pin').value = '';
  await refreshStatus();
});

function describeError(error: { message: string; code: string; retryAfterMs?: number }): string {
  if (error.code === 'LOCKED_OUT') {
    const seconds = Math.ceil((error.retryAfterMs ?? 0) / 1000);
    return `Muitas tentativas erradas. Tente novamente em ${seconds}s.`;
  }
  if (error.code === 'WRONG_PIN') return 'PIN incorreto.';
  return error.message;
}

// --- lista de credenciais / pastas ---

const UNCATEGORIZED = 'Sem pasta';
let activeFolder = 'all';
let searchQuery = '';
let allCredentials: CredentialMeta[] = [];

$<HTMLInputElement>('credential-search').addEventListener('input', (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  renderCredentialItems();
});

function folderOf(cred: CredentialMeta): string {
  return cred.category.trim() || UNCATEGORIZED;
}

function renderFolderTabs(): void {
  const tabs = $<HTMLUListElement>('folder-tabs');
  const folders = Array.from(new Set(allCredentials.map(folderOf))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (activeFolder !== 'all' && !folders.includes(activeFolder)) activeFolder = 'all';

  tabs.innerHTML = '';
  const entries: Array<{ key: string; label: string }> = [
    { key: 'all', label: `Todas (${allCredentials.length})` },
    ...folders.map((f) => ({ key: f, label: `${f} (${allCredentials.filter((c) => folderOf(c) === f).length})` })),
  ];

  for (const entry of entries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = entry.label;
    btn.className = entry.key === activeFolder ? 'folder-tab active' : 'folder-tab';
    btn.addEventListener('click', () => {
      activeFolder = entry.key;
      renderFolderTabs();
      renderCredentialItems();
    });
    li.appendChild(btn);
    tabs.appendChild(li);
  }

  const datalist = $<HTMLDataListElement>('cred-category-options');
  datalist.innerHTML = folders
    .filter((f) => f !== UNCATEGORIZED)
    .map((f) => `<option value="${escapeHtml(f)}"></option>`)
    .join('');
}

function renderCredentialItems(): void {
  const list = $<HTMLUListElement>('credential-list');
  let visible = activeFolder === 'all' ? allCredentials : allCredentials.filter((c) => folderOf(c) === activeFolder);

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    visible = visible.filter(
      (c) => c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query)
    );
  }

  list.innerHTML = '';

  if (visible.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = query ? 'Nenhuma credencial encontrada.' : 'Nenhuma credencial nesta pasta.';
    list.appendChild(empty);
    return;
  }

  for (const cred of visible) {
    const li = document.createElement('li');
    li.className = 'credential-item';
    li.innerHTML = `
      <div class="credential-info">
        <div class="name"></div>
        <div class="username"></div>
        <div class="category-badge"></div>
      </div>
      <div class="credential-actions">
        <button data-action="reveal">Revelar</button>
        <button data-action="edit">Editar</button>
        <button data-action="delete">Excluir</button>
      </div>
    `;
    li.querySelector('.name')!.textContent = cred.name;
    li.querySelector('.username')!.textContent = cred.username;
    li.querySelector('.category-badge')!.textContent = folderOf(cred);

    li.querySelector('[data-action="reveal"]')!.addEventListener('click', () => requestReveal(cred));
    li.querySelector('[data-action="edit"]')!.addEventListener('click', () => openEditDialog(cred));
    li.querySelector('[data-action="delete"]')!.addEventListener('click', () => deleteCredential(cred));

    list.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function renderCredentialList(): Promise<void> {
  allCredentials = await api.credentialList();
  renderFolderTabs();
  renderCredentialItems();
}

$('btn-lock').addEventListener('click', async () => {
  await api.vaultLock();
  await refreshStatus();
});

api.onAutoLocked(() => {
  refreshStatus();
});

// --- adicionar/editar credencial ---

const dialogForm = $<HTMLDialogElement>('dialog-form');

$('btn-add').addEventListener('click', () => {
  $<HTMLInputElement>('cred-id').value = '';
  $<HTMLInputElement>('cred-name').value = '';
  $<HTMLInputElement>('cred-username').value = '';
  $<HTMLInputElement>('cred-password').value = '';
  $<HTMLInputElement>('cred-category').value = activeFolder !== 'all' && activeFolder !== UNCATEGORIZED ? activeFolder : '';
  $<HTMLTextAreaElement>('cred-notes').value = '';
  dialogForm.showModal();
});

function openEditDialog(cred: CredentialMeta): void {
  $<HTMLInputElement>('cred-id').value = cred.id;
  $<HTMLInputElement>('cred-name').value = cred.name;
  $<HTMLInputElement>('cred-username').value = cred.username;
  $<HTMLInputElement>('cred-password').value = '';
  $<HTMLInputElement>('cred-category').value = cred.category;
  $<HTMLTextAreaElement>('cred-notes').value = cred.notes;
  dialogForm.showModal();
}

$('btn-cancel-form').addEventListener('click', () => dialogForm.close());

$('form-credential').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $<HTMLInputElement>('cred-id').value;
  const name = $<HTMLInputElement>('cred-name').value;
  const username = $<HTMLInputElement>('cred-username').value;
  const password = $<HTMLInputElement>('cred-password').value;
  const category = $<HTMLInputElement>('cred-category').value.trim();
  const notes = $<HTMLTextAreaElement>('cred-notes').value;

  if (id) {
    const patch: Record<string, unknown> = { id, name, username, notes, category };
    if (password) patch.password = password;
    await api.credentialUpdate(patch as any);
  } else {
    await api.credentialAdd({ name, username, password, notes, category });
  }

  dialogForm.close();
  await renderCredentialList();
});

async function deleteCredential(cred: CredentialMeta): Promise<void> {
  if (!confirm(`Excluir "${cred.name}"?`)) return;
  await api.credentialDelete(cred.id);
  await renderCredentialList();
}

// --- revelar senha (exige PIN sempre) ---

const dialogPinConfirm = $<HTMLDialogElement>('dialog-pin-confirm');
const dialogReveal = $<HTMLDialogElement>('dialog-reveal');
let pendingRevealCredential: CredentialMeta | null = null;

function requestReveal(cred: CredentialMeta): void {
  pendingRevealCredential = cred;
  $<HTMLInputElement>('pin-confirm-input').value = '';
  $('pin-confirm-error').textContent = '';
  $('pin-confirm-label').textContent = `Digite o PIN para revelar a senha de "${cred.name}"`;
  dialogPinConfirm.showModal();
}

$('btn-cancel-pin-confirm').addEventListener('click', () => {
  pendingRevealCredential = null;
  dialogPinConfirm.close();
});

$('form-pin-confirm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pendingRevealCredential) return;
  const pin = $<HTMLInputElement>('pin-confirm-input').value;
  const result = await api.credentialReveal(pendingRevealCredential.id, pin);

  if (!result.ok) {
    $('pin-confirm-error').textContent = describeError(result.error);
    return;
  }

  dialogPinConfirm.close();
  $('revealed-password').textContent = result.password;
  dialogReveal.showModal();
  pendingRevealCredential = null;
});

$('btn-close-reveal').addEventListener('click', () => {
  $('revealed-password').textContent = '';
  dialogReveal.close();
});

$('btn-copy-revealed').addEventListener('click', async () => {
  const text = $('revealed-password').textContent ?? '';
  await navigator.clipboard.writeText(text);
});

// --- configurações ---

const dialogSettings = $<HTMLDialogElement>('dialog-settings');

$('btn-settings').addEventListener('click', async () => {
  const settings: AppSettings = await api.settingsGet();
  $<HTMLInputElement>('settings-hotkey').value = settings.hotkey;
  $<HTMLInputElement>('settings-autolock').value = String(settings.autoLockMinutes);
  $<HTMLInputElement>('settings-openatlogin').checked = settings.openAtLogin;
  $<HTMLInputElement>('settings-clipboard').checked = settings.clipboardFallback;
  dialogSettings.showModal();
});

$('btn-close-settings').addEventListener('click', () => dialogSettings.close());

$('form-settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  await api.settingsUpdate({
    hotkey: $<HTMLInputElement>('settings-hotkey').value,
    autoLockMinutes: Number($<HTMLInputElement>('settings-autolock').value),
    openAtLogin: $<HTMLInputElement>('settings-openatlogin').checked,
    clipboardFallback: $<HTMLInputElement>('settings-clipboard').checked,
  });
  dialogSettings.close();
});

refreshStatus();
