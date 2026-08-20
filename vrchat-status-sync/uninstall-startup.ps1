$ErrorActionPreference = 'Stop'
$taskName = 'Eason VRChat Status Sync'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValueName = 'EasonVrchatStatusSync'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
Remove-ItemProperty -LiteralPath $runKey -Name $runValueName -ErrorAction SilentlyContinue

Write-Host '已移除开机启动。程序和配置仍保留，可手动删除。'
