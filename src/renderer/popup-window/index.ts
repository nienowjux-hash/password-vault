import type { PopupApi } from '../../preload/popup-preload';

declare global {
  interface Window {
    popupApi: PopupApi;
  }
}

const { popupApi } = window;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function init(): Promise<void> {
  const select = $<HTMLSelectElement>('select-credential');
  const names = await popupApi.listNames();

  if (names.length === 0) {
    select.innerHTML = '<option value="">Nenhuma credencial cadastrada</option>';
    return;
  }

  select.innerHTML = names
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.username)})</option>`)
    .join('');

  $<HTMLInputElement>('input-pin').focus();
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

$('btn-cancel').addEventListener('click', () => popupApi.close());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') popupApi.close();
});

$('form-autotype').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $<HTMLSelectElement>('select-credential').value;
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
