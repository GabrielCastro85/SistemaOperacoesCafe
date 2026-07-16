# Branding

Villa Coffee: preto, dourado, bege e verde. Nome exibido: Villa Coffee Operacoes.

Grao & Grao: verde, bege, branco e marrom. Nome exibido: Grao & Grao Operacoes.

Multiempresa: variante neutra que permite alternancia entre organizacoes.

Logos e icones nao ficam embutidos como Base64. Substitua arquivos em `assets/branding/villa`, `assets/branding/grao` ou `assets/branding/multiempresa` usando PNG, SVG ou WebP.

Pela interface, use Configuracoes > Identidade visual para selecionar logo principal, logo reduzida ou icone. O processo principal valida extensao, tamanho ate 5 MB e existencia, copia para `userData/settings/branding/<organization-id>/` e atualiza o banco. Quando nao existir logo, a interface usa fallback textual.

Alteracoes de cores da organizacao atual atualizam as variaveis de tema do renderer sem exigir reinicio.
