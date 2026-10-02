# 私密日历与账单部署

博客页面不保存密码、DeepSeek 密钥或私密数据。日历与账单由独立的 Cloudflare Worker + D1 提供，未配置时页面保持锁定。此前在聊天中公开过的密码和 API 密钥不能继续使用：先撤销旧 DeepSeek 密钥，再创建新密钥和新的独立管理密码。

## 1. 创建 D1 与 Worker

`jingyue-private-hub` Worker、D1 数据库和 `private.j1ngyue.cn` 自定义域名已创建。以下命令仅供重新部署或恢复时使用；不要重复创建同名数据库。

在 Cloudflare 登录后，在仓库根目录运行 Wrangler（本机可用 `node node_modules/wrangler/bin/wrangler.js` 代替命令名）：

```text
wrangler d1 create jingyue-private-hub
```

初次创建时把返回的真实 `database_id` 填入 `private-worker/wrangler.jsonc`。当前仓库已填好 ID，迁移也已应用；新建数据库时才需执行：

```text
wrangler d1 migrations apply jingyue-private-hub --remote --config private-worker/wrangler.jsonc
```

在 Cloudflare Dashboard 为这个 Worker 添加 Secret：

- `ADMIN_PASSWORD`：重新设置的强密码，切勿复用聊天中出现过的密码。
- `DEEPSEEK_API_KEY`：撤销旧密钥后重新生成的密钥。仅 Worker 可读取。
- `REMINDER_TO`：你的 QQ 收件邮箱。它是收件地址，不是 QQ SMTP 发信凭据。
- `RESEND_API_KEY`：在 Resend 免费账户创建的发信密钥。只填入 Worker Secret，不要写进仓库或前端。

设置好管理密码后部署代码：

```text
wrangler deploy --config private-worker/wrangler.jsonc
```

自定义域名 `private.j1ngyue.cn` 已绑定该 Worker。私密接口的 `ALLOWED_ORIGIN` 只允许 `https://blog.j1ngyue.cn`；如果博客主域名改变，要同步修改并重新部署。日历、账单和会话接口不允许公开读取或宽松 CORS。

## 2. 邮件发送

使用 Resend 免费档发信，不启用需要付费的 Cloudflare Email Sending。先在 Resend 中添加并验证发信子域名 `notify.j1ngyue.cn`，按其页面显示的记录在 Cloudflare DNS 中配置发信所需的 DKIM TXT 和两条 CNAME；只添加 `notify` 下级记录，不要改 `j1ngyue.cn` 根域名的 MX 收信记录，也无需为 Resend 开启收信。验证成功后，确认 `REMINDER_FROM` 为 `JingYue 日历 <reminder@notify.j1ngyue.cn>`，并将新密钥设为 Worker Secret `RESEND_API_KEY`。`REMINDER_TO` 保持为 QQ 收件邮箱。QQ 邮箱只收信，不需要在 Worker 中保存 QQ 邮箱密码或 SMTP 授权码。

完成配置并部署后，解锁日历，点“发送测试邮件”；这个入口只向固定的 `REMINDER_TO` 发信、每天最多一次。收到测试信后，再创建一条测试日期验证日历提醒。定时任务每天 12:00 UTC（北京时间 20:00）检查次日提醒。只有勾选“提前一天发邮件”的日子才会发送，年度重复按月日匹配；2 月 29 日在非闰年不会提醒。提醒记录与 Resend 幂等键用于防止同一天重复发送。

Resend 免费档当前每月 3,000 封、每天 100 封；不要在账户中升级付费套餐或启用超额计费。达到免费额度时邮件可能发送失败，日历与账单数据本身不受影响。发信子域名与 QQ 收件地址是两回事：邮件仍送往 `REMINDER_TO`，不会改变邮箱收信路径。

## 3. 博客构建

博客默认连接 `https://private.j1ngyue.cn`。仅在需要覆盖该地址时，才在构建环境设置公开变量：

```text
PUBLIC_PRIVATE_API_URL=https://private.j1ngyue.cn
```

这个变量只是 API 地址，可以出现在前端；密码、DeepSeek 密钥和账单内容均不可写成 `PUBLIC_` 变量。日历/账单页面始终显示密码输入框，但配置完成前“解锁空间”按钮不可用。重新构建并发布博客后才可登录。若网站并非 `https://blog.j1ngyue.cn`，还需更改 `ALLOWED_ORIGIN`。配置完成前不会回退到公开演示数据。

## 4. 安全与维护

登录 cookie 设置为 `HttpOnly`、`Secure`、`SameSite=Strict`，12 小时过期；登录失败按来源 IP 限速。D1 保存事件、账单和会话，页面不会把明文密码存入浏览器存储。Cloudflare 账号建议开启双因素认证，定期导出 D1 备份；部署时确认 D1 免费额度和邮件服务额度满足使用量。

选择“AI 自动识别/分类”时，输入的日期标题或账单用途会发送给 DeepSeek 处理；不希望发送某条说明时，请手动选类型或分类。

## 5. 公开文章 AI 摘要

`GET /article-summary?slug=...&version=...` 复用服务端 `DEEPSEEK_API_KEY`，不接收读者提交的正文、提示词或模型参数。Worker 仅从本站正式托管地址 `https://jing-yue-blog.vercel.app/api/article-sources.json` 获取公开文章白名单；草稿、加密文章不进入该清单。此独立公开接口允许主域名及正式托管域名，不携带登录 Cookie，不放宽其他私密接口。

`0002_article_summaries.sql` 给现有 D1 新增摘要缓存表，不改日历、账单或会话数据。摘要按标题与完整正文的 SHA-256 版本缓存，多人同时访问只保留一个生成请求；每个版本最多尝试三次，失败后保留一分钟冷却，不提供读者强制刷新。正文较长时，仅发送前 14,000 与后 4,000 个字符，并标记省略内容。DeepSeek 使用非思考模式，每次输出最多 600 tokens。

文章开头按 AI 摘要、封面图、蓝色提示排列。摘要和封面默认展开，可平滑折叠；AI 不可用时明确显示作者简介而非伪称 AI 结果。提示优先读取文章 frontmatter 的 `notice`，未填写则沿用 `description`。新文章和正文修改随正常博客构建自动更新清单；Worker 五分钟内刷新清单并为新版本生成摘要。

若想完全停止 GitHub 的工作流通知，请在自己的 GitHub 账号 Settings → Notifications 调整 Actions 的邮件通知；仓库不会因此关闭代码质量检查。本次已经修正导致近期检查失败的格式问题。
