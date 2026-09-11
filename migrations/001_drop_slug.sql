-- ============================================================
-- Migration 001: 删除 artworks.slug 字段
-- ============================================================
-- 用途：从"URL 用 slug 字符串"切换到"URL 用自增 id"
-- 何时跑：在 schema.sql 已建过 artworks 表的数据库上一次性执行
--   wrangler d1 execute art-website-db --remote --file=./migrations/001_drop_slug.sql
-- 说明：
--   1. id 已经是 INTEGER PRIMARY KEY AUTOINCREMENT，无需迁移
--   2. 已有 slug 值不会保留，外链的旧 URL 会失效（可接受，属于产品决策）
--   3. Cloudflare D1 的 SQLite >= 3.35 支持 DROP COLUMN
-- ============================================================

-- 步骤 1：先删索引（DROP COLUMN 前必须清理引用）
DROP INDEX IF EXISTS idx_artworks_slug;

-- 步骤 2：删除依赖 slug 的触发器（旧触发器 AFTER UPDATE OF 里有 slug，重建时去掉）
DROP TRIGGER IF EXISTS trg_artworks_update_time;

-- 步骤 3：删除 slug 列
ALTER TABLE artworks DROP COLUMN slug;

-- 步骤 4：重建触发器（不再监听 slug）
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
                dimensions, published, featured, sort_order ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;
