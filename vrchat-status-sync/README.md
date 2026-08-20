# VRChat 状态同步程序

这是一个轻量 Windows 后台程序。它读取 VRChat 自己生成的日志，只上传允许公开的状态字段。

## 会自动同步

- VRChat 运行/退出状态
- 当前世界名称（不会上传 `wrld_...` 或私人实例 ID）
- 进入世界的时间，由网页计算停留时长
- `config.json` 中的昵称、代称、简介、封面、状态文字、徽章和群组

## 不会读取或上传

- VRChat 密码、Cookie、登录令牌
- 私人房间实例 ID、好友列表、聊天或语音内容

## 使用

1. 运行 `build.ps1` 生成 `bin\VrchatStatusSync.exe`。
2. 部署 Worker 并得到 `/status` 地址和上传密钥。
3. 运行 `install-startup.ps1 -Endpoint "https://你的-worker.workers.dev/status"`。
4. 按提示输入 Worker 上传密钥。密钥使用 Windows DPAPI 加密，只能由当前 Windows 账户解密。

安装器会优先注册计划任务；普通用户权限不足时会自动改用当前用户启动项，无需管理员权限。

正常退出 VRChat 时会立即同步离线；断网、崩溃或关机时，Worker 会在心跳超时后自动显示离线。
