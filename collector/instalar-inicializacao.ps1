$ErrorActionPreference = "Stop"

$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdministrator) {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $elevatedProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
  exit $elevatedProcess.ExitCode
}

$sourceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceExecutable = Get-ChildItem -LiteralPath $sourceDirectory -Filter "ColetorGraoBase-*-portable.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$sourceConfiguration = Join-Path $sourceDirectory "coletor-config.json"
if (-not $sourceExecutable) { throw "O executavel do Coletor GraoBase nao foi encontrado no pacote." }
if (-not (Test-Path -LiteralPath $sourceConfiguration)) { throw "O arquivo coletor-config.json nao foi encontrado no pacote." }

# Uma pasta local continua disponivel antes do login. Area de Trabalho e
# OneDrive podem ainda nao existir quando a tarefa do usuario SYSTEM inicia.
$packageDirectory = Join-Path $env:ProgramData "GraoBase\Coletor"
New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like "ColetorGraoBase*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Copy-Item -LiteralPath $sourceExecutable.FullName -Destination (Join-Path $packageDirectory $sourceExecutable.Name) -Force
Copy-Item -LiteralPath $sourceConfiguration -Destination (Join-Path $packageDirectory "coletor-config.json") -Force
foreach ($fileName in @("iniciar-coletor.ps1", "VER-STATUS.cmd", "README-INSTALACAO.txt")) {
  $sourceFile = Join-Path $sourceDirectory $fileName
  if (Test-Path -LiteralPath $sourceFile) {
    Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $packageDirectory $fileName) -Force
  }
}

$launcherScript = Join-Path $packageDirectory "iniciar-coletor.ps1"
if (-not (Test-Path -LiteralPath $launcherScript)) { throw "O iniciador do coletor nao foi encontrado no pacote." }

$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Coletor GraoBase.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
$shortcut.WorkingDirectory = $packageDirectory
$shortcut.Description = "Envia XMLs autorizados da Vulpe para o GraoBase"
$shortcut.Save()

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
Set-ItemProperty -Path $runKey -Name "ColetorGraoBase" -Value $runCommand

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
$systemPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# Nao imponha limite de duracao: o Agendador pode manter o executavel filho no
# mesmo job da tarefa e encerrava o coletor poucos minutos depois de inicia-lo.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "Coletor GraoBase - Inicializacao" -Action $action -Trigger $startupTrigger -Principal $systemPrincipal -Settings $settings -Description "Inicia o coletor de NF-e do GraoBase junto com o computador" -Force | Out-Null

$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "Coletor GraoBase - Vigilancia" -Action $action -Trigger $watchdogTrigger -Principal $systemPrincipal -Settings $settings -Description "Reabre o coletor de NF-e do GraoBase se ele parar" -Force | Out-Null
Unregister-ScheduledTask -TaskName "Coletor GraoBase" -Confirm:$false -ErrorAction SilentlyContinue

& $launcherScript
Start-Sleep -Seconds 10
$started = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
if (-not $started) {
  throw "O coletor foi configurado, mas nao permaneceu em execucao. Consulte $packageDirectory\coletor-inicializacao.log."
}

Write-Host "Coletor instalado em $packageDirectory e iniciado com sucesso."
Write-Host "Ele inicia antes do login e a vigilancia verifica o processo a cada dois minutos."
Write-Host "As proximas atualizacoes e comandos podem ser enviados pelo programa Operacoes Cafe."
Read-Host "Pressione ENTER para fechar"
