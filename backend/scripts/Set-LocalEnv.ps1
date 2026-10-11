<#!
.SYNOPSIS
  Securely configure backend/.env for local PostgreSQL (masked password prompt).
.DESCRIPTION
  - Prompts for the PostgreSQL password with a masked prompt (never in chat).
  - URL-encodes special characters and writes backend/.env (gitignored).
  - Checks whether the `campuslink` database exists; creates it only if missing.
  - Never prints, logs, or commits the password. Never drops any database.
.NOTES
  Run this yourself in PowerShell (outside chat):
    .\scripts\Set-LocalEnv.ps1
#>
[CmdletBinding()]
param(
  [string]$PgUser = "postgres",
  [string]$PgHost = "localhost",
  [int]$PgPort = 5432,
  [string]$DbName = "campuslink",
  [string]$BinDir = "C:\Program Files\PostgreSQL\18\bin"
)

$ErrorActionPreference = "Stop"

$psql = Join-Path $BinDir "psql.exe"
$createdb = Join-Path $BinDir "createdb.exe"
$pgReady = Join-Path $BinDir "pg_isready.exe"
foreach ($exe in @($psql, $createdb, $pgReady)) {
  if (-not (Test-Path -LiteralPath $exe)) { throw "Missing tool: $exe" }
}

& $pgReady -h $PgHost -p $PgPort
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL is not accepting connections at ${PgHost}:${PgPort}." }

$secure = Read-Host -Prompt "Enter local PostgreSQL password for user '$PgUser' (input hidden)" -AsSecureString
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  $secure.Dispose()
}
if ([string]::IsNullOrEmpty($plain)) { throw "Empty password — aborted. Nothing was written." }

$encoded = [System.Uri]::EscapeDataString($plain)
$env:PGPASSWORD = $plain
try {
  # Verify credentials with a trivial query (output suppressed on success).
  $null = & $psql -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc "SELECT 1" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Authentication failed for user '$PgUser'. Check the password and pg_hba.conf. Nothing was written." }

  # Inspect existing databases; create only if missing. Never drop anything.
  $dblist = & $psql -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc "SELECT datname FROM pg_database" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Could not list databases (permissions issue). Nothing was written." }
  $exists = ($dblist -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -eq $DbName } | Select-Object -First 1)
  if ($null -eq $exists) {
    & $createdb -h $PgHost -p $PgPort -U $PgUser $DbName
    if ($LASTEXITCODE -ne 0) { throw "Failed to create database '$DbName'. Check that '$PgUser' has CREATEDB permission." }
    Write-Host "Database '$DbName' created."
  } else {
    Write-Host "Database '$DbName' already exists — leaving it untouched."
  }
} finally {
  $env:PGPASSWORD = $null
  $plain = $null
}

$databaseUrl = "postgresql://${PgUser}:${encoded}@${PgHost}:${PgPort}/${DbName}?schema=public"
$envPath = Join-Path $PSScriptRoot "..\\.env"
$envContent = "# Generated locally by scripts/Set-LocalEnv.ps1 — DO NOT COMMIT.`nDATABASE_URL=`"$databaseUrl`"`nPORT=4000`n"
Set-Content -LiteralPath $envPath -Value $envContent -Encoding UTF8

Write-Host "Wrote backend/.env (DATABASE_URL host=$PgHost db=$DbName, password hidden)."
Write-Host "Verify ignore rule with: git check-ignore -v backend/.env"
