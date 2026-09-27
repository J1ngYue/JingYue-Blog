# 私密日历与账单部署

博客页面不保存密码、DeepSeek 密钥或私密数据。日历与账单由独立的 Cloudflare Worker + D1 提供，未配置时页面保持锁定。此前在聊天中公开过的密码和 API 密钥不能继续使用：先撤销旧 DeepSeek 密钥，再创建新密钥和新的独立管理密码。

## 1. 创建 D1 与 Worker

在 Cloudflare 登录后，在仓库根目录运行 Wrangler（本机可用 `node node_modules/wrangler/bin/wrangler.js` 代替命令名）：

```text
wrangler d1 create jingyue-private-hub
```

把返回的真实 `database_id` 填入 `private-worker/wrangler.jsonc`，替换全零占位符。然后执行：

```text
wrangler d1 migrations apply jingyue-private-hub --remote --config private-worker/wrangler.jsonc
```

在 Cloudflare Dashboard 为这个 Worker 添加三个 Secret：

- `ADMIN_PASSWORD`：重新设置的强密码，切勿复用聊天中出现过的密码。
- `DEEPSEEK_API_KEY`：撤销旧密钥后重新生成的密钥。仅 Worker 可读取。
- `REMINDER_TO`：你的 QQ 收件邮箱。它是收件地址，不是 QQ SMTP 发信凭据。

在 Cloudflare Dashboard 创建同名 Worker 并设置 Secret 后，部署代码：

```text
wrangler deploy --config private-worker/wrangler.jsonc
```

将自定义域名 `private.j1ngyue.cn` 指向该 Worker。`ALLOWED_ORIGIN` 目前只允许 `https://blog.j1ngyue.cn`；如果博客主域名改变，要同步修改并重新部署。不要给 Worker 添加公开数据接口或宽松 CORS。

## 2. 邮件发送

在 Cloudflare 的 Email Routing / Email Service 中验证 QQ 邮箱作为收件地址。为 `j1ngyue.cn` 配置 Cloudflare 要求的发信域名 DNS（SPF、DKIM、DMARC），确认 `reminder@j1ngyue.cn` 可以作为发件地址；否则改动 `REMINDER_FROM` 并重新部署。Worker 的 `EMAIL` binding 已写入配置。QQ 邮箱只收信，不需要在 Worker 中保存 QQ 邮箱密码或 SMTP 授权码。

定时任务每天 12:00 UTC（北京时间 20:00）检查次日提醒。只有勾选“提前一天发邮件”的日子才会发送，年度重复按月日匹配；2 月 29 日在非闰年不会提醒。提醒记录用于防止同一天重复发送。正式上线前请先创建一条测试日期，验证 QQ 邮箱能收到邮件并检查垃圾箱。

## 3. 博客构建

在博客的构建环境设置公开变量：

```text
PUBLIC_PRIVATE_API_URL=https://private.j1ngyue.cn
```

这个变量只是 API 地址，可以出现在前端；密码、DeepSeek 密钥和账单内容均不可写成 `PUBLIC_` 变量。日历/账单页面始终显示密码输入框，但配置完成前“解锁空间”按钮不可用。重新构建并发布博客后才可登录。若网站并非 `https://blog.j1ngyue.cn`，还需更改 `ALLOWED_ORIGIN`。配置完成前不会回退到公开演示数据。

## 4. 安全与维护

登录 cookie 设置为 `HttpOnly`、`Secure`、`SameSite=Strict`，12 小时过期；登录失败按来源 IP 限速。D1 保存事件、账单和会话，页面不会把明文密码存入浏览器存储。Cloudflare 账号建议开启双因素认证，定期导出 D1 备份；部署时确认 D1 免费额度和邮件服务额度满足使用量。

选择“AI 自动识别/分类”时，输入的日期标题或账单用途会发送给 DeepSeek 处理；不希望发送某条说明时，请手动选类型或分类。

若想完全停止 GitHub 的工作流通知，请在自己的 GitHub 账号 Settings → Notifications 调整 Actions 的邮件通知；仓库不会因此关闭代码质量检查。本次已经修正导致近期检查失败的格式问题。
