# Art Website 项目文档

> 本文档记录项目的功能、架构、数据结构与部署方式，供在其他电脑上复用与二次开发。
> 最后更新：2026-09-14

---

## 1. 项目概览

艺术家个人作品集网站，前台展示 + 后台管理一体化，部署在 **Cloudflare Pages**。

- **技术栈**：Cloudflare Pages Functions（Workers）+ Cloudflare D1（SQLite）+ 原生 HTML/CSS/JS
- **零构建**：没有打包工具，`public/` 目录即静态站点，`functions/` 目录即后端 API
- **图片方案**：外链 HTTPS 图床（后台粘贴图片 URL），未绑定对象存储
- **数据库**：本地开发用 Wrangler 内置 SQLite，线上为 D1

### 目录结构

```
art_website/
├── public/                  # 静态站点（部署根目录）
│   ├── index.html           # 前台入口（SPA，hash 路由）
│   ├── admin/
│   │   ├── index.html       # 后台管理
│   │   └── login.html       # 后台登录
│   └── assets/
│       ├── js/              # main.js / views.js / router.js / utils.js / api.js / admin.js
│       └── styles/          # main.css（前台）/ admin.css（后台，保持原配色）
├── functions/               # Cloudflare Pages Functions（后端）
│   ├── _middleware.js       # 全局中间件（CSP 等）
│   ├── _lib/                # auth.js（认证）/ http.js（响应工具）
│   ├── api/                 # 公开 API
│   │   ├── artworks.js / artworks/[id].js
│   │   ├── categories.js / artist.js / meetup.js / site-content.js / health.js
│   │   └── admin/           # 需登录的后台 API（CRUD + 账号）
│   └── r2/[[key]].js        # R2 预留（当前休眠）
├── migrations/              # 数据库迁移（增量）
│   ├── 005_users.sql        # users 表 + 触发器
│   ├── 006_hero_copy.sql    # 首页横图文案
│   ├── 007_home_nav_images.sql  # 第二屏导航背景图
│   ├── 008_hero_image.sql   # 首页横图（Artvee 图）
│   └── 009_logo_icons.sql   # 站点 Logo / favicon（Artvee 默认）
├── schema.sql               # 完整建库脚本（幂等，新库可用）
├── init.sql                 # 完整初始化脚本（结构 + demo 数据 + admin 账号）
├── seed_demo.sql            # demo 数据补充脚本
├── verify.sql               # 数据库校验查询
├── reset_local.sql          # 本地重置辅助
├── wrangler.jsonc           # Cloudflare 配置（D1 绑定等）
├── .dev.vars                # 本地密钥（不入库！）
├── .dev.vars.example        # 密钥模板
└── doc/                     # 本文档目录
```

---

## 2. 前台功能

路由由 `router.js` 按 hash 切换（`#/`、`#/works`、`#/works/:id`、`#/works/category/:key` 等）。

### 2.1 首页 `#/`（Artvee 三段式）

1. **第一屏横图**：全宽背景图，左侧显示主标题/副标题（如 "Discover the best in Classical & Modern Art"）。
   - 图片与文案均可在后台「首页展示 → ① 首页横图」配置（`home.hero.*`）。
   - 导航透明叠加在横图上，左上角显示 Logo（默认 Artvee 白色 SVG，可后台换）。
2. **第二屏导航图条**（Home / Works / About / Meet Up / Contact 五张横图卡）：
   - 每张卡的背景图在后台「首页展示 → ② 第二屏导航背景图」单独配置（`home.nav.*.image`）。
   - 留空时自动回退默认图（Artvee CDN）。
3. **第三屏内容轮播**（owlcontaine owlast）：
   - 标题/副标题/卡片数量/每张卡（图片+文字+详情链接）全部后台可配（`home.cards.*` / `home.card.N.*`）。
   - 点击卡片跳转对应详情页（内部 `#/works/:id` 或外部 https）。
4. **页脚**：品牌文案、页面链接、版权（`footer.*`）。

### 2.2 作品页 `#/works`（Van Gogh Museum 风格）

- 大标题 + 即时搜索框 + 文字分类筛选（含分类路由 `#/works/category/:key`，可前进后退/分享）。
- 6 列网格，图片 `object-fit: cover` 铺满裁切，无边框卡片（无留白）。
- 点击卡片进入 `#/works/:id` 详情页。

### 2.3 作品详情 `#/works/:id`

