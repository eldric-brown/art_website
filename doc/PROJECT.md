# Art Website 项目文档

> 本文档是项目的唯一文档，整合全部主要逻辑：前端、后端、数据库与部署运维。
> 供在其他电脑上复用与二次开发。最后更新：2026-09-14。

---

## 1. 项目概览

艺术家个人作品集网站：**零构建**的静态前台 + 后台管理一体化，部署在 Cloudflare Pages。

- **技术栈**：Cloudflare Pages Functions（Workers）+ Cloudflare D1（SQLite）+ 原生 HTML / CSS / JS
- **零构建**：无打包工具，`public/` 目录即静态站点，`functions/` 目录即后端 API
- **图片方案**：HTTPS 外链（后台粘贴图床 URL）；R2 代码保留但休眠
- **数据库**：本地开发用 Wrangler 内置 SQLite，线上为 D1
- **认证**：`users` 表 + PBKDF2-SHA256 密码哈希 + HMAC 签名 HttpOnly 会话 Cookie

### 目录结构

```
art_website/
├── public/                  # 静态站点（部署根目录）
│   ├── index.html           # 前台入口（SPA，hash 路由）
│   ├── _redirects           # /about /contact /meetup 回退 index.html
│   ├── admin/
│   │   ├── index.html       # 后台管理
│   │   └── login.html       # 后台登录
│   └── assets/
│       ├── js/              # main / views / router / utils / api / admin
│       └── styles/          # main.css（前台）/ admin.css（后台）
├── functions/               # Cloudflare Pages Functions（后端）
│   ├── _middleware.js       # 全局中间件（安全响应头、会话校验、同源校验）
│   ├── _lib/
│   │   ├── auth.js          # 密码哈希 + 会话 Cookie 认证
│   │   └── http.js          # JSON 响应、校验、分类兜底工具
│   ├── api/                 # 公开 API + admin/ 管理 API（需登录）
│   └── r2/[[key]].js        # R2 读取（休眠）
├── doc/
│   ├── PROJECT.md           # 本文档
│   └── sql/
│       ├── 01_schema.sql    # 初始化语句（建表/索引/触发器/基线值）
│       └── 02_demo_data.sql # demo 数据导入脚本
├── wrangler.jsonc           # Cloudflare 配置（D1 绑定 DB）
├── .dev.vars.example        # 密钥模板（复制为 .dev.vars，不入库）
└── README.md                # 快速上手入口
```

> 数据库脚本已精简：根目录与 migrations/ 不再保留，初始化与 demo 数据统一在 `doc/sql/`。

---

## 2. 前端逻辑

### 2.1 前台 SPA（`public/`）

**加载顺序**：`index.html` 按序加载 `utils.js → api.js → views.js → router.js → main.js`。

```
utils.js  定义 window.State / window.T / window.Tf / window.Utils / window.CATEGORIES / window.loadCategories
api.js    定义 window.API（fetch 封装）
views.js  定义 window.Views（视图渲染；IIFE 初始化时捕获 T，必须晚于 utils.js）
router.js 定义 window.Router 与 window.Lightbox
main.js   应用初始化入口（DOMContentLoaded 后执行）
```

#### `utils.js` —— 状态与通用工具

- `State`：`category`、`worksSearch`、`currentId`、`content`（站点文案缓存）、`contentReady`、`categories`、`categoriesReady`（Promise 缓存防并发重复请求）。
- `T(key, fallback)`：从 `State.content` 读文案（有值且非空才返回），否则返回 fallback 或空串。
- `Tf(key, vars, fallback)`：替换文案中的 `{year}` 占位符（用于 `footer.copyright`）。
- `Utils`：`escapeHtml`（XSS 转义）、`placeholderImage`（内联 SVG data URI 占位）、`formatDate`、`getCategoryLabel`/`categoryName`（优先 categories 表，回退 `category.<key>` 文案）、`toast`、`observeReveals`（IntersectionObserver 滚动渐显）。
- `loadCategories()`：拉取 `/api/categories` 并缓存；失败时用内置 `CATEGORIES` 兜底。

#### `api.js` —— 前台 API 封装

