@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "BASE=%~dp0"

title Atualizar Operacoes Cafe

echo.
echo Atualizador do Operacoes Cafe
echo =============================
echo.
echo Este script fecha o aplicativo aberto e instala a versao mais nova por cima.
echo.

call :latest "SistemaOperacoesCafe-Setup-*-x64.exe" INSTALLER

call :check "%INSTALLER%" "Operacoes Cafe"
if errorlevel 1 goto :failed

echo Fechando aplicativos abertos...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name VillaCoffeeOperacoes,GraoEGraoOperacoes,SistemaOperacoesCafe -ErrorAction SilentlyContinue | Stop-Process -Force"

call :install "%INSTALLER%" "Operacoes Cafe"
if errorlevel 1 goto :failed

echo.
echo Atualizacao concluida com sucesso.
echo Voce pode abrir o aplicativo pelo atalho da Area de Trabalho ou pelo Menu Iniciar.
echo.
pause
exit /b 0

:check
if not exist "%~1" (
  echo ERRO: instalador de %~2 nao encontrado.
  echo Esperado em: %~1
  exit /b 1
)
exit /b 0

:latest
for /f "usebackq delims=" %%F in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$file = Get-ChildItem -LiteralPath '%BASE%' -Filter '%~1' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($file) { $file.FullName }"`) do set "%~2=%%F"
exit /b 0

:install
echo.
echo Atualizando %~2...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath '%~1' -ArgumentList '/S' -Wait -PassThru; exit $p.ExitCode"
if errorlevel 1 (
  echo ERRO: falha ao atualizar %~2.
  exit /b 1
)
echo %~2 atualizado.
exit /b 0

:failed
echo.
echo A atualizacao nao foi concluida.
echo Verifique se o instalador esta na mesma pasta deste atualizador.
echo.
pause
exit /b 1
