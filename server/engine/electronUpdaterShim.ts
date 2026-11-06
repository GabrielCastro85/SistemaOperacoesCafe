// No site nao ha instalador para atualizar: o servidor sempre roda a versao publicada.
const autoUpdater = {
  logger: null as unknown, autoDownload: false, autoInstallOnAppQuit: false,
  on: () => autoUpdater,
  checkForUpdates: async () => null,
  quitAndInstall: () => undefined
};
export { autoUpdater };
export default { autoUpdater };
