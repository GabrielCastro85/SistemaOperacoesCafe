@echo off
set "COLLECTOR_DIR=%ProgramData%\GraoBase\Coletor"
if not exist "%COLLECTOR_DIR%" set "COLLECTOR_DIR=%~dp0"
echo Pasta instalada: %COLLECTOR_DIR%
echo.
echo ===== ULTIMA VARREDURA =====
if exist "%COLLECTOR_DIR%\coletor-status.json" (
  type "%COLLECTOR_DIR%\coletor-status.json"
) else (
  echo O coletor ainda nao gerou o arquivo de status.
)
echo.
echo ===== INICIALIZACAO =====
if exist "%COLLECTOR_DIR%\coletor-inicializacao.log" (
  powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%COLLECTOR_DIR%\coletor-inicializacao.log' -Tail 15"
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
