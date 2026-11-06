import { AsyncLocalStorage } from "node:async_hooks";

// O que uma chamada do site produziu alem do valor de retorno: arquivos que o
// app abriria no Windows (viram download), paginas para imprimir, texto ou
// imagem copiados. Tambem carrega os arquivos que o navegador enviou para
// responder a um dialogo de "abrir arquivo".
export interface EngineDownload { name: string; path: string }
export interface EngineRequestContext {
  downloads: EngineDownload[];
  // Caminhos devolvidos pelo "salvar como": o que o app gravar ali vai para o navegador.
  savedPaths: string[];
  prints: string[];
  clipboardText: string | null;
  clipboardImagePng: Buffer | null;
  uploadedPaths: string[] | null;
  tempDir: string;
}

export class NeedsUploadError extends Error {
  constructor(readonly dialog: { title?: string; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }) {
    super("Escolha o arquivo no navegador para continuar.");
  }
}

export const requestContext = new AsyncLocalStorage<EngineRequestContext>();

export function currentRequest(): EngineRequestContext {
  const context = requestContext.getStore();
  if (!context) throw new Error("Operacao do Windows chamada fora de uma requisicao do site.");
  return context;
}
