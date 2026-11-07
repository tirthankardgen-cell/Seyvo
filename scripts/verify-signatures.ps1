param(
  [string]$InstallerPath,
  [string]$AppDirectory = 'dist\win-unpacked',
  [string]$ExpectedSubject,
  [switch]$AllowUnsigned
)
$ErrorActionPreference = 'Stop'
# npm may inherit a PowerShell 7 module path while launching Windows PowerShell.
# Resolve the security module from the interpreter actually executing this file.
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $InstallerPath) {
  $version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
  $InstallerPath = Join-Path $projectRoot "dist\Seyvo-$version-windows-x64-setup.exe"
}
if (-not [IO.Path]::IsPathRooted($AppDirectory)) { $AppDirectory = Join-Path $projectRoot $AppDirectory }
if (-not $AllowUnsigned -and [string]::IsNullOrWhiteSpace($ExpectedSubject)) {
  throw 'Signed release verification requires the exact approved certificate subject.'
}
$targets = @(
  $InstallerPath,
  (Join-Path $AppDirectory 'Seyvo.exe'),
  (Join-Path $AppDirectory 'resources\native\Seyvo.Native.exe')
)
$results = foreach ($target in $targets) {
  $file = Get-Item -LiteralPath $target -ErrorAction Stop
  if ($file.PSIsContainer) { throw 'Expected a binary file.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
  [pscustomobject]@{
    File = $file.Name
    SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    Status = $signature.Status.ToString()
    Subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    Timestamped = $null -ne $signature.TimeStamperCertificate
    ExpectedPublisher = $signature.SignerCertificate -and $signature.SignerCertificate.Subject -ceq $ExpectedSubject
  }
}
$results | ConvertTo-Json -Depth 3
if (-not $AllowUnsigned -and @($results | Where-Object { $_.Status -ne 'Valid' -or -not $_.Timestamped -or -not $_.ExpectedPublisher }).Count) {
  throw 'Signing gate failed: every first-party executable and installer must have a trusted timestamped signature from the approved publisher.'
}
if ($AllowUnsigned) { Write-Output 'Inspection only. This does not pass the signed-release gate.' }
