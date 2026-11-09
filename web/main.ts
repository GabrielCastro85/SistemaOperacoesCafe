// Site completo: o preload do app (com o "electron" trocado por web/electronRenderer.ts)
// cria window.operationsCafe, em seguida as mesmas telas do app sao carregadas e,
// por ultimo, o tema do site (so no navegador; o programa do Windows nao muda).
import "../electron/preload/index.ts";
import "../src/renderer/App.tsx";
import "./site-theme.css";
import { startSiteEnhancer } from "./siteEnhancer";

startSiteEnhancer();
