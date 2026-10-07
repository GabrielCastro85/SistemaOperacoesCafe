@echo off
echo ===== ULTIMA VARREDURA =====
if exist "%~dp0coletor-status.json" (
  type "%~dp0coletor-status.json"
) else (
  echo O coletor ainda nao gerou o arquivo de status.
)
echo.
echo ===== INICIALIZACAO =====
if exist "%~dp0coletor-inicializacao.log" (
  powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%~dp0coletor-inicializacao.log' -Tail 15"
) else (
  echo Ainda nao existe registro de inicializacao automatica.
)
echo.
echo ===== TAREFAS DO WINDOWS =====
schtasks /Query /TN "Coletor GraoBase - Inicializacao" /FO LIST 2>nul
if errorlevel 1 echo Tarefa de inicializacao nao encontrada.
schtasks /Query /TN "Coletor GraoBase - Vigilancia" /FO LIST 2>nul
if errorlevel 1 echo Tarefa de vigilancia nao encontrada.
echo.
pause
