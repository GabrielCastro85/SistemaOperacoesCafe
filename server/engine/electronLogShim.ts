// Substituto de electron-log no servidor: escreve no console (logs do Railway).
const write = (level: "info" | "warn" | "error" | "debug") => (...args: unknown[]) => console[level === "debug" ? "log" : level]("[motor]", ...args);
const log = {
  info: write("info"), warn: write("warn"), error: write("error"), debug: write("debug"), verbose: write("debug"), log: write("info"),
  initialize: () => undefined,
  transports: { file: { resolvePathFn: () => "", level: "info" }, console: { level: "info" } },
  scope: () => log
};
export default log;
