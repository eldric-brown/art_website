-- ============================================================
-- Migration 002: 首页三段式 / 栏目表 / 线下交流 / 作品价格与已售
-- ============================================================
-- 何时跑：仅在"已跑过 schema.sql + migration 001"的老库上执行一次
--   npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/002_homepage_meetup.sql
--   npx wrangler@latest d1 execute art-website-db --local  --file=./migrations/002_homepage_meetup.sql
-- 新建空库：直接用 schema.sql（已同步更新），不要跑迁移。
-- 注意：SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS，
--       第 1 节两条 ALTER 只能执行一次；重复执行会报 duplicate column name。
--       其余语句（CREATE ... IF NOT EXISTS / INSERT OR IGNORE）可重复执行。
-- ============================================================

-- ---------- 1. artworks：新增 sold / price ----------
ALTER TABLE artworks ADD COLUMN sold  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE artworks ADD COLUMN price TEXT    NOT NULL DEFAULT '';

-- ---------- 2. 触发器：sold / price 纳入 updated_at 监听 ----------
DROP TRIGGER IF EXISTS trg_artworks_update_time;
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
                dimensions, published, featured, sort_order, sold, price
ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;

-- ---------- 3. categories：栏目表 ----------
-- 原 7 个硬编码分类迁入数据库，后台可增删、改名、换底图。
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

DROP TRIGGER IF EXISTS trg_categories_update_time;
CREATE TRIGGER trg_categories_update_time
AFTER UPDATE OF key, name, image, sort_order, enabled ON categories
FOR EACH ROW
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 种子：INSERT OR IGNORE + UNIQUE key 保证重复执行不会覆盖后台已改过的名称
INSERT OR IGNORE INTO categories (key, name, sort_order) VALUES
    ('oil',        'Oil Painting',     70),
    ('watercolor', 'Watercolor',       60),
    ('sketch',     'Sketch',           50),
    ('ink',        'Chinese Painting', 40),
    ('digital',    'Digital',          30),
    ('photograph', 'Photograph',       20),
    ('other',      'Other',            10);

-- ---------- 4. meetup_items：线下交流条目 ----------
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

DROP TRIGGER IF EXISTS trg_meetup_items_update_time;
CREATE TRIGGER trg_meetup_items_update_time
AFTER UPDATE OF title, date_text, location, image, sort_order ON meetup_items
FOR EACH ROW
BEGIN
    UPDATE meetup_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- ---------- 5. site_content：新增英文文案键 ----------
INSERT OR IGNORE INTO site_content (key, value) VALUES

-- 导航 / 页脚
('nav.meetup',          'Meet Up'),
('footer.links.meetup', 'Meet Up'),

-- 首页 hero 横图（image 为空时前台自动回退到精选作品首图；
--  title/subtitle/cta 为空则不叠加文字与按钮，只保留纯图）
('home.hero.image',     ''),
('home.hero.title',     ''),
('home.hero.subtitle',  ''),
('home.hero.cta',       'View the Collection'),

-- 首页「Selected Works」区块（对应 artvee 的 Dive into Books & Wall Charts）
('home.features.title',    'Selected Works'),
('home.features.subtitle', 'A selection of recent pieces · Click for details'),
('home.features.viewAll',  'View All Works →'),

-- 首页「入口卡」区块（第三屏：作品集 / 关于 / 线下交流，标题复用 nav.*）
('home.entry.works.desc',  'Browse the full collection, filter by category.'),
('home.entry.about.desc',  'Biography, studio practice and press.'),
('home.entry.meetup.desc', 'Exhibitions, studio visits and in-person exchange.'),

-- 作品：价格与已售标签
('work.sold',  'Sold'),
('work.price', 'Price'),

-- 线下交流页
('meetup.title',         'Meet Up'),
('meetup.subtitle',      'Exhibitions, studio visits and in-person exchange.'),
('meetup.intro',         ''),
('meetup.item.date',     'Date'),
('meetup.item.location', 'Location'),
('meetup.empty',         'No meetups have been announced yet.');
