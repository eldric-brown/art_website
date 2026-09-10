# 🎨 艺术家个人网站

Apple 风格设计的静态前端 + Cloudflare Pages Functions 后台 + D1 + R2 存储的艺术家作品集网站。

- **零构建**：纯 vanilla JS + HTML + CSS，无需 Node 构建步骤
- **托管**：Cloudflare Pages（全球 CDN + 免费额度充裕）
- **数据库**：Cloudflare D1（SQLite）
- **图片存储**：Cloudflare R2（0 出站流量费）
- **后台管理**：`/admin`（简单密码登录）

---

## 快速开始

### 1. 前置准备

- 注册 Cloudflare 账号：<https://dash.cloudflare.com/signup>
- 安装 wrangler CLI：

```bash
npm install -g wrangler
wrangler login
```

### 2. 创建 D1 数据库

在 Cloudflare Dashboard → **Workers & Pages → D1 Databases** → **Create D1 Database**

- 数据库名：`art-website-db`
- 记下 **Database ID**（后续填到 `wrangler.jsonc`）

### 3. 创建 R2 Bucket

在 Dashboard → **Storage → R2 Object Storage** → **Create bucket**

- Bucket 名：`art-website-images`
- 保持默认私有（通过本站 `/r2/*` 路由代理读取）

### 4. 修改配置

编辑 `wrangler.jsonc`：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "art-website-db",
      "database_id": "你的 D1 数据库 ID"  // ← 替换
    }
  ]
}
```

### 5. 初始化数据库

```bash
wrangler d1 execute art-website-db --remote --file=./schema.sql
```

### 6. 部署

```bash
wrangler pages project create art-website
# 然后按提示配置（选择已有文件夹：当前目录）

wrangler pages deploy .
```

浏览器访问你分配到的 `*.pages.dev` 域名即可。

---

## 本地开发

```bash
wrangler pages dev .
# 本地启动：http://localhost:8788
```

本地开发时：

- D1 本地用 SQLite 模拟（`--local` 会自动创建 `.wrangler/state`）
- R2 用 Cloudflare Workers 的 miniflare 模拟
- 想连真实 D1，用 `wrangler pages dev --remote`

---

## 项目结构

```
.
├── wrangler.jsonc              # Cloudflare Pages 配置
├── schema.sql                  # D1 数据库初始化脚本
├── _redirects                  # 前端路由 fallback
├── index.html                  # 前台 SPA 入口
├── _redirects
├── admin/
│   ├── login.html              # 后台登录页
│   └── index.html              # 后台管理主页
├── assets/
│   ├── styles/
│   │   ├── main.css            # 前台样式
│   │   └── admin.css           # 后台样式
│   └── js/
│       ├── utils.js            # 工具函数
│       ├── api.js              # 前台 API 客户端
│       ├── views.js            # 各页面视图渲染
│       ├── router.js           # 哈希路由
│       ├── main.js             # 前台入口
│       └── admin.js            # 后台管理逻辑
└── functions/                  # Cloudflare Pages Functions（后端）
    ├── +middleware.js          # 认证中间件
    ├── api/
    │   ├── health.js           # GET  /api/health
    │   ├── artworks.js         # GET  /api/artworks
    │   ├── artwork-slug.js     # GET  /api/artworks/:slug
    │   ├── artist.js           # GET  /api/artist
    │   └── admin/
    │       ├── login.js        # POST /api/admin/login
    │       ├── logout.js       # POST /api/admin/logout
    │       ├── artist.js       # PUT  /api/admin/artist
    │       ├── artworks.js     # GET  /api/admin/artworks (列表 + 搜索)
    │       ├── upload.js       # POST /api/admin/upload (R2)
    │       └── artworks/
    │           ├── new.js      # POST /api/admin/artworks/new
    │           └── edit.js     # PATCH / DELETE /api/admin/artworks/:id
    └── r2/
        └── [[key]].js          # GET /r2/:key (图片代理)
```

---

## API 一览

### 公开接口（无需登录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/health` | 健康检查 |
| GET  | `/api/artworks` | 作品列表（仅上架，支持 `?category=`） |
| GET  | `/api/artworks/:slug` | 作品详情 |
| GET  | `/api/artist` | 艺术家信息 |
| GET  | `/r2/*` | R2 图片代理 |

