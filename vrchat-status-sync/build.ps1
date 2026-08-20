$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $projectRoot 'src\VrchatStatusSync.cs'
$outputDirectory = Join-Path $projectRoot 'bin'
$outputPath = Join-Path $outputDirectory 'VrchatStatusSync.exe'
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
    throw '找不到 Windows C# 编译器。'
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
& $compiler /nologo /optimize+ /target:exe /platform:anycpu /out:$outputPath /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll $sourcePath
if ($LASTEXITCODE -ne 0) { throw '同步程序编译失败。' }

Get-Item -LiteralPath $outputPath | Select-Object FullName, Length, LastWriteTime
