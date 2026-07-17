# Arquitetura

Electron usa processo principal para banco, migrations, arquivos, logs e IPC. O renderer React nao acessa Node, filesystem ou SQLite diretamente.

Seguranca: `contextIsolation: true`, `nodeIntegration: false`, preload com `contextBridge`, canais IPC especificos e validacao com Zod.

Banco: SQLite local em `app.getPath("userData")/database/operations.sqlite`. Documentos, anexos, backups, logs e settings tambem ficam em `userData`.

Branding: variantes `villa`, `grao` e `multiempresa` compartilham o mesmo codigo. Logos ficam em `assets/branding/<variante>/` e podem ser substituidas por PNG, SVG ou WebP.

Build futuro: `electron-builder` esta configurado para Windows e preserva dados porque o banco nao fica na pasta de instalacao.

Na segunda etapa foram adicionados canais IPC administrativos especificos para organizacoes, CNPJs, locais, perfil e branding. O renderer envia payloads tipados e o processo principal valida regras de variante, consistencia do contexto ativo e acesso a arquivos.

Na terceira etapa, os cadastros de parceiros, produtos, perfis de cobranca e regras por saca seguem o mesmo desenho: React chama preload tipado, IPC valida payloads e `AppRepository` aplica regras de dominio e SQL. O renderer nao contem SQL nem acessa o banco.

Na quarta etapa, notas e operacoes manuais usam os mesmos limites: renderer sem SQL, preload tipado, IPC especifico e regras no processo principal. Calculos de servico usam helpers compartilhados de decimal exato.

Na quinta etapa, a leitura de Excel fica no processo principal com `exceljs`. O renderer recebe apenas token temporario, metadados da pasta de trabalho, previa e resultado do job; ele nao acessa o caminho real da planilha nem o filesystem. A execucao copia o arquivo selecionado para `userData` antes de gravar o caminho no banco.

Na sexta etapa, XMLs seguem o mesmo isolamento. O renderer solicita selecao ao processo principal e recebe tokens temporarios, fila e resumo. O parsing usa `fast-xml-parser` no processo principal com validacoes previas de tamanho, DTD/ENTITY, raiz, profundidade e chave. A confirmacao copia os arquivos para `userData/documents/invoices/xml-imports/<job-id>/`.

Na setima etapa, cobrancas e conta-corrente continuam concentradas no processo principal. O renderer aciona IPCs tipados para periodos, operacoes elegiveis, rascunhos, ajustes, creditos, emissao, cancelamento, pagamentos e resumo. A geracao de PDF, Excel e imagem fica em `chargeDocuments`, gravando arquivos locais em `userData/documents/charges/<charge-id>/` e retornando apenas metadados persistidos.

Na oitava etapa, Financeiro segue a mesma fronteira: React nao acessa SQLite nem filesystem. IPCs especificos acionam `AppRepository`, que valida escopo, recalcula dinheiro em centavos e usa transacoes para contas, recorrencias, parcelamentos, rateios e pagamentos. Contas a pagar ficam isoladas de contas a receber para evitar dupla contagem no fluxo projetado.

Na conclusao da oitava etapa, anexos e relatorios usam selecao/abertura no processo principal. O renderer recebe tokens temporarios ao selecionar arquivos e IDs internos depois da copia. A geracao de PDF/Excel financeiro fica em `financialFiles`, reutilizando `exceljs` e escrita local sem servicos externos.

Na nona etapa, Confirmacoes de negocio usam IPCs especificos para rascunho, origem por operacao/nota, participantes, itens, clausulas, pagamento, signatarios, emissao, assinatura externa, cancelamento, substituicao, dashboard e relatorios. PDFs e relatorios ficam em `dealConfirmationFiles`, sempre no processo principal, com copia para `userData` e hash persistido.
