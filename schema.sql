-- ============================================================
-- Art Website - D1 完整数据库脚本（结构 + 基线数据）
-- ============================================================
-- 本文件是唯一的"结构真源"：全部表、索引、触发器都在此定义，
-- migrations/001 与 002 的内容已合并进来。新建空库只跑这一个文件。
--
-- 用法（本地）：
--   npx wrangler d1 execute art-website-db --local  --file=./schema.sql
-- 用法（线上）：
--   npx wrangler d1 execute art-website-db --remote --file=./schema.sql
--
-- 配套脚本：
--   verify.sql     建库后跑一遍，确认表/行数/数据格式无误（只读，可反复跑）
--   seed_demo.sql  可选，灌入演示用的艺术家档案 + 作品 + 线下活动
--   reset_local.sql 本地库想清空重来时先跑它，再跑本文件
--   migrations/    仅给"已建过的老库"做增量升级，新库不要跑
--
-- 幂等性：本文件可反复执行。
--   CREATE TABLE / CREATE INDEX 均带 IF NOT EXISTS；
--   触发器先 DROP IF EXISTS 再 CREATE；
--   数据用 INSERT OR IGNORE（不会覆盖后台已改过的值）。
-- 因此"漏跑一次"或"多跑一次"都不会破坏已有数据。
-- ============================================================

