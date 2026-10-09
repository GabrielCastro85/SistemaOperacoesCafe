$ErrorActionPreference = "Stop"

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$startupLog = Join-Path $packageDirectory "coletor-inicializacao.log"
$statusPath = Join-Path $packageDirectory "coletor-status.json"
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
  # Windows forem acionados ao mesmo tempo. Um processo ainda listado pode
  # estar travado; nesse caso o status deixa de ser renovado e ele e reiniciado.
  $running = Get-Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
  if ($running) {
    $newestProcess = $running | Sort-Object StartTime -Descending | Select-Object -First 1
    if ($newestProcess -and ((Get-Date) - $newestProcess.StartTime).TotalMinutes -le 10) {
      Write-StartupLog "Coletor iniciou recentemente; aguardando a primeira varredura."
      exit 0
    }
    $lastActivity = $null
    if (Test-Path -LiteralPath $statusPath) {
      try {
        $status = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
        $lastActivity = [DateTimeOffset]::Parse([string]$status.updatedAt)
      } catch {
        $lastActivity = [DateTimeOffset](Get-Item -LiteralPath $statusPath).LastWriteTimeUtc
      }
    }
    if ($lastActivity -and ([DateTimeOffset]::UtcNow - $lastActivity.ToUniversalTime()).TotalMinutes -le 10) {
      Write-StartupLog "Coletor ja estava em execucao e com atividade recente."
      exit 0
    }
    Write-StartupLog "Processo encontrado sem atividade recente; reiniciando o coletor."
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
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
