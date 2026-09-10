-- ============================================================
-- Art Website - D1 数据库初始化脚本
-- ============================================================
-- 用法：
--   本地：wrangler d1 execute art-website-db --local --file=./schema.sql
--   线上：wrangler d1 execute art-website-db --remote --file=./schema.sql
-- ============================================================

-- 作品表
CREATE TABLE IF NOT EXISTS artworks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,                    -- 作品标题
    slug        TEXT    NOT NULL UNIQUE,             -- URL 友好的英文标识（用于详情页）
    description TEXT    DEFAULT '',                  -- 作品简介 / 创作背景
    images      TEXT    NOT NULL,                    -- JSON 数组字符串：["url1", "url2"]，图片地址（HTTPS 外链或站内 /r2/ 路径）
    category    TEXT    NOT NULL DEFAULT 'other',    -- 分类：oil/watercolor/sketch/digital/photograph/other
    year        INTEGER NOT NULL,                    -- 创作年份
    medium      TEXT    DEFAULT '',                  -- 媒介：如"布面油画"、"水彩纸"
    dimensions  TEXT    DEFAULT '',                  -- 尺寸：如"60 x 80 cm"
    published   INTEGER NOT NULL DEFAULT 0,          -- 上架开关：1 = 上架，0 = 下架
    featured    INTEGER NOT NULL DEFAULT 0,          -- 首页精选：1 = 精选，0 = 非精选
    sort_order  INTEGER NOT NULL DEFAULT 0,          -- 排序权重，越大越靠前
    views       INTEGER NOT NULL DEFAULT 0,          -- 浏览次数（用于展示人气）
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引：加速前端列表查询（按分类、上架状态、排序）
CREATE INDEX IF NOT EXISTS idx_artworks_published ON artworks(published, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_category  ON artworks(published, category, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_featured  ON artworks(featured, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_artworks_slug      ON artworks(slug);

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

-- 浏览量记录表（可选，用于分析热门作品）
CREATE TABLE IF NOT EXISTS view_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    ip_hash    TEXT    DEFAULT '',
    user_agent TEXT    DEFAULT '',
    viewed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_view_logs_artwork ON view_logs(artwork_id, viewed_at);

-- 触发器：内容变更时自动更新 updated_at
-- 不监听 views，避免浏览量增加后把作品误判为刚编辑。
DROP TRIGGER IF EXISTS trg_artworks_update_time;
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, slug, description, images, category, year, medium,
                dimensions, published, featured, sort_order ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now')
    WHERE id = OLD.id;
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
