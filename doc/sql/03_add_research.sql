-- ============================================================
-- Art Website - 03_add_research.sql  增量迁移：新增「研究方向」
-- ============================================================
-- 用途：给【已有数据库】加上研究方向的两张表、索引、触发器与三个基础板块。
--
-- ⚠️ 本脚本是【增量迁移】，不会删除或清空任何现有数据。
--    01_schema.sql 会先 DROP 再重建全部业务表，只应在新库或明确要重置时运行；
--    如果生产库已经有作品/栏目/活动数据，请务必用本脚本而不是 01_schema.sql。
--
--   npx wrangler d1 execute art-website-db --local  --file=./doc/sql/03_add_research.sql
--   npx wrangler d1 execute art-website-db --remote --file=./doc/sql/03_add_research.sql
--
-- 全部语句幂等（CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- CREATE TRIGGER IF NOT EXISTS / INSERT OR IGNORE），可重复执行。
--
-- 配套：02_demo_data.sql 里有研究方向的演示内容，但那是一份【全量灌数】脚本
--       （会给 artworks / site_content 重复插数），已上线的库请单独挑取其中的
--       research_items 部分，或直接去后台「研究方向」里手写内容。
-- ============================================================

-- 板块表：一个板块对应前台页面的一整段（Question / Method / Experiments 等）
CREATE TABLE IF NOT EXISTS research_sections (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    slug       TEXT    NOT NULL UNIQUE,           -- 板块标识：question / method / experiments
    title      TEXT    NOT NULL DEFAULT '',
    subtitle   TEXT    NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,        -- 越大越靠前
    enabled    INTEGER NOT NULL DEFAULT 1,        -- 1 = 启用 / 0 = 停用（软删）
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 条目表：一个板块下的若干富文本块（文字样式 + 图片 URL + 布局块）
CREATE TABLE IF NOT EXISTS research_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,                  -- research_sections.id（逻辑外键，无级联）
    title      TEXT    NOT NULL DEFAULT '',
    body       TEXT    NOT NULL DEFAULT '',       -- 富文本 HTML：写入时经白名单净化
    sort_order INTEGER NOT NULL DEFAULT 0,        -- 越大越靠前
    enabled    INTEGER NOT NULL DEFAULT 1,        -- 1 = 前台显示 / 0 = 仅后台可见
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_research_sections_order ON research_sections(enabled, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_research_items_section ON research_items(section_id, sort_order DESC);

-- 触发器：修改核心字段时自动刷新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_research_sections_update_time
AFTER UPDATE OF slug, title, subtitle, sort_order, enabled ON research_sections
FOR EACH ROW
BEGIN
    UPDATE research_sections SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_research_items_update_time
AFTER UPDATE OF section_id, title, body, sort_order, enabled ON research_items
FOR EACH ROW
BEGIN
    UPDATE research_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- 三个基础板块（INSERT OR IGNORE：slug 唯一，已存在则跳过，不影响已有标题）
INSERT OR IGNORE INTO research_sections (slug, title, subtitle, sort_order, enabled) VALUES
  ('question',    'Question',    'What I am trying to understand.',    30, 1),
  ('method',      'Method',      'How the paintings are made.',        20, 1),
  ('experiments', 'Experiments', 'Works in progress, stage by stage.', 10, 1);

-- ============================================================
-- 研究方向相关站点文案（增量补齐：已上线的库没有这些键，
-- 导航/页脚/页面文案会缺省为英文兜底，后台「站点文案」里也编辑不到）
-- INSERT OR IGNORE：已有库中若已手改过这些键，不会被覆盖。
-- ============================================================
INSERT OR IGNORE INTO site_content (key, value) VALUES
  ('nav.research',              'Research'),
  ('footer.links.research',     'Research'),
  ('home.nav.research.image',   ''),
  ('research.eyebrow',          'Ongoing inquiry'),
  ('research.title',            'Research'),
  ('research.subtitle',         'Questions, methods and experiments behind the paintings — written as they happen.'),
  ('research.unavailable',      'Research content could not be loaded.'),
  ('research.empty.title',      'Nothing published yet'),
  ('research.empty.subtitle',   'Research notes are being written and will appear here soon.'),
  ('research.section.noItems',  'This section is empty for now.');