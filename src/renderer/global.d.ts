import type { OperationsCafeApi, OperationsCafeLoadingApi } from "../../electron/preload/index";

declare module "*.svg" {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    operationsCafe: OperationsCafeApi;
    operationsCafeLoading: OperationsCafeLoadingApi;
  }
}

export {};