- 主图 + 缩略图、标题、年份/媒介/尺寸、描述、购买信息（sold/price）。
- 主图点击可放大（lightbox）。图片加载失败显示占位。

### 2.4 其他页面

- **About** `#/about`：艺术家资料（头像/简介/展览经历），后台「艺术家资料」配置。
- **Meet Up** `#/meetup`：线下活动列表，后台「线下交流」维护（标题/时间/地点/图片/链接）。
- **Contact** `#/contact`：联系方式。
- 404 页：无匹配路由时显示（`common.notFound.*`）。

---

## 3. 后台功能（/admin）

登录：`/admin/login`，需要 用户名 + 密码（见第 5 节认证）。

| Tab | 功能 |
|---|---|
| 🎨 作品管理 | 作品 CRUD（标题/描述/多图/分类/年份/媒介/尺寸/上架/精选/排序/售出/价格），搜索与分类筛选 |
| 🏠 首页展示 | ① 首页横图（图 + eyebrow/标题/副标题/CTA）② 第二屏导航背景图（5 张）③ 内容轮播标题/副标题/数量 ④ 内容轮播卡（图+文字+链接） |
| 🗂 栏目管理 | 栏目 CRUD：key（建后不可改）、名称、底图 URL（兜底用）、排序权重、启用/停用 |
| 📍 线下交流 | 活动 CRUD（标题/时间/地点/描述/图片/链接） |
| 👤 艺术家资料 | 姓名、头像、简介、经历等 |
| 📝 站点文案 | 前台所有可见文案，按"前台页面"分组、带用途说明（见 3.1） |
| 🔐 账号安全 | 查看账号信息、修改密码（需输旧密码） |

### 3.1 站点文案分组

配置页顶部有"配置位置说明"，字段按前台页面分组（首页 / 作品 / 详情 / 关于 / 活动 / 联系 / 页脚 / 通用）。
每个字段显示：中文名 + key + 说明。保存只提交有改动的 diff。

注意：`home.hero.*`、`home.nav.*.image`、`home.cards.*` 在「首页展示」tab 配置，不在站点文案页。

### 3.2 站点 Logo / favicon

- `site.logo_icon_light`：首页横图上的浅色（白色）Logo，默认 Artvee 白色 SVG。
- `site.logo_icon_dark`：其他页面左上角深色/彩色 Logo，默认 Artvee 图标 PNG。
- `site.favicon`：浏览器标签页图标。
- Logo 只显示图标不显示文字（Artvee 风格）；图片加载失败自动回退显示 "A" 方块。
- 在站点文案 tab 中可随时替换成自己的图片地址。

---

## 4. 数据库

D1（SQLite）。表：

| 表 | 用途 |
|---|---|
| `artworks` | 作品（多图存 JSON 数组字符串；`featured` 用于精选回退） |
| `categories` | 栏目（key/name/image/sort_order/enabled），启用栏目驱动作品筛选 |
| `meetups` | 线下活动 |
| `site_content` | 全部文案与配置（key-value，约 111 条） |
| `artist` | 艺术家资料（单行 id=1） |
| `users` | 后台用户（见第 5 节） |

### site_content key 前缀速查

- `site.*`：站点名/标题/描述/favicon/logo
- `nav.*`：导航文字；`footer.*`：页脚
- `home.hero.*`：首页横图；`home.nav.*.image`：第二屏导航图
- `home.cards.*` / `home.card.N.*`：内容轮播
- `works.*` / `detail.*`：作品页与详情页
- `about.*` / `meetup.*` / `contact.*`：各页面文案
- `category.<key>`：分类兜底名
- `common.*`：通用（loading、404 等）

### 初始化 / 迁移

- **全新库**：直接执行 `init.sql`（含 DROP + 建表 + 全部 demo 数据 + admin 账号），幂等可重跑。
- **已有库增量升级**：按顺序执行 `migrations/005~009`。
- `schema.sql`：仅结构 + 默认值（无 demo 作品），适合线上库结构参照。
- 验证：`verify.sql`（输出 JSON 报告）。

---

## 5. 认证机制

- `users` 表：`username`、`password_hash`（**PBKDF2-SHA256，210000 迭代，随机盐**，只存哈希）、`created_at`、`updated_at`、触发器防止重复用户名/更新时间戳。
- 首个用户激活：`admin` + 环境变量 `ADMIN_PASSWORD`（在 `.dev.vars`，不入库）。
- 会话：登录成功后下发 HttpOnly Cookie（userId + 签名，密钥 `SESSION_SECRET`），所有 `/api/admin/*` 经 `functions/_lib/auth.js` 校验。
- 改密：后台「账号安全」，需验证旧密码，新密码哈希后入库。

