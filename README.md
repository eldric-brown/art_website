# 艺术家个人网站

零构建的艺术作品集网站：原生 HTML / CSS / JavaScript 前台 + Cloudflare Pages Functions + Cloudflare D1。

- 前台：首页、作品列表、作品详情、关于、联系、线下交流
- 后台：作品、首页、栏目、活动、艺术家资料、站点文案、账号安全
- 图片：支持 HTTPS 外链
- 认证：用户表 + PBKDF2-SHA256 密码哈希 + HMAC 签名会话
- 部署：GitHub + Cloudflare Pages + D1

## 一、GitHub + Cloudflare Pages 部署

Cloudflare 已经关联 GitHub 后，建议使用下面的 Pages 设置：

```text
Framework preset：None
Root directory：/
Build command：留空
Build output directory：public
Production branch：main
```

项目没有 npm 构建步骤。Cloudflare 会直接发布 `public/`，并自动识别根目录下的 `functions/`。

### 1. 创建 D1 并绑定

```powershell
npx wrangler@latest login
npx wrangler@latest d1 create art-website-db
```

把返回的 `database_id` 写入 `wrangler.jsonc`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "art-website-db",
    "database_id": "你的 database_id"
  }
]
```

在 Cloudflare Pages 项目的 Settings → Functions → D1 database bindings 中确认：

```text
Variable name：DB
D1 database：art-website-db
```

### 2. 配置环境变量

在 Cloudflare Pages 项目 Settings → Environment variables 中添加：

- `SESSION_SECRET`：**建议必填**，至少 32 字节随机字符串，用于签名后台会话。
- `ADMIN_PASSWORD`：仅在使用 `schema.sql` 从空用户表首次开通 admin 时需要。

如果直接使用 `init.sql`，其中已经包含 admin 的 PBKDF2 哈希，日常登录不依赖 `ADMIN_PASSWORD`。但仍必须配置 `SESSION_SECRET`。

生成随机值：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 初始化数据库

新数据库或需要完整重置时，推荐直接执行：

```powershell
npx wrangler@latest d1 execute art-website-db --remote --file=./init.sql
```

`init.sql` 包含：

- 完整表结构、索引和触发器
- demo 作品、艺术家资料、栏目和线下活动
- 当前站点文案和 Artvee 图片配置
- `users` 表中的 admin 用户和 PBKDF2 密码哈希

> `init.sql` 会先删除业务表再重建，只应在新数据库或明确需要重置时运行。脚本不包含明文密码，登录使用当前本地 admin 密码，部署后请立即在后台修改。

### 4. 旧数据库增量升级

已经存在数据、不要重置时，按顺序执行：

```powershell
npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/005_users.sql
npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/006_hero_copy.sql
npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/007_home_nav_images.sql
npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/008_hero_image.sql
```

### 5. 推送 GitHub

确认 D1 绑定和 Secrets 已配置后，推送到 `main`：

```powershell
git add .
git commit -m "update website"
git push origin main
```

Cloudflare Pages 会自动部署。部署后检查：

- `/api/health`：返回 `ok: true`
- `/admin/login`：用户名 `admin`
- `/admin`：进入「账号安全」修改密码

## 二、本地开发

复制本地变量：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

填写 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。初始化本地 D1：

```powershell
npx wrangler@latest d1 execute art-website-db --local --file=./init.sql
npx wrangler@latest d1 execute art-website-db --local --file=./verify.sql
```

启动 Pages：

```powershell
npx wrangler@latest pages dev public --ip 127.0.0.1 --port 8788
```

访问：

```text
前台：http://127.0.0.1:8788/
后台：http://127.0.0.1:8788/admin/login
```

## 三、项目结构

```text
.
├── wrangler.jsonc
├── init.sql                  # 完整初始化 + demo 数据 + 用户哈希
├── schema.sql                # 可重复执行的结构与基础数据脚本
├── seed_demo.sql             # 可选 demo 数据
├── verify.sql                # 只读 JSON 校验报告
├── reset_local.sql           # 仅本地重置
├── migrations/
├── functions/
│   ├── _middleware.js
│   ├── _lib/
│   ├── api/
│   │   ├── artist.js
│   │   ├── artworks.js
│   │   ├── artworks/[id].js
│   │   ├── categories.js
│   │   ├── meetup.js
│   │   ├── site-content.js
│   │   ├── health.js
│   │   ├── admin/
│   │   └── admin/upload.js       # R2 休眠代码
│   └── r2/[[key]].js             # R2 休眠代码
└── public/
    ├── index.html
    ├── _redirects
    ├── admin/
    └── assets/
        ├── js/
        └── styles/
```

## 四、主要 API

公开接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 数据库与绑定健康检查 |
| GET | `/api/artist` | 艺术家资料 |
| GET | `/api/artworks` | 已上架作品，支持 `category`、`featured`、`limit`、`offset` |
| GET | `/api/artworks/:id` | 作品详情 |
| GET | `/api/categories` | 启用中的栏目 |
| GET | `/api/meetup` | 线下交流条目 |
| GET | `/api/site-content` | 前台站点文案 |

管理接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/login` | 登录名和密码登录 |
| GET | `/api/admin/account` | 当前用户 |
| PUT | `/api/admin/password` | 修改密码 |
| POST | `/api/admin/logout` | 退出登录 |
| GET/POST/PATCH/DELETE | `/api/admin/artworks*` | 作品管理 |
| GET/POST/PATCH/DELETE | `/api/admin/categories*` | 栏目管理 |
| PUT | `/api/admin/artist` | 艺术家资料 |
| GET/PUT | `/api/admin/meetup` | 线下交流 |
| GET/PUT | `/api/admin/site-content` | 站点文案 |
| POST | `/api/admin/upload` | R2 上传，当前未绑定 |

## 五、数据库脚本

- `init.sql`：完整初始化，包含结构、demo 数据和当前用户哈希；会重置业务表。
- `schema.sql`：只创建结构和基础默认内容，可重复执行。
- `verify.sql`：只读检查，输出 JSON 报告，所有 `problems` 应为 `0`。
- `seed_demo.sql`：可选 demo 数据，适合本地开发。
- `reset_local.sql`：仅用于本地重置，不要对线上执行。
- `migrations/005` 至 `migrations/008`：用户、Hero 文案、导航图片和 Hero 图片的增量升级。

## 六、安全设计

- 用户密码使用随机盐 + PBKDF2-SHA256（210000 次迭代）存储
- 会话使用 HMAC-SHA256 签名 HttpOnly Cookie
- `SameSite=Strict`，HTTPS 自动添加 `Secure`
- 管理接口检查同源请求
- 后台字段白名单、类型和长度校验
- 图片只允许 HTTPS 或本项目 R2 路径
- 统一安全响应头，包括 CSP、`nosniff` 和禁止 iframe 嵌入
- 后台改密需要验证当前密码

建议在 Cloudflare 对 `/api/admin/login` 配置 Rate Limiting 或 WAF，并定期备份 D1。

## 七、检查命令

```powershell
node --check functions/_lib/auth.js
node --check public/assets/js/admin.js
node --check public/assets/js/views.js
node --check public/assets/js/router.js

npx wrangler@latest d1 execute art-website-db --local --file=./verify.sql
npx wrangler@latest pages dev public
```

## 许可证

MIT
