# 艺术家个人网站

零构建的艺术作品集网站：原生 HTML / CSS / JavaScript 前台 + Cloudflare Pages Functions + Cloudflare D1。

- 前台：首页、作品列表、作品详情、关于、联系、线下交流
- 后台：作品、首页、栏目、活动、艺术家资料、站点文案、账号安全
- 图片：支持 HTTPS 外链（R2 代码保留但休眠）
- 认证：用户表 + PBKDF2-SHA256 密码哈希 + HMAC 签名会话
- 部署：GitHub + Cloudflare Pages + D1

> 📖 **完整项目逻辑说明**（前端/后端/数据库/部署运维）：`doc/PROJECT.md`
>
> 🗄 **数据库脚本仅两份**：`doc/sql/01_schema.sql`（初始化语句）+ `doc/sql/02_demo_data.sql`（demo 数据导入）

## 一、快速开始（本地开发）

环境：Node.js + Wrangler（无需 npm install，用 `npx wrangler`）。

```powershell
# 1) 复制本地变量模板（填入 SESSION_SECRET 与 ADMIN_PASSWORD）
Copy-Item .dev.vars.example .dev.vars

# 2) 初始化本地 D1（先结构，后 demo 数据）
npx wrangler d1 execute art-website-db --local --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --local --file=./doc/sql/02_demo_data.sql

# 3) 启动
npx wrangler pages dev public --ip 127.0.0.1 --port 8788
```

访问：

```text
前台：http://127.0.0.1:8788/
后台：http://127.0.0.1:8788/admin/login
账号：admin / art-d8ca469c21de651fdc97（登录请立即在「账号安全」改密）
```

## 二、GitHub + Cloudflare Pages 部署

Cloudflare 已关联 GitHub 后，Pages 设置：

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

### 2. 配置环境变量

在 Pages 项目 Settings → Environment variables 中添加：

- `SESSION_SECRET`：**必填**，≥32 字节随机字符串，用于签名后台会话。
- `ADMIN_PASSWORD`：仅用户表为空、首次开通 `admin` 时需要。

生成随机值：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. 初始化线上数据库

```powershell
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/02_demo_data.sql
```

> `01_schema.sql` 会先删除业务表再重建，只应在新库或明确需要重置时运行。脚本不含明文密码，仅含 admin 的 PBKDF2 哈希。

### 4. 推送并检查

```powershell
git add .
git commit -m "update website"
git push origin main
```

部署后检查：

- `/api/health`：返回 `ok: true`
- `/admin/login`：用户名 `admin`
- `/admin`：进入「账号安全」修改密码

## 三、项目结构

```text
.
├── README.md                 # 本文件（快速上手）
├── wrangler.jsonc            # Cloudflare 配置（D1 绑定 DB）
├── .dev.vars.example         # 密钥模板（复制为 .dev.vars，不入库）
├── doc/
│   ├── PROJECT.md            # 完整项目文档
│   └── sql/
│       ├── 01_schema.sql     # 初始化语句（建表/索引/触发器/基线值）
│       └── 02_demo_data.sql  # demo 数据导入脚本
├── functions/
│   ├── _middleware.js        # 全局中间件（安全头、会话校验、同源校验）
│   ├── _lib/
│   │   ├── auth.js           # 密码哈希 + 会话 Cookie
│   │   └── http.js           # JSON 响应与字段校验
│   ├── api/
│   │   ├── health.js / artist.js / artworks.js / artworks/[id].js
│   │   ├── categories.js / meetup.js / site-content.js
│   │   └── admin/            # 需登录的管理 API（含 upload.js，R2 休眠）
│   └── r2/[[key]].js         # R2 读取（休眠）
└── public/
    ├── index.html            # 前台 SPA 入口（hash 路由）
    ├── _redirects
    ├── admin/                # 后台管理 + 登录
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
| GET | `/api/artworks/:id` | 作品详情（自增浏览量） |
| GET | `/api/categories` | 启用中的栏目 |
| GET | `/api/meetup` | 线下交流条目 |
| GET | `/api/site-content` | 前台站点文案 |

管理接口（需登录 Cookie，路径含 `/api/admin/`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `login` / `logout` | 登录 / 退出 |
| GET | `account` | 当前用户 |
| PUT | `password` | 修改密码（需验证当前密码） |
| GET/POST/PATCH/DELETE | `artworks` / `artworks/new` / `artworks/:id` | 作品管理 |
| GET/POST/PATCH/DELETE | `categories` / `categories/new` / `categories/:id` | 栏目管理 |
| PUT | `artist` | 艺术家资料 |
| GET/PUT | `meetup` | 线下交流（PUT 整体替换） |
| GET/PUT | `site-content` | 站点文案（批量 upsert） |
| POST | `upload` | R2 上传（当前未绑定，休眠） |

## 五、安全设计

- 用户密码使用随机盐 + PBKDF2-SHA256（100000 次迭代）存储，数据库只存哈希
- 会话使用 HMAC-SHA256 签名 HttpOnly Cookie，`SameSite=Strict`，HTTPS 自动加 `Secure`
- 管理接口检查同源请求（Origin / Sec-Fetch-Site），跨站写请求 403
- 后台字段白名单、类型和长度校验；图片只允许 HTTPS 或站内 `/r2/artworks/`
- 统一安全响应头：CSP、`nosniff`、`X-Frame-Options: DENY` 禁止 iframe 嵌入
- 后台改密需要验证当前密码；用户表为空时可用 `ADMIN_PASSWORD` 引导开通首个账号

建议在 Cloudflare 对 `/api/admin/login` 配置 Rate Limiting 或 WAF，并定期备份 D1。

## 六、检查命令

```powershell
node --check functions/_lib/auth.js
node --check public/assets/js/admin.js
node --check public/assets/js/views.js
node --check public/assets/js/router.js

npx wrangler d1 export art-website-db --remote --output=backup.sql
npx wrangler pages dev public
```

## 七、迁移到其他电脑

1. 克隆仓库；安装 Node.js。
2. 复制 `.dev.vars.example` → `.dev.vars`，填入 `SESSION_SECRET`。
3. 执行 `doc/sql/01_schema.sql` 与 `02_demo_data.sql`（`--local`）。
4. `npx wrangler pages dev public --port 8788` 启动。
5. 迁移线上数据：`npx wrangler d1 export art-website-db --remote --output=backup.sql`。

详见 `doc/PROJECT.md` 第 8 节。

## 许可证

MIT
