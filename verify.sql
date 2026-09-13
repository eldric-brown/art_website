-- ============================================================
-- Art Website - 数据库校验脚本（只读）
-- ============================================================
-- 用法：
--   npx wrangler d1 execute art-website-db --local  --file=./verify.sql
--   npx wrangler d1 execute art-website-db --remote --file=./verify.sql
-- 说明：
--   只含 SELECT，不修改任何数据，可反复执行。
--   每条语句独立看结果；"检查通过"通常表现为空结果集，
--   只有标注 ✗ 的语句出现行才代表需要处理的问题。
-- ============================================================

-- 1) 对象清单：应能看到 6 张表、多个索引、3 个 updated_at 触发器
SELECT type, name
FROM sqlite_master
WHERE type IN ('table', 'index', 'trigger')
ORDER BY type, name;

-- 2) 各表行数
--    artist 必须 = 1（受 CHECK (id = 1) 约束）；categories 必须 >= 1
SELECT 'artworks'       AS table_name, COUNT(*) AS row_count FROM artworks
UNION ALL SELECT 'artist',       COUNT(*) FROM artist
UNION ALL SELECT 'categories',   COUNT(*) FROM categories
UNION ALL SELECT 'meetup_items', COUNT(*) FROM meetup_items
UNION ALL SELECT 'site_content', COUNT(*) FROM site_content
UNION ALL SELECT 'view_logs',    COUNT(*) FROM view_logs;

-- 3) 必备基线：艺术家档案（缺这一行前台 /api/artist 会 404）
SELECT id, name, name_en, socials FROM artist WHERE id = 1;

-- 4) 栏目基线（前台筛选与后台下拉都依赖它）
SELECT id, key, name, enabled, sort_order
FROM categories
ORDER BY sort_order DESC, id ASC;

-- 5) 首页精选：featured=1 且已上架的作品
--    为空时首页 Selected Works 区块和 hero 回退图会退化，属预期但需要知道
SELECT id, title, category, year, sold, price, sort_order
FROM artworks
WHERE published = 1 AND featured = 1
ORDER BY sort_order DESC, year DESC, id DESC;

-- 6) ✗ 图片字段损坏：images 必须是合法 JSON 数组且至少含 1 张图
SELECT id, title, images FROM artworks WHERE json_valid(images) = 0;
SELECT id, title, images
FROM artworks
WHERE json_valid(images) = 1 AND json_array_length(images) = 0;

-- 7) ✗ 孤立栏目：作品引用了 categories 表里不存在的 key
SELECT a.id, a.title, a.category
FROM artworks a
LEFT JOIN categories c ON c.key = a.category
WHERE c.id IS NULL;

-- 8) ✗ 字段越界 / 空值
SELECT id, title, year FROM artworks WHERE year < 1900 OR year > 2100;
SELECT id, title FROM artworks WHERE images IS NULL;
SELECT key FROM site_content WHERE value IS NULL;

-- 9) 前台可见栏目数（enabled = 1）
SELECT COUNT(*) AS enabled_categories FROM categories WHERE enabled = 1;

-- 10) 首页 / 线下交流页所需文案是否齐备
SELECT key, value FROM site_content
WHERE key IN (
    'nav.meetup', 'home.hero.title', 'home.hero.subtitle', 'home.hero.cta',
    'home.features.title', 'home.features.subtitle', 'home.features.viewAll',
    'home.entry.works.desc', 'home.entry.about.desc', 'home.entry.meetup.desc',
    'work.sold', 'work.price',
    'meetup.title', 'meetup.subtitle', 'meetup.empty'
)
ORDER BY key;
