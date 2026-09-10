# 艺术家个人网站

Apple 风格前台 + Cloudflare Pages Functions 后台 + D1，图片使用 HTTPS 外链。

- 零构建：原生 HTML / CSS / JavaScript
- 托管：Cloudflare Pages
- 数据：Cloudflare D1
- 图片：HTTPS 外链（后台粘贴图床直链；R2 代码保留休眠）
- 后台：`/admin/login`
- 前台：Hash 路由，图片和资料由 API 动态读取

## 一、部署前必须完成

### 1. 创建 D1

```powershell
npx wrangler@latest login
npx wrangler@latest d1 create art-website-db
```

把命令输出的 `database_id` 写入 `wrangler.jsonc`：

```jsonc
"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

仓库里的 `database_id` 已经填入了真实值，可以直接部署。如果换成自己的数据库，记得同步更新这一项。

### 2. 准备图片外链

本站不使用 Cloudflare R2。把作品图片放到任意提供 HTTPS 直链的图床
（GitHub raw、Gitee、imgbb、阿里云 OSS 等），在后台粘贴直链即可。

使用第三方图床时的注意：

- GitHub 必须使用 `raw.githubusercontent.com` 域名，且图片对所有人公开可见。
- 图片地址变更或删除会导致前台失效，作品图片建议集中管理。

`functions/api/admin/upload.js` 与 `functions/r2/[[key]].js` 代码保留休眠，
日后恢复 R2 只需在 `wrangler.jsonc` 加回 `r2_buckets` 并重新部署。

### 3. 初始化线上数据库

```powershell
npx wrangler@latest d1 execute art-website-db --remote --file=./schema.sql
```

`schema.sql` 可重复执行。它会创建表和索引，替换旧的 `updated_at` 触发器，并写入默认艺术家资料。

### 4. 创建 Pages 项目并配置密钥

```powershell
npx wrangler@latest pages project create art-website --production-branch main
npx wrangler@latest pages secret put ADMIN_PASSWORD --project-name art-website
npx wrangler@latest pages secret put SESSION_SECRET --project-name art-website
```

要求：

- `ADMIN_PASSWORD`：至少 8 位，生产环境建议至少 16 位。
- `SESSION_SECRET`：建议使用 32 字节以上的随机值；不设置时会回退用 `ADMIN_PASSWORD` 签名登录态。
- 不要把管理员密码写入 `wrangler.jsonc` 或提交到 Git。

生成随机密钥示例：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. 部署

```powershell
npx wrangler@latest pages deploy public --project-name art-website
```

> 输出目录必须是 `public`，不能是 `.`。写成 `.` 会把 `wrangler.jsonc`、`schema.sql`、
> `.dev.vars`（含明文管理员密码）等仓库文件当成静态资源一并发布到公网。

部署后先访问：

- `/api/health`：应返回 `ok: true`
- `/admin/login`：输入 `ADMIN_PASSWORD` 登录
- `/admin`：管理作品和艺术家资料

## 二、本地开发

复制本地变量示例：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

填写 `.dev.vars` 中的 `ADMIN_PASSWORD` 和 `SESSION_SECRET` 后执行：

```powershell
npx wrangler@latest d1 execute art-website-db --local --file=./schema.sql
npx wrangler@latest pages dev .
```

默认地址为 `http://localhost:8788`。

`.dev.vars` 已加入 `.gitignore`，不能提交。

## 三、项目结构

```text
.
├── wrangler.jsonc
├── schema.sql
├── .dev.vars.example
├── public/                        ← pages_build_output_dir，只有这个目录会被发布
│   ├── _redirects
│   ├── index.html
│   ├── admin/
│   │   ├── login.html
│   │   └── index.html
│   ├── assets/
│   ├── styles/
│   └── js/
└── functions/
    ├── _middleware.js
    ├── _lib/
    ├── api/
    │   ├── health.js
    │   ├── artist.js
    │   ├── artworks.js
    │   ├── artworks/[slug].js
    │   ├── admin/login.js
    │   ├── admin/logout.js
    │   ├── admin/artist.js
    │   ├── admin/artworks.js
    │   ├── admin/artworks/new.js
    │   ├── admin/artworks/[id].js
    │   └── admin/upload.js
    └── r2/[[key]].js
```

