# 艺术家个人网站

Apple 风格前台 + Cloudflare Pages Functions 后台 + D1 + R2。

- 零构建：原生 HTML / CSS / JavaScript
- 托管：Cloudflare Pages
- 数据：Cloudflare D1
- 图片：Cloudflare R2（私有 Bucket，通过 `/r2/*` 代理）
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

### 2. 创建 R2 Bucket

```powershell
npx wrangler@latest r2 bucket create art-website-images
```

保持 Bucket 私有即可，站点通过 `/r2/artworks/...` 读取图片。

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

Cloudflare Pages 的全局中间件文件名必须是 `_middleware.js`，不能写成 `+middleware.js`。

## 四、API

公开接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | D1/R2 绑定和数据库健康检查 |
| GET | `/api/artist` | 获取艺术家资料 |
| GET | `/api/artworks` | 已上架作品列表，支持 `category`、`featured`、`limit`、`offset` |
| GET | `/api/artworks/:slug` | 作品详情；GET 会累计浏览量 |
| GET | `/r2/artworks/*` | 从私有 R2 读取图片 |

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
| POST | `/api/admin/upload` | 上传 1-20 张图片到 R2 |

## 五、配置项

`wrangler.jsonc` 中只保留非敏感配置：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `ALLOWED_MIME_TYPES` | JPEG/PNG/WebP/GIF/AVIF | 允许上传的图片类型 |
| `MAX_UPLOAD_SIZE` | 10485760 | 单张图片最大 10MB |
| `MAX_TOTAL_UPLOAD_SIZE` | 41943040 | 单次上传总大小最大 40MB |

敏感配置：

- `ADMIN_PASSWORD`：Pages Secret
- `SESSION_SECRET`：Pages Secret，可选但强烈建议

## 六、安全设计

当前实现已包含：

- HMAC-SHA256 签名的 HttpOnly 会话 Cookie
- `SameSite=Strict`，生产 HTTPS 自动添加 `Secure`
- 24 小时会话过期
- 登录密码摘要比较，避免明显的时序差异
- 管理接口的同源请求检查
- 后台字段白名单、类型和长度校验
- slug 唯一性校验
- 图片 MIME、大小、数量和文件头签名校验
- 上传中途失败时回滚已写入的 R2 对象
- 统一安全响应头，包括 `nosniff` 和禁止 iframe 嵌入
- 后台列表、详情和上传均设置 `Cache-Control: no-store`

仍需在 Cloudflare 控制台配置：

1. 对 `/api/admin/login` 配置 Rate Limiting 或 WAF 规则，防止密码暴力尝试。
2. 定期备份 D1；删除作品不会自动删除 R2 中已经关联的图片，避免误删原图。
3. 不要把 R2 Bucket 暴露为公开写权限。
4. 如果旧版本曾上线，因为旧代码使用固定 `art_session=1` 且提交过默认密码，应立即更换 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。

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