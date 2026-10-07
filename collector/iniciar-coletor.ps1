$ErrorActionPreference = "Stop"

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$startupLog = Join-Path $packageDirectory "coletor-inicializacao.log"
$executable = Get-ChildItem -LiteralPath $packageDirectory -Filter "ColetorGraoBase-*-portable.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

function Write-StartupLog([string]$message) {
  try {
    Add-Content -LiteralPath $startupLog -Value "$(Get-Date -Format o) $message" -Encoding UTF8
  } catch {}
}

try {
  if (-not $executable) {
    throw "O executavel do Coletor GraoBase nao foi encontrado nesta pasta."
  }

  # Evita abrir uma segunda copia quando os mecanismos de inicializacao do
  # Windows ou a vigilancia de cinco minutos forem acionados ao mesmo tempo.
  $running = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
  if ($running) {
    Write-StartupLog "Coletor ja estava em execucao."
    exit 0
  }

  Write-StartupLog "Tentando iniciar $($executable.Name)."
  Start-Process -FilePath $executable.FullName -WorkingDirectory $packageDirectory -WindowStyle Hidden
  Start-Sleep -Seconds 8
  $started = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
  if (-not $started) {
    throw "O executavel foi chamado, mas o processo nao permaneceu aberto."
  }
  Write-StartupLog "Coletor iniciado com sucesso."
} catch {
  Write-StartupLog "Falha ao iniciar: $($_.Exception.Message)"
  throw
}