Cloudflare Pages 的全局中间件文件名必须是 `_middleware.js`，不能写成 `+middleware.js`。`admin/upload.js` 与 `r2/[[key]].js` 是 R2 休眠代码，未绑定对象存储时不参与运行。

## 四、API

公开接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | D1 绑定与数据库健康检查，R2 绑定为可选检查 |
| GET | `/api/artist` | 获取艺术家资料 |
| GET | `/api/artworks` | 已上架作品列表，支持 `category`、`featured`、`limit`、`offset` |
| GET | `/api/artworks/:slug` | 作品详情；GET 会累计浏览量 |
| GET | `/r2/artworks/*` | 从私有 R2 读取图片；未绑定 R2 时休眠 |

管理接口，需要有效 `art_session` Cookie：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | 登录并签发 24 小时签名 Cookie |
| POST | `/api/admin/logout` | 删除登录 Cookie |
| GET | `/api/admin/artworks` | 获取全部作品，支持搜索和状态筛选 |
| POST | `/api/admin/artworks/new` | 新建作品 |
| PATCH | `/api/admin/artworks/:id` | 更新作品 |
| DELETE | `/api/admin/artworks/:id` | 删除作品 |
| PUT | `/api/admin/artist` | 更新艺术家资料 |
| POST | `/api/admin/upload` | 上传图片到 R2；未绑定 R2 时休眠，当前使用外链方案 |

## 五、配置项

`wrangler.jsonc` 只保留非敏感的项目配置：项目名称、`pages_build_output_dir`、`compatibility_date` 和 D1 绑定，不含任何密钥，也没有 `vars` 段。

敏感配置全部通过 Cloudflare Pages Secrets 管理，不会提交到仓库：

- `ADMIN_PASSWORD`：后台登录密码，**必需**，至少 8 位
- `SESSION_SECRET`：会话签名密钥，可选但强烈建议；缺失时回退用 `ADMIN_PASSWORD` 签名

恢复 R2 上传功能时，再把 `ALLOWED_MIME_TYPES`、`MAX_UPLOAD_SIZE`、`MAX_TOTAL_UPLOAD_SIZE` 加回 `wrangler.jsonc` 的 `vars`。`upload.js` 内已有默认值兜底，不加也能运行。

## 六、安全设计

当前实现已包含：

- HMAC-SHA256 签名的 HttpOnly 会话 Cookie
- `SameSite=Strict`，生产 HTTPS 自动添加 `Secure`
- 24 小时会话过期
- 登录密码摘要比较，避免明显的时序差异
- 管理接口的同源请求检查
- 后台字段白名单、类型和长度校验
- slug 唯一性校验
- 图片地址必须是 HTTPS（本地开发允许 localhost），单个地址不超过 2048 字符
- 站内 `/r2/artworks/` 路径拒绝 `..` 路径穿越
- images 数组 1-20 张
- 统一安全响应头，包括 `nosniff` 和禁止 iframe 嵌入
- 后台列表、详情和上传均设置 `Cache-Control: no-store`

仍需在 Cloudflare 控制台配置：

1. 对 `/api/admin/login` 配置 Rate Limiting 或 WAF 规则，防止密码暴力尝试。
2. 定期备份 D1；删除作品不会删除图床上的原图，外链需在图床侧清理。
3. 如果旧版本曾上线，因为旧代码使用固定 `art_session=1` 且提交过默认密码，应立即更换 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。

## 七、常用检查

```powershell
# JavaScript 语法
node --check assets/js/admin.js
node --check assets/js/views.js

# 查看 Wrangler 配置
npx wrangler@latest pages project list
npx wrangler@latest d1 list

# 线上健康检查
Invoke-RestMethod https://你的域名.pages.dev/api/health
```

## 许可证

MIT
