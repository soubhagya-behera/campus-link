<#!
.SYNOPSIS
  Provision a local CAMPUSLINK account with a masked password prompt.
.DESCRIPTION
  Creates (never modifies) a user with a scrypt-hashed password. Validates
  email, role, and the required profile/company association. The password is
  never printed, logged, or stored in source control.
.EXAMPLE
  .\scripts\Provision-User.ps1 -Email "officer@college.local" -Role STAFF
  .\scripts\Provision-User.ps1 -Email "recruiter@zenith.local" -Role RECRUITER -CompanyId "<id>"
  .\scripts\Provision-User.ps1 -Email "student@college.local" -Role STUDENT -StudentProfileId "<id>"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Email,
  [Parameter(Mandatory = $true)][ValidateSet("STUDENT", "RECRUITER", "STAFF", "ADMIN")][string]$Role,
  [string]$StudentProfileId = "",
  [string]$CompanyId = ""
)

$ErrorActionPreference = "Stop"

$first = Read-Host -Prompt "Enter password for $Email (12+ chars, hidden)" -AsSecureString
$second = Read-Host -Prompt "Confirm password (hidden)" -AsSecureString
$toPlain = {
  param($s)
  $p = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
}
$pw1 = & $toPlain $first
$pw2 = & $toPlain $second
$first.Dispose(); $second.Dispose()
if ($pw1 -cne $pw2) { Write-Error "Passwords do not match. Nothing was created."; exit 1 }

$env:PROVISION_PASSWORD = $pw1
$pw1 = $null; $pw2 = $null
try {
  $args = @("scripts/provision-user.ts", "--email", $Email, "--role", $Role)
  if ($StudentProfileId) { $args += @("--student-profile-id", $StudentProfileId) }
  if ($CompanyId) { $args += @("--company-id", $CompanyId) }
  npx tsx @args
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  $env:PROVISION_PASSWORD = $null
}
