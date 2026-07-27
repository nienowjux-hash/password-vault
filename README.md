# App Senhas

Cofre de senhas local para Windows, protegido por PIN, com autopreenchimento via atalho global. Os dados ficam criptografados (Argon2id + AES-256-GCM) apenas no seu computador — nada é enviado para nenhum servidor.

## Autopreenchimento

Ao pressionar o atalho global, abre um popup com:

- campo de busca por nome ou usuário da credencial;
- chips de pasta para filtrar a lista por uma pasta específica (ou "Todas");
- lista agrupada por pasta, navegável com as setas do teclado e Enter.

Depois de selecionar a credencial e digitar o PIN, o usuário e a senha são digitados automaticamente na janela que estava em foco antes do atalho.

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