-- 作品表
CREATE TABLE IF NOT EXISTS artworks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,                    -- 作品标题
    description TEXT    DEFAULT '',                  -- 作品简介 / 创作背景
    images      TEXT    NOT NULL,                    -- JSON 数组字符串：["url1", "url2"]，图片地址（HTTPS 外链或站内 /r2/ 路径）
    category    TEXT    NOT NULL DEFAULT 'other',    -- 栏目 key，对应 categories.key
    year        INTEGER NOT NULL,                    -- 创作年份
    medium      TEXT    DEFAULT '',                  -- 媒介：如"布面油画"、"水彩纸"
    dimensions  TEXT    DEFAULT '',                  -- 尺寸：如"60 x 80 cm"
    published   INTEGER NOT NULL DEFAULT 0,          -- 上架开关：1 = 上架，0 = 下架
    featured    INTEGER NOT NULL DEFAULT 0,          -- 首页精选：1 = 精选，0 = 非精选
    sort_order  INTEGER NOT NULL DEFAULT 0,          -- 排序权重，越大越靠前
    sold        INTEGER NOT NULL DEFAULT 0,          -- 是否已售：1 = 已售（前台打标签），0 = 在售
    price       TEXT    NOT NULL DEFAULT '',         -- 价格文案（如 USD 1,200），留空则前台不显示
    views       INTEGER NOT NULL DEFAULT 0,          -- 浏览次数（用于展示人气）
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引：加速前端列表查询（按分类、上架状态、排序）
CREATE INDEX IF NOT EXISTS idx_artworks_published ON artworks(published, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_category  ON artworks(published, category, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_featured  ON artworks(featured, sort_order DESC);

-- 艺术家信息表（单艺术家，id 恒为 1）
CREATE TABLE IF NOT EXISTS artist (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    name       TEXT    NOT NULL,
    name_en    TEXT    DEFAULT '',
    bio        TEXT    DEFAULT '',                   -- 个人简介（长文本）
    bio_short  TEXT    DEFAULT '',                   -- 一句话简介（首页 hero 用）
    avatar     TEXT    DEFAULT '',
    signature  TEXT    DEFAULT '',                   -- 签名图 URL
    socials    TEXT    DEFAULT '{}',                 -- JSON：{"weibo":"...", "instagram":"...", ...}
    contact_email TEXT DEFAULT '',
    contact_wechat TEXT DEFAULT '',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 后台用户表
-- 密码只保存 PBKDF2-SHA256 派生结果，不保存明文或可逆密文。
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT    NOT NULL,
    password_salt       TEXT    NOT NULL,
<<<<<<< HEAD
    password_iterations INTEGER NOT NULL DEFAULT 100000,
=======
    password_iterations INTEGER NOT NULL DEFAULT 210000,
>>>>>>> ed1c59db16bc608dd4c6f332118edae694bb8c2c
    password_algo       TEXT    NOT NULL DEFAULT 'PBKDF2-SHA256',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 浏览量记录表（可选，用于分析热门作品）
CREATE TABLE IF NOT EXISTS view_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    ip_hash    TEXT    DEFAULT '',
    user_agent TEXT    DEFAULT '',
    viewed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_view_logs_artwork ON view_logs(artwork_id, viewed_at);

-- 站点文案表（前台所有可配置文本，单语言/英文）
-- key 命名：页面.区块.条目，全部小写下划线
-- 后台可编辑，前端启动时通过 /api/site-content 一次性拉取
CREATE TABLE IF NOT EXISTS site_content (
    key        TEXT    PRIMARY KEY,              -- 例：'hero.title', 'nav.home'
    value      TEXT    NOT NULL DEFAULT '',      -- 英文文案
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 栏目表（原 7 个硬编码分类迁入数据库，后台可增删、改名、换底图）
-- 删除走 enabled=0 软删，避免 artworks.category 指向不存在的栏目。
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT    NOT NULL UNIQUE,           -- 栏目 key（oil/watercolor/...），作品表引用，建后不建议修改
    name       TEXT    NOT NULL,                  -- 前台显示名（英文）
    image      TEXT    NOT NULL DEFAULT '',       -- 底图 URL（HTTPS 外链或站内 /r2/artworks/ 路径）
    sort_order INTEGER NOT NULL DEFAULT 0,        -- 排序权重，越大越靠前
    enabled    INTEGER NOT NULL DEFAULT 1,        -- 1 = 启用（前台可见、作品可选），0 = 停用
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(enabled, sort_order DESC);

-- 线下交流条目（展览、工作室访问、线下活动）
CREATE TABLE IF NOT EXISTS meetup_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,                  -- 条目标题（英文，前台显示）
    date_text  TEXT    NOT NULL DEFAULT '',       -- 日期/时间，自由文本（如 "May 2026"）
    location   TEXT    NOT NULL DEFAULT '',       -- 地点（如 "Shanghai · Xintiandi"）
    image      TEXT    NOT NULL DEFAULT '',       -- 图片 URL
    sort_order INTEGER NOT NULL DEFAULT 0,        -- 排序权重，越大越靠前
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetup_items_order ON meetup_items(sort_order DESC);

-- 触发器：内容变更时自动更新 updated_at
-- 不监听 views，避免浏览量增加后把作品误判为刚编辑。
DROP TRIGGER IF EXISTS trg_artworks_update_time;
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
                dimensions, published, featured, sort_order, sold, price ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;

-- 栏目 / 线下交流条目变更时自动更新 updated_at
DROP TRIGGER IF EXISTS trg_categories_update_time;
CREATE TRIGGER trg_categories_update_time
AFTER UPDATE OF key, name, image, sort_order, enabled ON categories
FOR EACH ROW
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = OLD.id;
END;

DROP TRIGGER IF EXISTS trg_meetup_items_update_time;
CREATE TRIGGER trg_meetup_items_update_time
AFTER UPDATE OF title, date_text, location, image, sort_order ON meetup_items
FOR EACH ROW
BEGIN
    UPDATE meetup_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;

DROP TRIGGER IF EXISTS trg_users_update_time;
CREATE TRIGGER trg_users_update_time
AFTER UPDATE OF username, password_hash, password_salt, password_iterations, password_algo ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ============================================================
-- 初始数据：插入艺术家默认信息（后台可修改）
-- ============================================================
INSERT OR IGNORE INTO artist (id, name, name_en, bio, bio_short, socials)
VALUES (
    1,
    '汤一白',
    'Tang Yibai',
    '汤一白，青年艺术家，以绘画与视觉艺术表达内心与世界的对话。',
    '用色彩与线条，讲述每一个瞬间的故事',
    '{"weibo":"","instagram":"","xiaohongshu":"","website":""}'
);

-- ============================================================
-- 初始栏目（与 artworks.category 既有取值一一对应，后台可增删/改名/换底图）
-- INSERT OR IGNORE + UNIQUE key 保证重复执行不会破坏已有修改。
-- ============================================================
INSERT OR IGNORE INTO categories (key, name, sort_order) VALUES
    ('oil',        'Oil Painting',     70),
    ('watercolor', 'Watercolor',       60),
    ('sketch',     'Sketch',           50),
    ('ink',        'Chinese Painting', 40),
    ('digital',    'Digital',          30),
    ('photograph', 'Photograph',       20),
    ('other',      'Other',            10);

-- ============================================================
-- 初始站点文案（英文）
-- ============================================================
-- 一次性插入。用户在后台"站点文案"面板可覆盖任意条目，
-- INSERT OR IGNORE 保证重复执行 schema.sql 不会破坏已有修改。
INSERT OR IGNORE INTO site_content (key, value) VALUES

-- 导航
('nav.home',        'Home'),

('nav.works',       'Works'),
('nav.about',       'About'),
('nav.contact',     'Contact'),
('nav.meetup',      'Meet Up'),

-- 站点元信息（HTML <head> 和导航 logo 文字）
('site.title',          'Tang Yibai · Portfolio'),
('site.description',    'Tang Yibai · Personal Art Portfolio · Painting & Visual Arts'),
('site.og_description', 'Painting and visual art showcase'),
('site.logo',           'Tang Yibai'),
('site.favicon',         'https://mdl.artvee.com/assets/icon-350x350.png'),
('site.logo_icon_light', 'https://mdl.artvee.com/assets/logow-4.svg'),
('site.logo_icon_dark',  'https://mdl.artvee.com/assets/icon-350x350.png'),

-- 首页 Hero
('hero.title',        'Tang Yibai'),
('hero.eyebrow',      'Tang Yibai · Art Portfolio'),
('hero.subtitle',     'Painting as the confession of the soul — stories told through color and line.'),
('hero.cta.primary',  'Browse Works'),
('hero.cta.secondary','Meet the Artist'),

-- 首页第二屏导航背景图（后台「首页展示」可编辑；留空时前台自动取图）
('home.nav.home.image',    'https://mdl.artvee.com/assets/bgs/abstract.jpg'),
('home.nav.works.image',   'https://mdl.artvee.com/assets/bgs/landscape.jpg'),
('home.nav.about.image',   'https://mdl.artvee.com/assets/bgs/figurative.jpg'),
('home.nav.meetup.image',  'https://mdl.artvee.com/assets/bgs/posters.jpg'),
('home.nav.contact.image', 'https://mdl.artvee.com/assets/bgs/still-life.jpg'),

-- 首页 Hero 横图（三段式第一屏）
-- image 为空时前台自动回退到精选作品首图；title/subtitle/cta 为空则不叠加文字与按钮，只保留纯图
('home.hero.image',   'https://mdl.artvee.com/assets/tmbg.jpg'),
('home.hero.eyebrow', 'Discover the best in'),
('home.hero.title',   'Classical & Modern Art'),
('home.hero.subtitle','Browse and download high-resolution, public domain paintings, posters and illustrations'),
('home.hero.cta',     ''),

-- 首页 Featured 区块

-- 首页「Selected Works」区块（三段式第二屏，对应 artvee 的 Dive into Books & Wall Charts）
-- 内容取自 featured=1 的作品，后台在作品表单里勾选「精选」即可进首页

-- 首页「入口卡」区块（三段式第三屏：作品集 / 关于 / 线下交流，标题复用 nav.*）

-- 作品列表页
('works.title',        'Works'),
('works.subtitle',     'Filter by category, sorted by year.'),
('works.empty.title',  'No Works Yet'),
('works.empty.subtitle', 'Tang Yibai has not published any works yet.'),

-- 作品分类兜底文案（首选取自 categories 表；后台停用或改名后仍能显示）
('category.all',        'All'),
('category.oil',        'Oil Painting'),
('category.watercolor', 'Watercolor'),
('category.sketch',     'Sketch'),
('category.ink',        'Chinese Painting'),
('category.digital',    'Digital'),
('category.photograph', 'Photograph'),
('category.other',      'Other'),

-- 作品详情页
('detail.back',           '← Back to Works'),
('detail.backBottom',     '← All Works'),
('detail.meta.category',  'Category'),
('detail.meta.year',      'Year'),
('detail.meta.medium',    'Medium'),
('detail.meta.dimensions','Dimensions'),
('detail.meta.published', 'Published'),
('detail.notFound.title',   'Artwork Not Found'),
('detail.notFound.subtitle','It may have been unpublished or the link is invalid.'),
('detail.noImages',         'This artwork has no images.'),

-- 作品价格与售出状态（price 为空时前台不渲染价格；sold=1 时打标签）
('work.sold',  'Sold'),
('work.price', 'Price'),

-- 关于页
('about.unavailable', 'Artist information unavailable'),

-- 联系页
('contact.title',         'Contact'),
('contact.subtitle',      'Commissions, exhibitions, press inquiries — welcome.'),
('contact.email.label',   'Email'),
('contact.wechat.label',  'WeChat'),
('contact.note',          'Note'),
('contact.empty',         'Contact details not yet provided.'),

-- 页脚
('footer.brand',          'Tang Yibai · Art Portfolio'),
('footer.links.works',    'All Works'),
('footer.links.about',    'About'),
('footer.links.contact',  'Contact'),
('footer.links.admin',    'Admin'),
('footer.links.meetup',   'Meet Up'),
('footer.copyright',      '© {year} All Rights Reserved'),

-- 线下交流页
('meetup.title',         'Meet Up'),
('meetup.subtitle',      'Exhibitions, studio visits and in-person exchange.'),
('meetup.intro',         ''),
('meetup.item.date',     'Date'),
('meetup.item.location', 'Location'),
('meetup.empty',         'No meetups have been announced yet.'),

-- 通用状态
('common.loading',          'Loading...'),
('common.thumbnail',        'Thumbnail'),
('common.notFound.title',   'Page Not Found'),
('common.notFound.subtitle','The page you are looking for does not exist.'),
-- 首页内容卡（第二屏「Dive into」区，后台在「首页展示」里增删）
-- home.cards.count 记录卡片数量；home.card.N.{title,text,image,link} 为第 N 张卡
('home.cards.title',    'Dive into the Collection'),
('home.cards.subtitle', 'A closer look at selected works and themes.'),
('home.cards.count',    '0'),
('home.card.1.title',  ''),
('home.card.1.text',   ''),
('home.card.1.image',  ''),
('home.card.1.link',   '#/works'),
('home.card.2.title',  ''),
('home.card.2.text',   ''),
('home.card.2.image',  ''),
('home.card.2.link',   '#/meetup'),
('home.card.3.title',  ''),
('home.card.3.text',   ''),
('home.card.3.image',  ''),
('home.card.3.link',   ''),
('home.card.4.title',  ''),
('home.card.4.text',   ''),
('home.card.4.image',  ''),
('home.card.4.link',   ''),

-- 首页入口区（第三屏：首页 / 作品 / 线下交流 / 联系我们，标题复用 nav.*）

('common.backHome',         'Back to Home');

