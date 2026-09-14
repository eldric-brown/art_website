-- ============================================================
-- Migration 003: 补上艺术家基线档案
-- ============================================================
-- 背景：artist 表受 CHECK (id = 1) 约束，必须有且仅有一行 id = 1 的记录，
--       但 schema.sql 和 001/002 迁移里从来没有插入过它。缺这一行会导致：
--         1. GET /api/artist 返回 404（artist_not_found），首页/关于页拿不到资料；
--         2. PUT /api/admin/artist 执行 UPDATE ... WHERE id = 1 匹配不到任何行，
--            后台保存艺术家信息会"看起来成功但没生效"（静默无操作）。
--
-- 何时跑：
--   老库（已跑过 schema.sql + 001 + 002）：
--     npx wrangler d1 execute art-website-db --remote --file=./migrations/003_artist_baseline.sql
--   新建空库：不需要跑，schema.sql 里已经带了这条。
--
-- 幂等性：INSERT OR IGNORE + PRIMARY KEY (id)，可反复执行，
--         也不会覆盖后台已经填好的真实资料。
-- ============================================================

INSERT OR IGNORE INTO artist (id, name, name_en)
VALUES (1, 'Tang Yibai', 'Tang Yibai');

-- 校验：应恰好返回 1 行
SELECT id, name, name_en, socials, contact_email FROM artist WHERE id = 1;
