// Site completo: o preload do app (com o "electron" trocado por web/electronRenderer.ts)
// cria window.operationsCafe, e em seguida as mesmas telas do app sao carregadas.
import "../electron/preload/index.ts";
import "../src/renderer/App.tsx";
