$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'native-win\bin'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$frameworkDirectory = Join-Path ${env:ProgramFiles(x86)} 'Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8'
$uiaDirectory = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\WPF'
& $compilerPath /nologo /target:exe /platform:x64 /optimize+ /warnaserror+ "/out:$outputDirectory\Seyvo.Native.exe" /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "/reference:$uiaDirectory\UIAutomationClient.dll" "/reference:$uiaDirectory\UIAutomationTypes.dll" "/reference:$uiaDirectory\WindowsBase.dll" (Join-Path $projectRoot 'native-win\Program.cs') (Join-Path $projectRoot 'native-win\CuePlayer.cs')
if ($LASTEXITCODE -ne 0) { throw 'Native compilation failed' }
