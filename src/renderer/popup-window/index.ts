import type { PopupApi } from '../../preload/popup-preload';

declare global {
  interface Window {
    popupApi: PopupApi;
  }
}

const { popupApi } = window;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const UNCATEGORIZED = 'Sem pasta';

interface CredentialName {
  id: string;
  name: string;
  username: string;
  category: string;
}

let allCredentials: CredentialName[] = [];
let visibleIds: string[] = [];
let highlightedId: string | null = null;
let selectedId: string | null = null;
let activeFolder = 'all';

const listEl = () => $<HTMLDivElement>('credential-list');
const searchEl = () => $<HTMLInputElement>('search-credential');
const chipsEl = () => $<HTMLDivElement>('folder-chips');

function folderOf(cred: CredentialName): string {
  return cred.category.trim() || UNCATEGORIZED;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function init(): Promise<void> {
  allCredentials = await popupApi.listNames();
  renderFolderChips();
  render();
  searchEl().focus();
}

function renderFolderChips(): void {
  const chips = chipsEl();
  const folders = Array.from(new Set(allCredentials.map(folderOf))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  chips.innerHTML = '';
  const entries = [
    { key: 'all', label: `Todas (${allCredentials.length})` },
    ...folders.map((f) => ({ key: f, label: `${f} (${allCredentials.filter((c) => folderOf(c) === f).length})` })),
  ];

  for (const entry of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = entry.key === activeFolder ? 'folder-chip active' : 'folder-chip';
    btn.textContent = entry.label;
    btn.addEventListener('click', () => {
      activeFolder = entry.key;
      renderFolderChips();
      render();
    });
    chips.appendChild(btn);
  }
}

function render(): void {
  const list = listEl();
  const query = searchEl().value.trim().toLowerCase();

  const inFolder = activeFolder === 'all' ? allCredentials : allCredentials.filter((c) => folderOf(c) === activeFolder);

  const matches = query
    ? inFolder.filter((c) => c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query))
    : inFolder;

  list.innerHTML = '';
  visibleIds = [];

  if (allCredentials.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma credencial cadastrada</div>';
    highlightedId = null;
    return;
  }

  if (matches.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma credencial encontrada</div>';
    highlightedId = null;
    return;
  }

  const groups = new Map<string, CredentialName[]>();
  for (const cred of matches) {
    const folder = folderOf(cred);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(cred);
  }

  const folderNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  for (const folder of folderNames) {
    const header = document.createElement('div');
    header.className = 'credential-group-header';
    header.textContent = folder;
    list.appendChild(header);

    const creds = groups.get(folder)!.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    for (const cred of creds) {
      const option = document.createElement('div');
      option.className = 'credential-option';
      option.setAttribute('role', 'option');
      option.dataset.id = cred.id;
      option.innerHTML = `
        <span class="cred-name"></span>
        <span class="cred-username"></span>
      `;
      option.querySelector('.cred-name')!.textContent = cred.name;
      option.querySelector('.cred-username')!.textContent = `(${cred.username})`;
      option.addEventListener('click', () => selectCredential(cred.id, { focusPin: true }));
      list.appendChild(option);
      visibleIds.push(cred.id);
    }
  }

  if (highlightedId === null || !visibleIds.includes(highlightedId)) {
    highlightedId = selectedId && visibleIds.includes(selectedId) ? selectedId : visibleIds[0] ?? null;
  }
  updateHighlight();
}

function updateHighlight(): void {
  for (const el of Array.from(listEl().querySelectorAll<HTMLDivElement>('.credential-option'))) {
    const isSelected = el.dataset.id === selectedId;
    const isHighlighted = el.dataset.id === highlightedId;
    el.classList.toggle('selected', isSelected || isHighlighted);
    if (isHighlighted) el.scrollIntoView({ block: 'nearest' });
  }
}

function selectCredential(id: string, opts: { focusPin: boolean } = { focusPin: false }): void {
  selectedId = id;
  highlightedId = id;
  updateHighlight();
  if (opts.focusPin) $<HTMLInputElement>('input-pin').focus();
}

function moveHighlight(delta: 1 | -1): void {
  if (visibleIds.length === 0) return;
  const currentIndex = highlightedId ? visibleIds.indexOf(highlightedId) : -1;
  const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleIds.length - 1);
  highlightedId = visibleIds[nextIndex];
  updateHighlight();
}

searchEl().addEventListener('input', () => {
  render();
});

searchEl().addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveHighlight(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveHighlight(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedId) selectCredential(highlightedId, { focusPin: true });
  }
});

$('btn-cancel').addEventListener('click', () => popupApi.close());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') popupApi.close();
});

$('form-autotype').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = selectedId;
  const pin = $<HTMLInputElement>('input-pin').value;
  const errorEl = $('error');
  errorEl.textContent = '';

  if (!id) {
    errorEl.textContent = 'Selecione uma credencial.';
    return;
  }

  const result = await popupApi.autotype(id, pin);
  if (!result.ok) {
    errorEl.textContent = result.error.code === 'WRONG_PIN' ? 'PIN incorreto.' : result.error.message;
    $<HTMLInputElement>('input-pin').value = '';
    $<HTMLInputElement>('input-pin').focus();
  }
  // em caso de sucesso, o processo main já fechou este popup.
});

init();