- `request(url, options)`：统一 `fetch`（`credentials: 'same-origin'`），JSON 头自动设置，`!res.ok || !data.ok` 抛错（带 `status` 与 `data`）。
- 方法：`listArtworks(params)`、`getArtwork(id)`、`getArtist()`、`listCategories()`、`listMeetups()`、`getSiteContent()`。

#### `views.js` —— 视图渲染（所有文案经 `T(key)` 读取）

| 视图 | 逻辑要点 |
|---|---|
| `home()` | 并发请求 artist / 精选作品(featured=1, limit 1) / 最新作品(limit 1) / 栏目 / 活动；渲染三段式（见下） |
| `works(category)` | 大标题 + 即时搜索框 + 文字分类筛选（Hash 路由 `#/works` / `#/works/category/:key`）；网格卡片 `data-search` 供前端即时过滤 |
| `artworkDetail(id)` | 主图 + 缩略图（点击切换）、侧栏元信息（分类/年份/媒介/尺寸/发布日期）、描述、Sold/Price 标签、灯箱打开 |
| `about()` | 头像、中英文名、一句话简介、长简介、社交链接；无资料显示 `about.unavailable` |
| `contact()` | 从 artist 取邮箱/微信；都没有时显示「暂未提供」 |
| `meetup()` | 活动列表（图片 + 标题 + 日期 + 地点）；空列表显示 `meetup.empty` |
| `loading` / `empty` / `notFound` | 通用状态视图 |

**首页三段式**：

1. **第一屏横图**（`heroSectionHtml`）：优先 `home.hero.image`，为空回退精选作品首图；两者皆无回退经典文字 hero。有文案时叠加 eyebrow/标题/副标题/CTA。
2. **第二屏导航图条**（`navigationTilesSectionHtml`）：Home/Works/About/Meet Up/Contact 五张横图卡，背景图取 `home.nav.<key>.image`，留空显示占位色块。
3. **第三屏内容轮播**（`contentCardsSectionHtml`）：`home.cards.count` 控制数量，`home.card.N.{title,text,image,link}` 渲染卡片（缺 title 或 image 的卡跳过），箭头控制横向轮播。

#### `router.js` —— 路由与交互

- 路由表（hash 匹配）：`#/`、`#/works`、`#/works/category/:key`、`#/works/:id`、`#/about`、`#/contact`、`#/meetup`；无匹配渲染 404。
- `navigate()`：切 loading → 匹配 handler → `_afterRender`（滚动渐显、导航高亮、事件绑定）。
- 事件绑定：作品页即时搜索（只过滤已加载卡片）、详情页缩略图切换、主图点击开灯箱、首页轮播箭头翻页（边界禁用）。
- `Lightbox`：图片放大浏览，支持 Esc / 遮罩点击关闭。

#### `main.js` —— 初始化入口

- 路径规范化：`/about`、`/contact`、`/meetup` 无 hash 时替换为 `#/...`（配合 `_redirects`）。
- 监听 `hashchange` → `Router.navigate()`。
- 初始化：先 `Promise.all([loadSiteContent(), loadCategories()])`，再依次应用站点元信息（title/description/og）、导航页脚文案（`data-text` 注入）、Logo/favicon（`data-src-config`），最后启动路由。
- `document.title` 取 `site.title`；favicon 与双态 Logo 取 `site.favicon` / `site.logo_icon_light` / `site.logo_icon_dark`。

#### 入口页面 `index.html` 与 `_redirects`

- 静态骨架：导航（logo + 5 个链接）、`<main id="app">`（JS 渲染）、页脚、灯箱容器。
- `<head>` 有 Open Graph 元信息；动态文案用 `data-text="key"` 由 JS 注入。
- `_redirects`：`/about`、`/contact`、`/meetup` 回退至 `index.html`（SPA 直链可用）；`/admin` 不写 rewrite 以免 308 循环。

### 2.2 后台管理（`/admin`）

#### 登录页 `admin/login.html`

- 表单提交 `POST /api/admin/login`；成功且 `must_change_password` 时跳转 `/admin/?force_password_change=1`。
- 支持 `?next=` 回跳（仅允许站内相对路径）；失败展示错误信息。

#### 管理页 `admin/index.html` 与 `admin/assets/js/admin.js`

侧边栏七个 Tab，单页切换（`setupTabs`）：

