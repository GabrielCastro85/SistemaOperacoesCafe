import type { OperationsCafeApi } from "../../electron/preload/index";

declare global {
  interface Window {
    operationsCafe: OperationsCafeApi;
  }
}

export {};
