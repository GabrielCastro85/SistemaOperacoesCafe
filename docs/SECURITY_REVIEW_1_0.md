# Revisao de seguranca 1.0

Status: revisao automatizada aprovada para `1.0.0-rc.1`, com validacoes manuais pendentes.

## Controles verificados

- `contextIsolation: true`.
- `nodeIntegration: false`.
- `webSecurity: true`.
- DevTools bloqueado em build empacotado, exceto variavel explicita.
- Novas janelas negadas.
- Navegacao restrita.
- Permissoes de browser negadas por padrao.
- Preload com `contextBridge`.
- CSP declarada em `index.html`.
- IPC com politica deny-by-default autenticada.
- Permissoes criticas exigidas no processo principal.
- Senhas com `scrypt`, salt aleatorio e comparacao segura.
- Auditoria sanitiza senha, hash, salt, token e segredo.
- Backups criptografados usam AES-256-GCM com senha nao persistida.
- Documentos e anexos sao abertos por ID interno nos fluxos implementados.

## Limitacoes aceitas

- Artefatos sem assinatura Authenticode: `signed: false`.
- SmartScreen pode alertar aplicativo desconhecido.
- Assinatura externa de PDF e arquivada, mas nao validada criptograficamente.
- Nao ha atualizacao automatica.
- Nao ha telemetria ou monitoramento remoto.
- `npm audit` completo reporta vulnerabilidades em Electron e ferramentas de build; a correcao exige upgrade major/breaking e regressao propria.

## Recomendacoes futuras

- Configurar certificado Authenticode.
- Planejar upgrade testado de Electron/electron-builder antes do stable.
- Validar assinatura digital externa quando houver infraestrutura definida.
- Ampliar testes E2E em maquina limpa.
- Revisar dependencias dev com vulnerabilidades reportadas por `npm audit`.
