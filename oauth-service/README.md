# JingYue Waline OAuth

这是 Firefly 的 Waline OAuth 适配服务，只负责 QQ、微信、Google 和 GitHub
的标准授权码登录。用户身份最终由 Waline 创建或绑定，本服务不保存账户、密码、
access token 或 refresh token。

## 部署

在 Vercel 新建项目并选择本仓库，将 Root Directory 设置为 `oauth-service`。
复制 `.env.example` 中的变量到 Vercel Environment Variables，部署后将 Waline
Server 的 `OAUTH_URL` 设置为本服务的 `OAUTH_SERVICE_URL`，然后重新部署 Waline。

Firefly 构建环境需要：

```env
PUBLIC_WALINE_SERVER_URL=https://your-waline.example.com
PUBLIC_WALINE_OAUTH_SERVICE_URL=https://jingyue-oauth.vercel.app/api
```

四个平台的授权回调分别是：

- QQ：`https://jingyue-oauth.vercel.app/api/qq`
- 微信：`https://jingyue-oauth.vercel.app/api/oidc`
- Google：`https://jingyue-oauth.vercel.app/api/google`
- GitHub：`https://jingyue-oauth.vercel.app/api/github`

如果 Vercel 最终分配的域名不是 `jingyue-oauth.vercel.app`，必须同时修改
`OAUTH_SERVICE_URL` 和四个平台后台的回调地址，路径保持不变。

微信在 Waline 内部使用其官方 `oidc` 身份字段保存唯一标识，因此服务入口和回调
路径是 `/api/oidc`；实际授权页面和用户资料仍来自微信开放平台。
