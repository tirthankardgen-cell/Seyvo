param([Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$RootProcessId, [switch]$CloseToTray)
$ErrorActionPreference = 'Stop'
if ($CloseToTray) {
  $ownedWindowProcess = Get-Process -Id $RootProcessId
  for ($attempt = 0; $attempt -lt 30 -and $ownedWindowProcess.MainWindowHandle -eq [IntPtr]::Zero; $attempt++) {
    Start-Sleep -Milliseconds 100
    $ownedWindowProcess.Refresh()
  }
  if (-not $ownedWindowProcess.CloseMainWindow()) { throw 'Owned benchmark window could not be closed to tray.' }
  'close-requested'
  return
}
# Read only counters for the benchmark's process tree. Never inspect command
# lines, process memory, window titles, clipboard data or another application's UI.
$processRows = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
$ownedIds = [System.Collections.Generic.HashSet[int]]::new()
[void]$ownedIds.Add($RootProcessId)
do {
  $added = $false
  foreach ($row in $processRows) {
    if ($ownedIds.Contains([int]$row.ParentProcessId) -and $ownedIds.Add([int]$row.ProcessId)) { $added = $true }
  }
} while ($added)
$counters = @(
  foreach ($processId in $ownedIds) {
    $observed = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -ne $observed) {
      [pscustomobject]@{
        id = $observed.Id
        cpuMilliseconds = $observed.TotalProcessorTime.TotalMilliseconds
        privateBytes = $observed.PrivateMemorySize64
        workingSetBytes = $observed.WorkingSet64
      }
    }
  }
)
$externalConnections = $null
try {
  $externalConnections = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object {
    $_.State -eq 'Established' -and $ownedIds.Contains([int]$_.OwningProcess) -and $_.RemoteAddress -notin @('127.0.0.1','::1')
  }).Count
} catch { # An unavailable OS counter must not be reported as zero connections.
}
[pscustomobject]@{
  timestampMilliseconds = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  logicalProcessors = [Environment]::ProcessorCount
  visibleMainWindow = ((Get-Process -Id $RootProcessId).MainWindowHandle -ne [IntPtr]::Zero)
  processes = $counters
  externalTcpConnections = $externalConnections
} | ConvertTo-Json -Depth 4 -Compress
