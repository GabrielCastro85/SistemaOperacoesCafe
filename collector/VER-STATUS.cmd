@echo off
if exist "%~dp0coletor-status.json" (
  type "%~dp0coletor-status.json"
) else (
  echo O coletor ainda nao gerou o arquivo de status.
)
echo.
pause