### 管理接口（需 `art_session` Cookie）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 登录 |
| POST | `/api/admin/logout` | 登出 |
| GET  | `/api/admin/artworks` | 全部作品（支持 `?search=` `?status=`） |
| POST | `/api/admin/artworks/new` | 新建作品 |
| PATCH | `/api/admin/artworks/:id` | 更新作品 |
| DELETE | `/api/admin/artworks/:id` | 删除作品 |
| PUT  | `/api/admin/artist` | 更新艺术家资料 |
| POST | `/api/admin/upload` | 上传图片到 R2 |

---

## 配置项

`wrangler.jsonc` 中的 `vars`：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_PASSWORD` | `changeme-admin-password-123` | 后台登录密码（**必须修改**） |
| `ALLOWED_MIME_TYPES` | jpeg/png/webp/gif | 允许上传的图片类型 |
| `MAX_UPLOAD_SIZE` | `10485760` | 单张图片最大 10MB |

修改密码方式：

```bash
wrangler pages secret put ADMIN_PASSWORD
# 输入新密码后回车
```

或直接编辑 `wrangler.jsonc` 后重新部署。

---

## 使用流程

1. 访问 `/admin/login`
2. 输入密码 → 登录后跳转到 `/admin`
3. **作品管理**：新建 / 编辑 / 删除 / 上下架 / 精选
4. **艺术家资料**：修改简介、头像、联系方式、社交账号
5. 前台立即生效（无缓存刷新）

---

## 数据库表

### artworks（作品）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| title | TEXT | 标题 |
| slug | TEXT | URL 唯一标识 |
| description | TEXT | 简介 |
| images | TEXT | JSON 数组 `["url1", "url2"]` |
| category | TEXT | oil/watercolor/sketch/ink/digital/photograph/other |
| year | INTEGER | 创作年份 |
| medium | TEXT | 媒介 |
| dimensions | TEXT | 尺寸 |
| published | INTEGER | 上架状态 |
| featured | INTEGER | 首页精选 |
| sort_order | INTEGER | 排序权重 |
| views | INTEGER | 浏览次数 |

### artist（艺术家）

单行数据（`id = 1`），字段：`name`、`name_en`、`bio`、`bio_short`、`avatar`、`signature`、`socials`（JSON）、`contact_email`、`contact_wechat`。

### view_logs（浏览记录）

记录每次访问的作品 ID、IP 哈希、User-Agent，用于热门作品统计。

---

## 安全说明

当前认证方案是**最简单的 Cookie 标记**：登录成功后种下 `art_session=1`，中间件仅检查是否存在。

**生产环境强烈建议升级到**：

1. **密码哈希**：用 Web Crypto API 的 PBKDF2 对密码做哈希，避免明文存储
2. **签名 Token**：用 HMAC-SHA256 生成 token，Cookie 只存 token 引用（token → KV）
3. **CSRF 防护**：为管理接口加 CSRF Token
4. **登录限流**：记录失败次数，超过阈值暂时禁止
5. **HttpOnly + Secure + SameSite=Strict**

见 `functions/api/admin/login.js` 顶部注释。

---

## 常见问题

**Q：图片加载不出来？**
- 检查 R2 bucket 是否已创建并绑定
- 检查 `wrangler.jsonc` 中 `bucket_name` 是否匹配
- 访问 `/api/health` 确认后端正常

**Q：后台跳转登录？**
- 用无痕窗口测试（排除旧 Cookie）
- 确认密码与 `wrangler.jsonc` 的 `ADMIN_PASSWORD` 一致
- 本地开发确认没有 `SameSite` 跨域问题

**Q：slug 冲突？**
- slug 在数据库是唯一索引，请改用其他英文标识（如 `morning-garden-2`）

**Q：想让 R2 直连不用代理？**
- 在 Cloudflare R2 bucket 中启用 Custom Domain
- 在 `wrangler.jsonc` 的 `vars` 中加 `R2_CUSTOM_DOMAIN`：`https://img.yourdomain.com`
- 上传接口会自动改用该域名

---

## 许可证

MIT
