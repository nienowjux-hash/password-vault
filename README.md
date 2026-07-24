# App Senhas

Cofre de senhas local para Windows, protegido por PIN, com autopreenchimento via atalho global. Os dados ficam criptografados (Argon2id + AES-256-GCM) apenas no seu computador — nada é enviado para nenhum servidor.

## Instalação

Abra o PowerShell e rode:

```powershell
irm https://raw.githubusercontent.com/nienowjux-hash/password-vault/main/install.ps1 | iex
```

Isso baixa o instalador (`.exe`) do último [Release](https://github.com/nienowjux-hash/password-vault/releases) e abre o assistente de instalação do Windows.

## Desenvolvimento

```powershell
npm install
npm run dev      # roda em modo desenvolvimento
npm run dist      # gera o instalador localmente em release/
```
