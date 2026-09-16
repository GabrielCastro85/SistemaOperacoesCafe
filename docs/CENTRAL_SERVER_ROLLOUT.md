# Servidor central para cinco computadores

## Decisão

O sistema passará a usar uma API própria e um PostgreSQL central. Os aplicativos instalados não sincronizarão bancos SQLite entre si. Cada gravação confirmada será executada uma única vez no servidor e ficará imediatamente disponível para os demais computadores.

O SQLite atual permanece como fonte oficial durante a implantação. A troca só ocorrerá depois da conferência integral dos totais, notas, cobranças, pagamentos, devoluções e documentos.

## Serviços

- API Node.js hospedada no Railway.
- PostgreSQL gerenciado no Neon.
- Armazenamento de XML, PDF, imagens e anexos em serviço compatível com S3.
- Backup do PostgreSQL com retenção e exportação externa periódica.
- HTTPS obrigatório; a senha do banco nunca será distribuída aos computadores.

## Fases

1. **Fundação:** saúde, migrations, autenticação, sessões, dispositivos, auditoria e idempotência.
2. **Cadastros:** organizações, CNPJs, usuários, clientes, empresas, produtos e regras.
3. **Operações:** XMLs, notas, itens, operações, contratos, observações e devoluções.
4. **Recebimentos:** cobranças, ajustes, pagamentos, recibos e conta-corrente.
5. **Comercial e financeiro:** confirmações, acertos de entrada, contas a pagar e relatórios.
6. **Documentos:** armazenamento central, hashes, permissões e download autenticado.
7. **Migração:** cópia do SQLite, contagens, somatórios e conferência por módulo.
8. **Piloto:** dois computadores durante uma semana, com o SQLite preservado em modo de consulta.
9. **Produção:** cinco computadores, monitoramento e backups automáticos.

## Critérios para ativação

- Nenhuma nota duplicada por chave de acesso ou identidade comercial definida.
- Cobranças, pagamentos e devoluções protegidos por transações e chaves de idempotência.
- Totais por cliente, empresa, período e status iguais entre SQLite e PostgreSQL.
- Perfis de acesso testados.
- Recuperação de backup executada em ambiente separado.
- Aplicativo apresenta conexão indisponível sem aceitar gravações locais divergentes.

## Configuração local

1. Copiar `server/.env.example` para `server/.env`.
2. Iniciar PostgreSQL e API com `docker compose -f docker-compose.central.yml up --build`.
3. Criar o primeiro administrador definindo `ADMIN_USERNAME`, `ADMIN_PASSWORD` e `ADMIN_DISPLAY_NAME`, então executar `npm run server:create-admin`.
4. Conferir `GET /health`, `GET /ready`, login, sessão e logout.

O arquivo `server/.env` contém segredos e não deve ser enviado ao Git.

