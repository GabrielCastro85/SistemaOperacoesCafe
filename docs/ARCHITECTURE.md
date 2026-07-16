# Arquitetura

Electron usa processo principal para banco, migrations, arquivos, logs e IPC. O renderer React nao acessa Node, filesystem ou SQLite diretamente.

Seguranca: `contextIsolation: true`, `nodeIntegration: false`, preload com `contextBridge`, canais IPC especificos e validacao com Zod.

Banco: SQLite local em `app.getPath("userData")/database/operations.sqlite`. Documentos, anexos, backups, logs e settings tambem ficam em `userData`.

Branding: variantes `villa`, `grao` e `multiempresa` compartilham o mesmo codigo. Logos ficam em `assets/branding/<variante>/` e podem ser substituidas por PNG, SVG ou WebP.

Build futuro: `electron-builder` esta configurado para Windows e preserva dados porque o banco nao fica na pasta de instalacao.

Na segunda etapa foram adicionados canais IPC administrativos especificos para organizacoes, CNPJs, locais, perfil e branding. O renderer envia payloads tipados e o processo principal valida regras de variante, consistencia do contexto ativo e acesso a arquivos.

Na terceira etapa, os cadastros de parceiros, produtos, perfis de cobranca e regras por saca seguem o mesmo desenho: React chama preload tipado, IPC valida payloads e `AppRepository` aplica regras de dominio e SQL. O renderer nao contem SQL nem acessa o banco.
