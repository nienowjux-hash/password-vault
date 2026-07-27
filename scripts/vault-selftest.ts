import assert from 'node:assert';
import { newKdfParams, deriveKey, encryptPayload, decryptPayload, WrongPinError } from '../src/main/vault/crypto';
import type { VaultPayload } from '../src/main/vault/schema';

async function main() {
  const pin = '194728';
  const kdf = newKdfParams();
  const key = await deriveKey(pin, kdf);

  const payload: VaultPayload = {
    credentials: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Exemplo',
        username: 'user@exemplo.com',
        password: 'S3nh@ super secreta!',
        notes: '',
        category: '',
        twoStepLogin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };

  const file = encryptPayload(key, kdf, payload);
  console.log('Vault criptografado, tamanho ciphertext:', file.ciphertext.length);

  const correctKey = await deriveKey(pin, file.kdf);
  const decrypted = decryptPayload(correctKey, file);
  assert.strictEqual(decrypted.credentials[0].password, payload.credentials[0].password);
  console.log('PASS: PIN correto decripta e confere com o original.');

  const wrongKey = await deriveKey('000000', file.kdf);
  try {
    decryptPayload(wrongKey, file);
    console.error('FAIL: PIN errado não deveria ter decriptado com sucesso.');
    process.exit(1);
  } catch (err) {
    assert.ok(err instanceof WrongPinError);
    console.log('PASS: PIN errado falha com WrongPinError (checagem GCM).');
  }

  console.log('\nTodos os testes passaram.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