### 默认账号（init.sql 内置）

- 用户名：`admin`
- 密码：`art-d8ca469c21de651fdc97`
- ⚠️ 上线前请在后台「账号安全」修改为自己的密码。

---

## 6. API 清单

公开（无需登录）：

```
GET /api/health                  # 健康检查（含 DB 绑定状态）
GET /api/artworks                # 作品列表（支持 ?category=&search=）
GET /api/artworks/:id            # 作品详情（自增浏览量）
GET /api/categories              # 启用栏目
GET /api/artist                  # 艺术家资料
GET /api/meetup                  # 活动列表
GET /api/site-content            # 全部文案配置
```

后台（需登录 Cookie）：

```
POST   /api/admin/login              # 登录
POST   /api/admin/logout             # 登出
GET    /api/admin/account            # 当前账号信息
PUT    /api/admin/password           # 修改密码
CRUD   /api/admin/artworks[/new|:id] # 作品
CRUD   /api/admin/categories[/new|:id]
CRUD   /api/admin/meetup
GET/PUT /api/admin/site-content      # 文案（PUT 为平铺 {key:value} 批量 upsert）
GET/PUT /api/admin/artist            # 艺术家资料
```

---

## 7. 本地开发

环境：Node.js + Wrangler 4.131.1（无需 npm install，Wrangler 可用 dlx 缓存运行）。

```
# 在项目根目录
npx wrangler pages dev public --port 8788
```

- 访问 `http://127.0.0.1:8788`（前台）、`http://127.0.0.1:8788/admin/`（后台）。
- 本地 D1 数据在 `.wrangler/state/`（已 gitignore）。
- 密钥：复制 `.dev.vars.example` 为 `.dev.vars`，填 `ADMIN_PASSWORD` 与 `SESSION_SECRET`。
- 重新初始化本地数据：`npx wrangler d1 execute art-website-db --local --file init.sql`

---

## 8. 部署（Cloudflare Pages + GitHub）

1. Cloudflare Dashboard 创建 D1 数据库（名字如 `art-website-db`），把 `database_id` 填进 `wrangler.jsonc`。
2. GitHub 关联 Cloudflare Pages：构建命令留空，输出目录 `public`（`pages_build_output_dir` 已配置）。
3. Pages 项目环境变量中设置 `ADMIN_PASSWORD` 与 `SESSION_SECRET`。
4. 首次部署后对线上 D1 执行初始化：
   - 远程执行：`npx wrangler d1 execute art-website-db --remote --file init.sql`
   - （或仅执行 `schema.sql` + `seed_demo.sql` 分步初始化）
5. 部署后用 `admin` + 你设置的 `ADMIN_PASSWORD` 首次登录后台，立即改密。

### 已忽略、切勿提交的文件

`.dev.vars`、`.wrangler/`、`.local-runtime/`、`node_modules/`（见 `.gitignore`）。

---

## 9. 迁移到其他电脑（复用指南）

1. 克隆仓库；安装 Node.js。
2. 复制 `.dev.vars.example` → `.dev.vars`，填入 `ADMIN_PASSWORD`、`SESSION_SECRET`。
3. 启动：`npx wrangler pages dev public --port 8788`（首次会自动建本地 D1）。
4. 初始化本地数据：`npx wrangler d1 execute art-website-db --local --file init.sql`
5. 用 `admin` / `art-d8ca469c21de651fdc97` 登录后台，按需改密。
6. 如需迁移线上数据：`npx wrangler d1 export art-website-db --remote --output=backup.sql`，在新环境 `--local --file=backup.sql` 导入。

---

## 10. 设计约定与注意事项

- **后台配色保持原样**（浅色 + Apple 蓝 `#0066cc`），前台 `main.css` 使用暖色博物馆主题——两者独立，勿互相污染。
- 前台文案一律走 `T(key, fallback)` 读取 `site_content`，`data-text="key"` 属性用于静态骨架文本注入。
- 图片均为外链 HTTPS；若日后启用 R2，参考 `wrangler.jsonc` 中注释恢复绑定（`functions/r2/[[key]].js` 与 `upload.js` 已预留）。
- 分类 key 建后不可改（作品按 key 引用）。
- CSP 头在 `functions/_middleware.js` 统一设置，新增外链域名需同步加白名单。