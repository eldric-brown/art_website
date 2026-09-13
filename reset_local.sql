-- ============================================================
-- Art Website - 本地库重置（⚠️ 会删除数据，仅限本地开发库）
-- ============================================================
-- ⚠️  本文件会清空业务数据。千万不要对线上库执行。
--
-- 用法（两步：先清，再灌）：
--   npx wrangler d1 execute art-website-db --local --file=./reset_local.sql
--   npx wrangler d1 execute art-website-db --local --file=./schema.sql
--   npx wrangler d1 execute art-website-db --local --file=./verify.sql
--
-- 为什么分两步：
--   本文件只负责"清"，清完后 schema.sql 会用 INSERT OR IGNORE 把
--   艺术家基线档案、7 个栏目、全部站点文案重新写回。
--   两步合起来 = 一个干净且完整的初始库。
--
-- 只删数据、不动结构：表、索引、触发器都保留，所以不需要 DROP TABLE，
-- 也不需要重跑 migrations。
-- ============================================================

-- 业务数据（先清日志，再清主表；本库没有外键约束，顺序只是保险）
DELETE FROM view_logs;
DELETE FROM artworks;
DELETE FROM meetup_items;
DELETE FROM artist;
DELETE FROM site_content;
DELETE FROM categories;

-- AUTOINCREMENT 自增序号回 1，方便演示时得到 id = 1, 2, 3 ...
-- artist 表没有 AUTOINCREMENT，sqlite_sequence 里没有它，删不到也不报错。
DELETE FROM sqlite_sequence
WHERE name IN ('artworks', 'view_logs', 'meetup_items', 'categories');
