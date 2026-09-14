-- ============================================================
-- Migration 008: Artvee 首页第一屏横图
-- ============================================================
-- 使用 Artvee 首页横图资源作为默认 Hero 图片。
-- 仅填充缺失或空值，不覆盖后台已经设置过的横图。
--   npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/008_hero_image.sql
--   npx wrangler@latest d1 execute art-website-db --local  --file=./migrations/008_hero_image.sql
-- ============================================================

INSERT OR IGNORE INTO site_content (key, value)
VALUES ('home.hero.image', 'https://mdl.artvee.com/assets/tmbg.jpg');

UPDATE site_content
SET value = 'https://mdl.artvee.com/assets/tmbg.jpg',
    updated_at = datetime('now')
WHERE key = 'home.hero.image' AND value = '';
