-- ============================================================
-- Migration 007: 首页第二屏导航背景图
-- ============================================================
-- 使用 Artvee CDN 上的公共领域艺术图片作为默认背景。
-- 只填充缺失或空值，不覆盖后台已经设置过的图片。
--   npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/007_home_nav_images.sql
--   npx wrangler@latest d1 execute art-website-db --local  --file=./migrations/007_home_nav_images.sql
-- ============================================================

INSERT OR IGNORE INTO site_content (key, value) VALUES
    ('home.nav.home.image',    'https://mdl.artvee.com/assets/bgs/abstract.jpg'),
    ('home.nav.works.image',   'https://mdl.artvee.com/assets/bgs/landscape.jpg'),
    ('home.nav.about.image',   'https://mdl.artvee.com/assets/bgs/figurative.jpg'),
    ('home.nav.meetup.image',  'https://mdl.artvee.com/assets/bgs/posters.jpg'),
    ('home.nav.contact.image', 'https://mdl.artvee.com/assets/bgs/still-life.jpg');

UPDATE site_content SET value = 'https://mdl.artvee.com/assets/bgs/abstract.jpg',    updated_at = datetime('now') WHERE key = 'home.nav.home.image'    AND value = '';
UPDATE site_content SET value = 'https://mdl.artvee.com/assets/bgs/landscape.jpg',   updated_at = datetime('now') WHERE key = 'home.nav.works.image'   AND value = '';
UPDATE site_content SET value = 'https://mdl.artvee.com/assets/bgs/figurative.jpg',  updated_at = datetime('now') WHERE key = 'home.nav.about.image'   AND value = '';
UPDATE site_content SET value = 'https://mdl.artvee.com/assets/bgs/posters.jpg',     updated_at = datetime('now') WHERE key = 'home.nav.meetup.image'  AND value = '';
UPDATE site_content SET value = 'https://mdl.artvee.com/assets/bgs/still-life.jpg',  updated_at = datetime('now') WHERE key = 'home.nav.contact.image' AND value = '';
