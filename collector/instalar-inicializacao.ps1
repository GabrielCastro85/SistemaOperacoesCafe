$ErrorActionPreference = "Stop"

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$executable = Get-ChildItem -LiteralPath $packageDirectory -Filter "ColetorGraoBase-*-portable.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$configuration = Join-Path $packageDirectory "coletor-config.json"

if (-not $executable) {
  throw "O executavel do Coletor GraoBase nao foi encontrado nesta pasta."
}
if (-not (Test-Path -LiteralPath $configuration)) {
  throw "O arquivo coletor-config.json nao foi encontrado nesta pasta."
}

$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Coletor GraoBase.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $executable.FullName
$shortcut.WorkingDirectory = $packageDirectory
$shortcut.Description = "Envia XMLs autorizados da Vulpe para o GraoBase"
$shortcut.Save()

# Encerra uma versao anterior para que a atualizacao comece a funcionar sem
# depender da proxima reinicializacao do Windows.
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like "ColetorGraoBase*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Start-Process -FilePath $executable.FullName -WorkingDirectory $packageDirectory -WindowStyle Hidden
Write-Host "Coletor instalado na inicializacao do Windows e iniciado com sucesso."
Write-Host "Confira coletor-status.json nesta pasta depois de alguns minutos."
Read-Host "Pressione ENTER para fechar"
