$ErrorActionPreference = "Stop"

$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdministrator) {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  $elevatedProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs -Wait -PassThru
  exit $elevatedProcess.ExitCode
}

$packageDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$executable = Get-ChildItem -LiteralPath $packageDirectory -Filter "ColetorGraoBase-*-portable.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$configuration = Join-Path $packageDirectory "coletor-config.json"
$launcherScript = Join-Path $packageDirectory "iniciar-coletor.ps1"

if (-not $executable) {
  throw "O executavel do Coletor GraoBase nao foi encontrado nesta pasta."
}
if (-not (Test-Path -LiteralPath $configuration)) {
  throw "O arquivo coletor-config.json nao foi encontrado nesta pasta."
}
if (-not (Test-Path -LiteralPath $launcherScript)) {
  throw "O arquivo iniciar-coletor.ps1 nao foi encontrado nesta pasta."
}

$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Coletor GraoBase.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
$shortcut.WorkingDirectory = $packageDirectory
$shortcut.Description = "Envia XMLs autorizados da Vulpe para o GraoBase"
$shortcut.Save()

# Registra tambem no perfil do usuario. Esse mecanismo permanece como
# redundancia caso o Windows ignore temporariamente a pasta Inicializar.
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runCommand = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
Set-ItemProperty -Path $runKey -Name "ColetorGraoBase" -Value $runCommand

# As tarefas agendadas iniciam o coletor mesmo antes do login e verificam a cada
# cinco minutos se ele continua aberto. Assim uma falha isolada na inicializacao
# ou um encerramento inesperado e' corrigido sem intervencao manual.
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
  $systemPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
  $startupTrigger = New-ScheduledTaskTrigger -AtStartup
  Register-ScheduledTask -TaskName "Coletor GraoBase - Inicializacao" -Action $action -Trigger $startupTrigger -Principal $systemPrincipal -Settings $settings -Description "Inicia o coletor de NF-e do GraoBase junto com o computador" -Force | Out-Null

  $watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  Register-ScheduledTask -TaskName "Coletor GraoBase - Vigilancia" -Action $action -Trigger $watchdogTrigger -Principal $systemPrincipal -Settings $settings -Description "Reabre o coletor de NF-e do GraoBase se ele parar" -Force | Out-Null

  # Remove a tarefa antiga, que dependia do login do usuario instalador.
  Unregister-ScheduledTask -TaskName "Coletor GraoBase" -Confirm:$false -ErrorAction SilentlyContinue
} catch {
  Write-Host "As tarefas agendadas nao puderam ser criadas: $($_.Exception.Message)"
  Write-Host "A inicializacao pelo perfil do usuario continua ativa."
}

# Encerra uma versao anterior para que a atualizacao comece a funcionar sem
# depender da proxima reinicializacao do Windows.
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessName -like "ColetorGraoBase*" } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

& $launcherScript
Start-Sleep -Seconds 3
$started = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "ColetorGraoBase*" }
if (-not $started) {
  throw "O coletor foi configurado, mas nao permaneceu em execucao. Consulte coletor.log."
}
Write-Host "Coletor instalado na inicializacao do Windows e iniciado com sucesso."
Write-Host "A vigilancia automatica verificara o processo a cada cinco minutos."
Write-Host "Confira coletor-status.json nesta pasta depois de alguns minutos."
Read-Host "Pressione ENTER para fechar"
