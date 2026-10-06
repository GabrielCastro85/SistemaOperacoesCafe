$ErrorActionPreference = "Stop"

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$executable = Get-ChildItem -LiteralPath $packageDirectory -Filter "ColetorGraoBase-*-portable.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $executable) {
  throw "O executavel do Coletor GraoBase nao foi encontrado nesta pasta."
}

# Evita abrir uma segunda copia quando os mecanismos de inicializacao do
# Windows forem acionados quase ao mesmo tempo.
$running = Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
if (-not $running) {
  Start-Process -FilePath $executable.FullName -WorkingDirectory $packageDirectory -WindowStyle Hidden
}