| Tab | 逻辑要点 |
|---|---|
| 🎨 作品管理 | 列表（搜索 300ms 防抖 + 状态筛选）、新建/编辑弹窗、图片 URL 每行一条、删除确认；分类下拉动态读后台栏目 |
| 🏠 首页展示 | `loadHomeConfig` 读取 `home.*` 系列；① Hero 横图 ② 五张导航背景图（实时预览）③ 内容轮播标题 ④ 内容卡编辑器（增删，最多 8 张）；保存时只提交有 title/image 的卡 |
| 🗂 栏目管理 | 列表（含作品数）、新建（key 不可改）、改名/底图/排序/启用停用 |
| 📍 线下交流 | 行式编辑器（标题/日期/地点/图片/排序），支持增删行；PUT 整体替换 |
| 👤 艺术家资料 | 头像、简介、中英文名、社交链接、联系方式表单；保存 `PUT /api/admin/artist` |
| 📝 站点文案 | 平铺 key→value 编辑，批量 `PUT /api/admin/site-content` |
| 🔐 账号安全 | `loadAccount` 显示当前用户与强制改密横幅；表单校验后 `PUT /api/admin/password` |

其他：

- `api(url, options)`：后台 fetch 封装；401 自动跳转登录页；错误展开 `details` 数组逐条展示。
- Toast 提示（success 2.5s / error 7s）；退出登录 `POST /api/admin/logout` 后跳登录页。
- 无 JS 框架，全部原生 DOM 操作，`state` 对象集中管理当前数据。

#### 样式说明

- `public/assets/styles/main.css`：前台暖色博物馆主题；`.reveal` 滚动渐显、`.owlcontaine` 轮播、作品网格、详情页、灯箱等。
- `public/assets/styles/admin.css`：后台浅色主题，Apple 蓝 `#0066cc`；前后台样式相互独立。

---

## 3. 后端逻辑（Cloudflare Pages Functions）

### 3.1 架构总览

- 所有后端代码位于 `functions/`，部署至 Cloudflare Pages 时自动识别。
- 入口契约：每个文件导出 `onRequest(context)`，`context = { request, env, params, waitUntil }`。
- `env.DB` 为 D1 绑定（`wrangler.jsonc` 中 `d1_databases.binding = "DB"`）。
- 公共路径返回 JSON，统一 `Cache-Control: no-store`。
- 图片使用 HTTPS 外链；`env.BUCKET`（R2）为**可选绑定**，未配置时不影响站点运作。

**请求处理流程**：

```
浏览器请求
  → _middleware.js（全局）：加安全响应头 → 是否受保护路径(/admin、/api/admin)？
      → 是 → 校验会话 Cookie → 校验写操作同源 → 放行/401/302
  → 具体路由（static 目录或 functions）
```

### 3.2 全局中间件 `_middleware.js`

