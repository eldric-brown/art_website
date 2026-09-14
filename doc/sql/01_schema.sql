-- ============================================================
-- Art Website - 01_schema.sql  初始化语句
-- ============================================================
-- 用途：建立全部数据表、索引、触发器与 Logo/favicon 基线值。
-- 执行：新库或彻底重置时运行（会 DROP 并重建业务表）。
--
--   npx wrangler d1 execute art-website-db --local  --file=./doc/sql/01_schema.sql
--   npx wrangler d1 execute art-website-db --remote --file=./doc/sql/01_schema.sql
--
-- 配套：02_demo_data.sql（demo 数据导入脚本，建库后执行）
-- ============================================================

DROP TABLE IF EXISTS view_logs;
DROP TABLE IF EXISTS artworks;
DROP TABLE IF EXISTS artist;
DROP TABLE IF EXISTS site_content;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS meetup_items;
DROP TABLE IF EXISTS users;

-- 作品表
CREATE TABLE artworks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    images      TEXT    NOT NULL,                 -- JSON 数组字符串：["url1","url2"]
    category    TEXT    NOT NULL DEFAULT 'other', -- 对应 categories.key
    year        INTEGER NOT NULL,
    medium      TEXT    DEFAULT '',
    dimensions  TEXT    DEFAULT '',
    published   INTEGER NOT NULL DEFAULT 0,       -- 1 = 上架
    featured    INTEGER NOT NULL DEFAULT 0,       -- 1 = 首页精选
    sort_order  INTEGER NOT NULL DEFAULT 0,       -- 越大越靠前
    sold        INTEGER NOT NULL DEFAULT 0,       -- 1 = 已售
    price       TEXT    NOT NULL DEFAULT '',
    views       INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 艺术家信息表（单艺术家，id 恒为 1）
CREATE TABLE artist (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    name       TEXT    NOT NULL,
    name_en    TEXT    DEFAULT '',
    bio        TEXT    DEFAULT '',
    bio_short  TEXT    DEFAULT '',
    avatar     TEXT    DEFAULT '',
    signature  TEXT    DEFAULT '',
    socials    TEXT    DEFAULT '{}',              -- JSON：{"weibo":"...","instagram":"..."}
    contact_email TEXT DEFAULT '',
    contact_wechat TEXT DEFAULT '',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 浏览日志表（预留；浏览量当前记录在 artworks.views）
CREATE TABLE view_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    ip_hash    TEXT    DEFAULT '',
    user_agent TEXT    DEFAULT '',
    viewed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 站点文案表（key-value）
CREATE TABLE site_content (
    key        TEXT    PRIMARY KEY,
    value      TEXT    NOT NULL DEFAULT '',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 栏目表
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT    NOT NULL UNIQUE,           -- 作品引用，建后不可改
    name       TEXT    NOT NULL,
    image      TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,        -- 1 = 启用 / 0 = 停用（软删）
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 线下活动表
CREATE TABLE meetup_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    date_text  TEXT    NOT NULL DEFAULT '',
    location   TEXT    NOT NULL DEFAULT '',
    image      TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 后台用户表（密码只存 PBKDF2-SHA256 哈希）
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT    NOT NULL,
    password_salt       TEXT    NOT NULL,
    password_iterations INTEGER NOT NULL DEFAULT 100000,
    password_algo       TEXT    NOT NULL DEFAULT 'PBKDF2-SHA256',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_artworks_published ON artworks(published, sort_order DESC);
CREATE INDEX idx_artworks_category  ON artworks(published, category, sort_order DESC);
CREATE INDEX idx_artworks_featured  ON artworks(featured, sort_order DESC);
CREATE INDEX idx_view_logs_artwork ON view_logs(artwork_id, viewed_at);
CREATE INDEX idx_categories_order ON categories(enabled, sort_order DESC);
CREATE INDEX idx_meetup_items_order ON meetup_items(sort_order DESC);

-- 触发器：修改核心字段时自动刷新 updated_at
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
                dimensions, published, featured, sort_order, sold, price ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_categories_update_time
AFTER UPDATE OF key, name, image, sort_order, enabled ON categories
FOR EACH ROW
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_meetup_items_update_time
AFTER UPDATE OF title, date_text, location, image, sort_order ON meetup_items
FOR EACH ROW
BEGIN
    UPDATE meetup_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_users_update_time
AFTER UPDATE OF username, password_hash, password_salt, password_iterations, password_algo ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 基线值：站点 Logo / favicon（默认 Artvee 资源，后台可替换）
INSERT OR REPLACE INTO site_content (key, value) VALUES
  ('site.favicon',         'https://mdl.artvee.com/assets/icon-350x350.png'),
  ('site.logo_icon_light', 'https://mdl.artvee.com/assets/logow-4.svg'),
  ('site.logo_icon_dark',  'https://mdl.artvee.com/assets/icon-350x350.png');
