@echo off
setlocal
title ZERAR dados - Sistema de Operacoes de Cafe

echo.
echo ============================================================
echo  ZERAR DADOS LOCAIS - SISTEMA DE OPERACOES DE CAFE
echo ============================================================
echo.
echo Este procedimento apaga o banco local, documentos gerados,
echo importacoes XML, cobrancas, confirmacoes, sessoes e logs locais.
echo.
echo Use somente quando quiser abrir o sistema como primeiro uso.
echo Para atualizar mantendo dados, NAO execute este arquivo.
echo.

choice /C SN /N /M "Tem certeza que deseja apagar TODOS os dados locais? [S/N] "
if errorlevel 2 (
  echo.
  echo Operacao cancelada.
  pause
  exit /b 1
)

echo.
echo Fechando processos do sistema, se estiverem abertos...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process SistemaOperacoesCafe,OperacoesCafe,electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"

set "APP_DATA_DIR=%APPDATA%\Sistema de Operacoes de Cafe Multiempresa"

echo.
echo Apagando pasta:
echo %APP_DATA_DIR%

if exist "%APP_DATA_DIR%" (
  rmdir /s /q "%APP_DATA_DIR%"
  echo Dados locais apagados com sucesso.
) else (
  echo Nenhuma pasta de dados local foi encontrada.
)

echo.
echo Pronto. Agora instale ou abra o sistema novamente.
echo Ele vai iniciar como primeiro uso.
echo.
pause
