-- ============================================================
-- Migration 006: 首页横图 Artvee 风格默认文案
-- ============================================================
-- 仅补齐缺失或仍为空的字段，不覆盖后台已经自定义过的文案。
--   npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/006_hero_copy.sql
--   npx wrangler@latest d1 execute art-website-db --local  --file=./migrations/006_hero_copy.sql
-- ============================================================

INSERT OR IGNORE INTO site_content (key, value) VALUES
    ('home.hero.eyebrow', 'Discover the best in'),
    ('home.hero.title', 'Classical & Modern Art'),
    ('home.hero.subtitle', 'Browse and download high-resolution, public domain paintings, posters and illustrations');

UPDATE site_content
SET value = 'Discover the best in', updated_at = datetime('now')
WHERE key = 'home.hero.eyebrow' AND value = '';

UPDATE site_content
SET value = 'Classical & Modern Art', updated_at = datetime('now')
WHERE key = 'home.hero.title' AND value = '';

UPDATE site_content
SET value = 'Browse and download high-resolution, public domain paintings, posters and illustrations',
    updated_at = datetime('now')
WHERE key = 'home.hero.subtitle' AND value = '';

UPDATE site_content
SET value = '', updated_at = datetime('now')
WHERE key = 'home.hero.cta' AND value = 'View the Collection';
