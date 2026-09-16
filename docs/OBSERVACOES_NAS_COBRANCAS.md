# Observações por nota — versão 1.0.57

Em **Notas e operações**, o campo **Observações da nota (sai na cobrança)** permite informar lote, referências de contrato ou outras informações destinadas ao cliente. O limite é de 500 caracteres.

- Na nota manual, preencha antes de salvar o lançamento.
- Na nota importada por XML, abra seu detalhe, preencha o campo e clique em **Salvar contrato e observações**.
- Preencha essas informações antes de reservar a nota em uma cobrança. Notas já vinculadas a cobrança ou acerto mantêm o bloqueio de edição para preservar os documentos emitidos.
- O campo **Contrato** continua separado para os clientes que exigem uma referência contratual.

No PDF e na imagem, as observações aparecem abaixo da respectiva nota, preservando as quebras de linha. No Excel, aparecem na coluna **Observações**. O fechamento guarda uma cópia do texto para que o histórico não dependa de alterações futuras no cadastro.

Também foi retirada a confirmação individual como requisito para cobrar notas em rascunho: notas com responsável definido, tarifa positiva e sem pendências podem ser incluídas diretamente. Cancelamentos, falta de tarifa e ausência de contrato obrigatório continuam exigindo correção.

Nenhuma observação antiga de uso interno é publicada automaticamente: o campo destinado à cobrança é separado.
