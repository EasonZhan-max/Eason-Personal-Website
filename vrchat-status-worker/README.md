# Eason VRChat Status Worker

该 Worker 只保存本地同步程序上传的公开状态，不保存 VRChat 密码、Cookie、登录令牌或房间实例 ID。

## 本地检查

1. 执行 `npm install`。
2. 将 `.dev.vars.example` 复制为 `.dev.vars`，换成本地测试密钥。
3. 执行 `npm run types`、`npm run check`、`npm run dev`。

## 部署

1. 登录 Cloudflare：`npx wrangler login`。
2. 生成至少 32 字节的随机上传密钥。
3. 执行 `npx wrangler secret put UPLOAD_SECRET` 并输入密钥。
4. 执行 `npm run deploy`。KV 命名空间会由 Wrangler 自动配置。
5. 将部署后的 `https://...workers.dev/status` 填入网站 `index.html` 的 `vrc-status-endpoint` meta 标签。
6. 将同一上传密钥与 Worker 的 `/status` 地址写入本地同步程序配置。

公开读取接口是 `GET /status`；带 HMAC 签名的上传接口是 `POST /status`。
