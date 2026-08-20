param(
    [Parameter(Mandatory = $true)]
    [string]$Endpoint,

    [Security.SecureString]$UploadSecret
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceExe = Join-Path $projectRoot 'bin\VrchatStatusSync.exe'
$exampleConfig = Join-Path $projectRoot 'config.example.json'
$installDirectory = Join-Path $env:LOCALAPPDATA 'EasonVrchatStatus'
$configDirectory = Join-Path $env:APPDATA 'EasonVrchatStatus'
$installedExe = Join-Path $installDirectory 'VrchatStatusSync.exe'
$installedConfig = Join-Path $configDirectory 'config.json'
$taskName = 'Eason VRChat Status Sync'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValueName = 'EasonVrchatStatusSync'

if (-not (Test-Path -LiteralPath $sourceExe)) { throw '请先运行 build.ps1。' }
if (-not [Uri]::IsWellFormedUriString($Endpoint, [UriKind]::Absolute)) { throw 'Worker 地址无效。' }

$secretSecure = $UploadSecret
if ($null -eq $secretSecure) {
    $secretSecure = Read-Host '请输入 Worker 的 UPLOAD_SECRET' -AsSecureString
}
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretSecure)
try {
    $secretPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($secretPlain)
    $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($secretBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $protectedSecret = [Convert]::ToBase64String($protectedBytes)
    [Array]::Clear($secretBytes, 0, $secretBytes.Length)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    $secretPlain = $null
}

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force

$config = Get-Content -Raw -LiteralPath $exampleConfig | ConvertFrom-Json
$config.Endpoint = $Endpoint
$config.UploadSecretProtected = $protectedSecret
$config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $installedConfig -Encoding UTF8

$action = New-ScheduledTaskAction -Execute $installedExe -Argument ('--config "{0}"' -f $installedConfig)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$startupMode = '计划任务'
try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description '同步 VRChat 在线状态到 Eason 个人主页' -Force | Out-Null
    Remove-ItemProperty -LiteralPath $runKey -Name $runValueName -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName $taskName
} catch {
    # Standard user sessions may not be allowed to register scheduled tasks.
    $startupMode = '当前用户启动项'
    $runCommand = '"{0}" --config "{1}"' -f $installedExe, $installedConfig
    New-Item -Path $runKey -Force | Out-Null
    New-ItemProperty -LiteralPath $runKey -Name $runValueName -Value $runCommand -PropertyType String -Force | Out-Null
    Start-Process -FilePath $installedExe -ArgumentList @('--config', ('"{0}"' -f $installedConfig)) -WindowStyle Hidden
}

Write-Host ("安装完成：同步程序已经启动，并会通过{0}随 Windows 登录自动运行。" -f $startupMode)
Write-Host ('配置文件：{0}' -f $installedConfig)
