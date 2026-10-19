import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "../src/renderer/pages/auth/loginErrorMessage";

describe("loginErrorMessage", () => {
  it("reduces the Electron IPC 401 error to the credential reason", () => {
    expect(loginErrorMessage(new Error("Error invoking remote method 'auth:login': Error: Servidor central (401): Usuario ou senha invalidos.")))
      .toBe("Usuário ou senha incorretos.");
  });

  it("shows a useful connection message without technical details", () => {
    expect(loginErrorMessage(new TypeError("fetch failed")))
      .toBe("Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
  });

  it("removes server and detail prefixes from a readable message", () => {
    expect(loginErrorMessage(new Error("Servidor central (409): Nao foi possivel sincronizar. Detalhe: conflito interno")))
      .toBe("Nao foi possivel sincronizar.");
  });
});
