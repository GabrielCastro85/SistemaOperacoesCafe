$ErrorActionPreference = "Stop"

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

# A tarefa agendada oferece uma terceira tentativa no logon. Alguns ambientes
# corporativos bloqueiam sua criacao; nesse caso os dois mecanismos acima
# continuam funcionando.
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName "Coletor GraoBase" -Action $action -Trigger $trigger -Principal $principal -Description "Inicia o coletor de NF-e do GraoBase" -Force | Out-Null
} catch {
  Write-Host "A tarefa agendada nao pode ser criada; a inicializacao pelo perfil do usuario continua ativa."
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
Write-Host "Confira coletor-status.json nesta pasta depois de alguns minutos."
Read-Host "Pressione ENTER para fechar"
