# Deploy das Edge Functions do dashboard para o Supabase.
#
# Pre-requisitos (uma vez):
#   1. Instalar a CLI:  scoop install supabase   (ou: https://supabase.com/docs/guides/cli)
#   2. Logar:           supabase login
#   3. Preencher supabase/functions.env (use functions.env.example como base)
#
# Uso:  pwsh supabase/deploy.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "nowckxkcwlzbmjfyinfu"
$Functions = @("kommo", "clickup", "goals", "tasks", "avisos", "eventos", "aniversariantes")
$EnvFile = Join-Path $PSScriptRoot "functions.env"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Error "CLI do Supabase nao encontrada. Instale: https://supabase.com/docs/guides/cli"
}

if (-not (Test-Path $EnvFile)) {
  Write-Error "Arquivo nao encontrado: $EnvFile (copie de functions.env.example e preencha)"
}

Write-Host "==> Aplicando secrets (Kommo / ClickUp)..." -ForegroundColor Cyan
supabase secrets set --project-ref $ProjectRef --env-file $EnvFile
if (-not $?) { Write-Error "Falha ao aplicar secrets" }

foreach ($fn in $Functions) {
  Write-Host "==> Deploy da funcao: $fn" -ForegroundColor Cyan
  supabase functions deploy $fn --project-ref $ProjectRef
  if (-not $?) { Write-Error "Falha no deploy da funcao $fn" }
}

Write-Host "==> Tudo pronto. 7 funcoes publicadas." -ForegroundColor Green
