$ErrorActionPreference = "Stop"

$projectDir = "C:\Users\gabri\OneDrive\Documentos\SistemaOperacoesCafe"
Set-Location -LiteralPath $projectDir

Write-Host "Abrindo Sistema de Operacoes de Cafe em modo desenvolvimento..."
Write-Host "Projeto: $projectDir"
Write-Host ""
Write-Host "Para fechar, feche a janela do app e depois esta janela do terminal."
Write-Host ""

npm run dev:electron
