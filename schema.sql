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

-- 站点文案表（前台所有可配置文本，单语言/英文）
-- key 命名：页面.区块.条目，全部小写下划线
-- 后台可编辑，前端启动时通过 /api/site-content 一次性拉取
CREATE TABLE IF NOT EXISTS site_content (
    key        TEXT    PRIMARY KEY,              -- 例：'hero.title', 'nav.home'
    value      TEXT    NOT NULL DEFAULT '',      -- 英文文案
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 触发器：内容变更时自动更新 updated_at
-- 不监听 views，避免浏览量增加后把作品误判为刚编辑。
DROP TRIGGER IF EXISTS trg_artworks_update_time;
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
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

-- 站点元信息（HTML <head> 和导航 logo 文字）
('site.title',          'Tang Yibai · Portfolio'),
('site.description',    'Tang Yibai · Personal Art Portfolio · Painting & Visual Arts'),
('site.og_description', 'Painting and visual art showcase'),
('site.logo',           'Tang Yibai'),

-- 首页 Hero
('hero.title',        'Tang Yibai'),
('hero.eyebrow',      'Tang Yibai · Art Portfolio'),
('hero.subtitle',     'Painting as the confession of the soul — stories told through color and line.'),
('hero.cta.primary',  'Browse Works'),
('hero.cta.secondary','Meet the Artist'),

-- 首页 Featured 区块
('featured.title',    'Featured Works'),
('featured.subtitle', 'A selection of representative pieces · Click for details'),
('featured.viewAll',  'View All Works →'),

-- 作品列表页
('works.title',        'Works'),
('works.subtitle',     'Filter by category, sorted by year.'),
('works.empty.title',  'No Works Yet'),
('works.empty.subtitle', 'Tang Yibai has not published any works yet.'),

-- 作品分类（前端 window.CATEGORIES 使用）
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
('footer.copyright',      '© {year} All Rights Reserved'),

-- 通用状态
('common.loading',          'Loading...'),
('common.thumbnail',        'Thumbnail'),
('common.notFound.title',   'Page Not Found'),
('common.notFound.subtitle','The page you are looking for does not exist.'),
('common.backHome',         'Back to Home');

