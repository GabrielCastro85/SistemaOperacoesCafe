// Site completo: o preload do app (com o "electron" trocado por web/electronRenderer.ts)
// cria window.operationsCafe, em seguida as mesmas telas do app sao carregadas e,
// por ultimo, o tema, os acentos, os avisos flutuantes e a navegacao das telas
// longas do site (so no navegador; o programa do Windows nao muda).
import "./siteFlag";
import "../electron/preload/index.ts";
import "../src/renderer/App.tsx";
import "./site-theme.css";
import { startSiteCommand } from "./siteCommand";
import { startSiteEnhancer } from "./siteEnhancer";
import { startSitePage } from "./sitePage";
import { startSiteTables } from "./siteTables";
import { startSiteText } from "./siteText";
import { startSiteToasts } from "./siteToasts";

startSiteEnhancer();
startSiteText();
startSiteToasts();
startSitePage();
startSiteTables();
startSiteCommand();