- **保护前缀**：`/admin`、`/api/admin`；白名单放行 `/admin/login`、`/admin/login.html`、`/api/admin/login`。
- **安全响应头**（所有响应统一附加）：
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy`：`default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; form-action 'self'`
- **未登录处理**：访问 `/api/*` 返回 401 JSON；访问 `/admin` 页面 302 跳转 `/admin/login?next=<path>`。
- **同源校验**：对 POST/PUT/PATCH/DELETE 检查 `Origin` 与 `Sec-Fetch-Site`，跨站写请求返回 403。

### 3.3 认证库 `_lib/auth.js`

**密码哈希（PBKDF2-SHA256）**

- 派生参数：PBKDF2 + SHA-256 + 迭代 100000 + 输出 32 字节；盐 16 字节随机（base64url 编码）。
- `createPasswordRecord(password)`：生成随机盐 → 派生哈希 → 返回 `{ hash, salt, iterations: 100000, algorithm: 'PBKDF2-SHA256' }`。
- `verifyPassword(password, user)`：校验算法为 PBKDF2-SHA256、迭代数在 10000~100000，用 WebCrypto `crypto.subtle` 派生后**常数时间比较**（`timingSafeEqual`）。
- `secureStringEqual(a, b)`：先 SHA-256 摘要再常数时间比较，用于 `ADMIN_PASSWORD` 引导校验。

**会话 Cookie（HMAC-SHA256 签名）**

- Cookie 名 `art_session`；属性 `Path=/; HttpOnly; SameSite=Strict; Priority=High; Secure`（HTTPS 时附加）。
- Token 格式：`{expiresAt}.{nonce16hex}.{userId}.{sig64hex}`，签名密钥 `SESSION_SECRET`（回退 `ADMIN_PASSWORD`）。
- TTL 24 小时；校验过期时间、nonce/签名格式、HMAC 常数时间比对。
- 导出：`createSessionCookie`、`clearSessionCookie`、`hasValidSession`、`getSessionUserId`。

### 3.4 响应与校验工具 `_lib/http.js`

- 内置分类兜底 `CATEGORY_KEYS`：`oil, watercolor, sketch, ink, digital, photograph, other`。
- `json(data, status, headers)`：统一 JSON 响应（utf-8、no-store）。
- `methodNotAllowed(methods)`：405 响应并带 `Allow` 头。
- `safeParseJSON(value, fallback)`：安全解析列中的 JSON 字符串。
- `loadAllowedCategories(env)`：从 `categories WHERE enabled=1` 读栏目 key；为空或失败时回退内置集合。
- `isAllowedImageUrl(value)`：仅允许 `https:`、本地 `localhost|127.0.0.1`、或站内 `/r2/artworks/...`（禁止 `..` 穿越）。
- `validateArtworkPayload(body, { partial, allowedCategories })`：作品字段白名单校验——`title`(≤200，必填)、`description`(≤10000)、`medium`(≤200)、`dimensions`(≤200)、`price`(≤100)、`category`(必须在启用栏目内)、`year`(1900–2100 整数)、`images`(1–20 张 URL 数组)、`published/featured/sold`(0/1)、`sort_order`(−1000000~1000000)；`partial` 模式仅校验传入字段。

### 3.5 公开 API（无需登录，均支持 GET/HEAD）

| 方法 | 路径 | 逻辑要点 |
|---|---|---|
| GET | `/api/health` | 检查 `env.DB` 并执行 `SELECT 1`；上报 `checks.storageBinding`（R2 是否绑定）；失败返回 503 |
| GET | `/api/artist` | 查询 `artist WHERE id = 1`，`socials` JSON 解析后返回；无记录返回 404 `artist_not_found` |
| GET | `/api/artworks` | 仅返回 `published = 1`；支持 `category`（须在启用栏目内）、`featured=1`、`limit`(1–200，默认 50)、`offset`；按 `sort_order DESC, year DESC, id DESC` 排序；附带 `total` |
| GET | `/api/artworks/:id` | 查询 `id = ? AND published = 1`；GET 时通过 `waitUntil` 异步 `views + 1` |
| GET | `/api/categories` | 返回 `enabled = 1` 的栏目，按 `sort_order DESC, id ASC`；空表时回退内置 7 个分类 |
| GET | `/api/meetup` | 返回全部线下活动，按 `sort_order DESC, id DESC` |
| GET | `/api/site-content` | 返回 `site_content` 全表 `{ key: value }` 映射，按 key 排序 |

### 3.6 管理 API（需登录 Cookie）

**账号**

| 方法 | 路径 | 逻辑要点 |
|---|---|---|
| POST | `login` | 查 `users WHERE username = ? COLLATE NOCASE`；无此用户且用户表为空时走**引导逻辑**：用户名须为 `admin` 且密码等于 `env.ADMIN_PASSWORD`，成功后创建 PBKDF2 记录并写入；用户存在但 `password_hash = ''` 时跳过校验（首次登录）并返回 `must_change_password: true`；正常则 `verifyPassword`；成功下发会话 Cookie |
| POST | `logout` | 下发 TTL=0 的清除 Cookie |
| GET | `account` | 从会话取 userId，返回用户信息与 `must_change_password: !password_hash` |
| PUT | `password` | 校验新密码 ≥8 位、≤128 位、不同于当前密码；`password_hash != ''` 时需校验当前密码；成功后更新哈希并**重发会话 Cookie** |

**作品 `artworks`**

| 方法 | 路径 | 逻辑要点 |
|---|---|---|
| GET | `artworks` | 后台列表（含草稿），支持 `search`（标题 LIKE，转义 `%_\`）与 `status`(all/published/draft)，按 `updated_at DESC`，上限 500 条 |
| POST | `artworks/new` | 校验后插入，`images` 以 JSON 字符串存储，返回 201 |
| PATCH | `artworks/:id` | 部分更新（只更新传入字段），动态拼 SET 子句，返回更新后的完整行 |
| DELETE | `artworks/:id` | 删除作品并级联清理 `view_logs` |

**栏目 `categories`**

| 方法 | 路径 | 逻辑要点 |
|---|---|---|
| GET | `categories` | 全部栏目（含启用/停用），附带 `artwork_count`（子查询统计） |
| POST | `categories/new` | `key` 须匹配 `/^[a-z][a-z0-9_]{0,39}$/`（建后不可改）；`enabled` 恒为 1；key 冲突返回 409 `duplicate_key` |
| PATCH | `categories/:id` | 可改 `name`/`image`/`sort_order`/`enabled`，**不允许改 key** |
| DELETE | `categories/:id` | 删除前检查是否仍有作品引用（`category_in_use` → 409） |

**其他内容**

| 方法 | 路径 | 逻辑要点 |
|---|---|---|
| GET/PUT | `artist` | PUT 白名单校验（name 必填、email 格式、URL 白名单、socials ≤20 个平台且防 `__proto__` 污染），动态生成 UPDATE；行不存在先 `INSERT OR IGNORE` 基线行 |
| GET/PUT | `meetup` | GET 返回全部活动；PUT 为**整体替换**（`DELETE` + 批量 `INSERT`，用 `env.DB.batch` 保证事务性），单次最多 50 条 |
| GET/PUT | `site-content` | GET 返回 `{ key: { value, updated_at } }`；PUT 平铺 `{key: value}` 批量 upsert（`ON CONFLICT(key) DO UPDATE`），key 须匹配 `[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*`，值 ≤2048 字符，单次 ≤300 个 key |

### 3.7 R2 休眠代码 `upload` / `r2/[[key]]`

- `POST /api/admin/upload`：未绑定 `env.BUCKET` 时返回 500 `bucket_not_configured`。已实现：MIME 白名单（jpeg/png/webp/gif/avif）、魔数校验、单文件 ≤10MB、单次 ≤20 张且总大小 ≤40MB、随机文件名 `artworks/{date}/{12hex}.{ext}`、失败回滚已上传对象。
- `GET /r2/[[key]]`：读取对象流，仅允许 `artworks/` 前缀，带 ETag/304 与缓存头。当前未绑定 R2，处于休眠状态。

---

## 4. 数据库设计（Cloudflare D1 / SQLite）

### 4.1 脚本说明

`doc/sql/` 下仅保留两个脚本：

| 文件 | 用途 | 说明 |
|---|---|---|
| `01_schema.sql` | **初始化语句** | 建全部表、索引、触发器 + Logo/favicon 基线值；先 DROP 再 CREATE，适合新库或彻底重置 |
| `02_demo_data.sql` | **demo 数据导入** | 灌入演示用作品、栏目、线下活动、站点文案、艺术家档案、admin 用户（PBKDF2 哈希） |

执行方式（本地 / 线上）：

```powershell
npx wrangler d1 execute art-website-db --local  --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --local  --file=./doc/sql/02_demo_data.sql
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/02_demo_data.sql
```

> `01_schema.sql` 会先删除业务表再重建，只应在新数据库或明确需要重置时运行。

### 4.2 表结构（共 7 张）

#### artworks —— 作品表

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | 作品 id，URL 用 |
| title | TEXT NOT NULL | 作品标题 |
| description | TEXT DEFAULT '' | 简介 / 创作背景 |
| images | TEXT NOT NULL | JSON 数组字符串 `["url1","url2"]`，HTTPS 外链或 `/r2/` 路径 |
| category | TEXT NOT NULL DEFAULT 'other' | 栏目 key，对应 `categories.key` |
| year | INTEGER NOT NULL | 创作年份 |
| medium / dimensions | TEXT DEFAULT '' | 媒介（如 布面油画）/ 尺寸（如 60 x 80 cm） |
| published | INTEGER DEFAULT 0 | 1 上架 / 0 下架 |
| featured | INTEGER DEFAULT 0 | 1 首页精选 |
| sort_order | INTEGER DEFAULT 0 | 排序权重，越大越靠前 |
| sold | INTEGER DEFAULT 0 | 1 已售（前台打 Sold 标签） |
| price | TEXT DEFAULT '' | 价格文案（留空不显示） |
| views | INTEGER DEFAULT 0 | 浏览次数 |
| created_at / updated_at | TEXT | 默认 `datetime('now')`，updated_at 由触发器维护 |

#### artist —— 艺术家信息（单行，id 恒为 1，`CHECK (id = 1)`）

| 字段 | 说明 |
|---|---|
| id / name / name_en | 中文名 / 英文名 |
| bio / bio_short | 长简介 / 一句话简介（hero 用） |
| avatar / signature | 头像图 / 签名图 URL |
| socials | JSON：`{"instagram":"...","website":"..."}` |
| contact_email / contact_wechat | 联系方式 |
| updated_at | 更新时间 |

#### view_logs —— 浏览日志

`id`、`artwork_id`、`ip_hash`、`user_agent`、`viewed_at`。当前记录浏览量用 `artworks.views`，此表预留。

#### site_content —— 站点文案（key-value）

`key` TEXT PRIMARY KEY，`value` TEXT，`updated_at`。前台文案统一存此表（见 4.4）。

#### categories —— 栏目表

`id`、`key`(UNIQUE，作品引用、建后不可改)、`name`、`image`(底图 URL)、`sort_order`、`enabled`(0/1 软删)、`created_at`、`updated_at`。

#### meetup_items —— 线下活动

`id`、`title`、`date_text`(自由文本，如 "May 2026")、`location`、`image`、`sort_order`、`created_at`、`updated_at`。

#### users —— 后台用户

| 字段 | 说明 |
|---|---|
| id / username | username `COLLATE NOCASE UNIQUE` |
| password_hash | PBKDF2-SHA256 派生结果（base64url），空表示首次登录强制改密 |
| password_salt | 随机盐 |
| password_iterations | 迭代数（100000） |
| password_algo | `PBKDF2-SHA256` |
| created_at / updated_at | 时间戳 |

### 4.3 索引与触发器

**索引**（加速前台列表查询）：

- `idx_artworks_published ON artworks(published, sort_order DESC)`
- `idx_artworks_category ON artworks(published, category, sort_order DESC)`
- `idx_artworks_featured ON artworks(featured, sort_order DESC)`
- `idx_view_logs_artwork ON view_logs(artwork_id, viewed_at)`
- `idx_categories_order ON categories(enabled, sort_order DESC)`
- `idx_meetup_items_order ON meetup_items(sort_order DESC)`

**触发器**（修改核心字段时自动刷新 `updated_at`）：

- `trg_artworks_update_time`（监听 title/description/images/category/year/medium/dimensions/published/featured/sort_order/sold/price）
- `trg_categories_update_time`（key/name/image/sort_order/enabled）
- `trg_meetup_items_update_time`（title/date_text/location/image/sort_order）
- `trg_users_update_time`（username/password_hash/password_salt/password_iterations/password_algo）

### 4.4 site_content 文案键清单

前台所有文案均存于此表，前台经 `T(key, fallback)` 读取：

- **站点/品牌**：`site.title`、`site.description`、`site.og_description`、`site.logo`、`site.favicon`、`site.logo_icon_light`、`site.logo_icon_dark`
- **导航/页脚**：`nav.home`、`nav.works`、`nav.about`、`nav.meetup`、`nav.contact`；`footer.brand`、`footer.links.works|about|contact|admin|meetup`、`footer.copyright`（含 `{year}` 占位）
- **经典 hero（无图回退）**：`hero.eyebrow`、`hero.title`、`hero.subtitle`、`hero.cta.primary`、`hero.cta.secondary`
- **首页第一屏**：`home.hero.image`、`home.hero.eyebrow`、`home.hero.title`、`home.hero.subtitle`、`home.hero.cta`
- **首页第二屏导航图**：`home.nav.home|works|about|meetup|contact.image`
- **首页第三屏内容卡**：`home.cards.title`、`home.cards.subtitle`、`home.cards.count`；`home.card.N.{title,text,image,link}`（N=1..8）
- **作品列表页**：`works.title`、`works.subtitle`、`works.empty.title`、`works.empty.subtitle`
- **分类兜底名**：`category.all`、`category.oil|watercolor|sketch|ink|digital|photograph|other`
- **作品详情页**：`detail.back`、`detail.backBottom`、`detail.meta.category|year|medium|dimensions|published`、`detail.notFound.title|subtitle`、`detail.noImages`、`work.sold`、`work.price`
- **关于页**：`about.unavailable`
- **联系页**：`contact.title`、`contact.subtitle`、`contact.email.label`、`contact.wechat.label`、`contact.note`、`contact.empty`
- **线下交流页**：`meetup.title`、`meetup.subtitle`、`meetup.intro`、`meetup.item.date`、`meetup.item.location`、`meetup.empty`
- **通用**：`common.loading`、`common.thumbnail`、`common.notFound.title|subtitle`、`common.backHome`

> 后台「站点文案」Tab 可平铺编辑任意键；「首页展示」Tab 专门维护 `home.*` 系列。

### 4.5 demo 数据说明（`02_demo_data.sql`）

| 内容 | 数量 | 说明 |
|---|---|---|
| artworks 作品 | 7 件 | 覆盖 7 个栏目；`published`/`featured`/`sold`/`price` 均有示例；图片用 picsum.photos 占位 |
| categories 栏目 | 7 个 | oil/watercolor/sketch/ink/digital/photograph/other，全部启用 |
| meetup_items 活动 | 3 条 | 含日期、地点、图片 |
| site_content 文案 | 若干 | 全部演示文案与首页图片配置 |
| artist 艺术家 | 1 行 | 汤一白 / Tang Yibai 演示档案 |
| users 用户 | 1 行 | admin + PBKDF2 哈希（密码见第 5 节，上线前务必改密） |

> ⚠️ 全部为占位演示数据（picsum.photos 随机配图），上线前请替换为真实资料。

---

## 5. 认证机制

- **密码存储**：随机盐 + PBKDF2-SHA256（100000 次迭代，输出 32 字节），数据库只存哈希；校验使用常数时间比较。
- **会话**：HMAC-SHA256 签名 HttpOnly Cookie（`art_session`），`SameSite=Strict`，HTTPS 自动加 `Secure`，TTL 24 小时，改密后重发 Cookie。
- **首次开通引导**：用户表为空时，用户名须为 `admin` 且密码等于环境变量 `ADMIN_PASSWORD`，成功后写入 PBKDF2 记录；若用户已存在但 `password_hash = ''`，登录后强制改密（`must_change_password`）。
- **改密**：后台「账号安全」，需验证当前密码，新密码 ≥8 位且不得等于旧密码。
- **同源校验**：`/api/admin/*` 写操作校验 `Origin` 与 `Sec-Fetch-Site`，跨站请求 403。

### 默认账号（`02_demo_data.sql` 内置）

- 用户名：`admin`
- 密码：`art-d8ca469c21de651fdc97`
- ⚠️ 上线前请在后台「账号安全」修改为自己的密码。

---

## 6. 本地开发

环境：Node.js + Wrangler（Cloudflare 官方 CLI，无需 npm install，用 `npx wrangler`）。

```powershell
# 1) 复制本地变量模板（值请自行填写）
Copy-Item .dev.vars.example .dev.vars

# 2) 初始化本地 D1（先结构后 demo 数据）
npx wrangler d1 execute art-website-db --local --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --local --file=./doc/sql/02_demo_data.sql

# 3) 启动 Pages
npx wrangler pages dev public --ip 127.0.0.1 --port 8788
```

- 前台：`http://127.0.0.1:8788/`；后台：`http://127.0.0.1:8788/admin/login`
- 本地 D1 数据存放于 `.wrangler/state/`（已 gitignore）
- 部署后检查 `/api/health` 应返回 `ok: true`

---

## 7. 部署（Cloudflare Pages + GitHub）

1. 创建 D1 数据库（如 `art-website-db`），把 `database_id` 写入 `wrangler.jsonc` 的 `d1_databases`：

   ```jsonc
   "d1_databases": [{ "binding": "DB", "database_name": "art-website-db", "database_id": "<id>" }]
   ```

2. GitHub 关联 Cloudflare Pages：Framework preset `None`、Build command 留空、Build output directory `public`、Production branch `main`。Pages 会自动识别根目录 `functions/`。
3. 初始化线上 D1：

   ```powershell
   npx wrangler d1 execute art-website-db --remote --file=./doc/sql/01_schema.sql
   npx wrangler d1 execute art-website-db --remote --file=./doc/sql/02_demo_data.sql
   ```

4. 推送到 `main` 后自动部署。部署后检查 `/api/health`、`/admin/login`，用 `admin` 登录并立即改密。

### 环境变量（必读）

| 变量 | 必填 | 说明 |
|---|---|---|
| `SESSION_SECRET` | ✅ 必须 | 会话 HMAC 签名密钥，≥32 字节随机值；未设置回退 `ADMIN_PASSWORD` |
| `ADMIN_PASSWORD` | 首次开通时 | 引导密码：空用户表 + 用户名为 `admin` 时用于创建首个用户（≥8 位） |

生成随机值：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 常用命令速查

```powershell
# 初始化 / 重置数据库
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/01_schema.sql
npx wrangler d1 execute art-website-db --remote --file=./doc/sql/02_demo_data.sql

# 导出 / 备份
npx wrangler d1 export art-website-db --remote --output=backup.sql

# 本地启动
npx wrangler pages dev public --port 8788

# 校验脚本语法
node --check functions/_lib/auth.js
node --check public/assets/js/admin.js
node --check public/assets/js/views.js
node --check public/assets/js/router.js
```

### 图片方案

- 当前为 **HTTPS 外链**：后台直接粘贴图床 / GitHub raw / OSS 等图片 URL（`isAllowedImageUrl` 校验 `https:` 或 localhost）。
- **R2 预留**：`POST /api/admin/upload` 与 `GET /r2/[[key]]` 代码已实现但休眠；如需启用，在 `wrangler.jsonc` 恢复 `r2_buckets` 绑定（`BUCKET`），可选配置 `R2_CUSTOM_DOMAIN`。

---

## 8. 迁移到其他电脑（复用指南）

1. 克隆仓库；安装 Node.js。
2. 复制 `.dev.vars.example` → `.dev.vars`，填入 `SESSION_SECRET`（与首次开通用的 `ADMIN_PASSWORD`）。
3. 初始化本地数据：

   ```powershell
   npx wrangler d1 execute art-website-db --local --file=./doc/sql/01_schema.sql
   npx wrangler d1 execute art-website-db --local --file=./doc/sql/02_demo_data.sql
   ```

4. 启动：`npx wrangler pages dev public --port 8788`。
5. 用 `admin` / `art-d8ca469c21de651fdc97` 登录后台，按需改密。
6. 如需迁移线上数据：`npx wrangler d1 export art-website-db --remote --output=backup.sql`，在新环境用 `--local --file=backup.sql` 导入。

### 已忽略、切勿提交的文件

`.dev.vars`、`.wrangler/`、`.local-runtime/`、`node_modules/`（见 `.gitignore`）。

---

## 9. 设计约定与注意事项

- **后台配色保持原样**（浅色 + Apple 蓝 `#0066cc`），前台 `main.css` 使用暖色博物馆主题——两者独立，勿互相污染。
- 前台文案一律走 `T(key, fallback)` 读取 `site_content`，`data-text="key"` 属性用于静态骨架文本注入；新增页面请先补 key。
- 图片均为外链 HTTPS；若日后启用 R2，参考 `wrangler.jsonc` 中注释恢复绑定。
- 栏目 `key` 建后不可改：改 key 会导致 `artworks.category` 指向失效，需「换栏目 → 删除 → 用新 key 重建」。
- CSP 头在 `_middleware.js` 统一设置，新增外链域名需同步加白名单。
- 建议在 Cloudflare 对 `/api/admin/login` 配置 Rate Limiting 或 WAF，并定期备份 D1。
- 数据库重置只需执行 `doc/sql/01_schema.sql` + `02_demo_data.sql`；历史增量迁移不再需要单独脚本。



