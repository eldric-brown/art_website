-- ============================================================
-- Art Website - 演示数据（可选，仅本地开发 / 演示用）
-- ============================================================
-- 用途：给前台填上可看的内容 —— 艺术家档案、7 件作品、3 条线下活动。
-- 何时跑：必须先跑 schema.sql 建好结构和基线数据。
--   npx wrangler d1 execute art-website-db --local --file=./schema.sql
--   npx wrangler d1 execute art-website-db --local --file=./seed_demo.sql
--
-- ⚠️  全部是占位演示数据（picsum.photos 随机配图），不是真实作品，
--    上线前请删除或替换成真实资料。
--
-- 幂等性：可反复执行。
--   artist 用 UPDATE（重复执行结果一致）；
--   artworks / meetup_items 没有唯一键，用 WHERE NOT EXISTS 按标题判重，
--   已存在的行既不会被覆盖也不会重复插入。
--   想重灌演示数据：先跑 reset_local.sql + schema.sql，再跑本文件。
-- ============================================================

-- ---------- 1. 艺术家档案（覆盖 schema.sql 里的空基线） ----------
UPDATE artist SET
    name_en        = 'Tang Yibai',
    bio_short      = 'Shanghai-based painter working across oil, ink and digital media.',
    bio            = 'Tang Yibai lives and works in Shanghai. Her practice moves between oil, ink and digital media, looking at how everyday urban scenes keep and lose meaning.',
    avatar         = 'https://picsum.photos/seed/artist-portrait/600/600',
    contact_email  = 'studio@tangyibai.art',
    contact_wechat = 'tangyibai_studio',
    socials        = '{"instagram":"https://instagram.com/tangyibai","website":"https://tangyibai.art"}',
    updated_at     = datetime('now')
WHERE id = 1;

-- ---------- 2. 作品（7 件，覆盖全部 7 个栏目） ----------
-- published=1 才会出现在前台；featured=1 进首页 Selected Works；
-- sold=1 打 Sold 标签；price 留空则前台不显示价格。

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Harbor at Dusk', 'Riverfront study painted over three autumn afternoons.', '["https://picsum.photos/seed/art-oil-1/900/1200","https://picsum.photos/seed/art-oil-1b/900/1200"]', 'oil', 2024, 'Oil on canvas', '80 x 100 cm', 1, 1, 70, 1, 'USD 3,800', 1240
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Harbor at Dusk');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Riverside Notes', 'Loose watercolour pages from a walk along the Suzhou Creek.', '["https://picsum.photos/seed/art-wc-1/900/1200"]', 'watercolor', 2023, 'Watercolour on paper', '38 x 56 cm', 1, 0, 60, 0, 'USD 950', 620
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Riverside Notes');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Urban Fragments', 'Graphite sheet from a series on street signage.', '["https://picsum.photos/seed/art-sketch-1/900/1200","https://picsum.photos/seed/art-sketch-1b/900/1200","https://picsum.photos/seed/art-sketch-1c/900/1200"]', 'sketch', 2025, 'Graphite on paper', '29.7 x 42 cm', 1, 1, 50, 0, '', 410
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Urban Fragments');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Empty Mountain', 'Ink landscape after a study of early twentieth century prints.', '["https://picsum.photos/seed/art-ink-1/900/1200"]', 'ink', 2022, 'Ink on paper', '45 x 68 cm', 1, 1, 40, 1, 'Price on request', 980
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Empty Mountain');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Neon Field', 'Digital piece exploring saturated light at night.', '["https://picsum.photos/seed/art-digital-1/1200/900"]', 'digital', 2026, 'Digital artwork', '3840 x 2160 px', 1, 0, 30, 0, 'USD 620', 350
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Neon Field');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Quiet Street', 'Archival photograph of an early morning lane.', '["https://picsum.photos/seed/art-photo-1/1200/900","https://picsum.photos/seed/art-photo-1b/1200/900"]', 'photograph', 2025, 'Archival pigment print', '50 x 75 cm', 1, 0, 20, 0, 'USD 780', 260
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Quiet Street');

INSERT INTO artworks (title, description, images, category, year, medium, dimensions, published, featured, sort_order, sold, price, views)
SELECT 'Mixed Study', 'Small mixed media experiment, kept as a private study.', '["https://picsum.photos/seed/art-other-1/900/900"]', 'other', 2024, 'Mixed media', '30 x 30 cm', 0, 0, 10, 0, '', 140
WHERE NOT EXISTS (SELECT 1 FROM artworks WHERE title = 'Mixed Study');

-- ---------- 3. 线下交流（3 条） ----------
INSERT INTO meetup_items (title, date_text, location, image, sort_order)
SELECT 'Spring Salon — New Works', 'May 2026', 'Shanghai · Xintiandi', 'https://picsum.photos/seed/meetup-1/1200/800', 30
WHERE NOT EXISTS (SELECT 1 FROM meetup_items WHERE title = 'Spring Salon — New Works');

INSERT INTO meetup_items (title, date_text, location, image, sort_order)
SELECT 'Studio Visit: Tang Yibai', 'June 2026', 'Shanghai · M50', 'https://picsum.photos/seed/meetup-2/1200/800', 20
WHERE NOT EXISTS (SELECT 1 FROM meetup_items WHERE title = 'Studio Visit: Tang Yibai');

INSERT INTO meetup_items (title, date_text, location, image, sort_order)
SELECT 'Group Exhibition Opening', 'March 2026', 'Beijing · 798 Art District', 'https://picsum.photos/seed/meetup-3/1200/800', 10
WHERE NOT EXISTS (SELECT 1 FROM meetup_items WHERE title = 'Group Exhibition Opening');

-- ---------- 4. 首页内容卡（可选演示；正式上线请到后台「首页展示」里替换） ----------
-- 用 UPSERT：schema.sql 里的基线默认值是 count=0（空卡），这里覆盖为 3 张演示卡。
INSERT INTO site_content (key, value, updated_at) VALUES
('home.cards.title',    'Dive into the Collection',        datetime('now')),
('home.cards.subtitle', 'A closer look at selected works and themes.', datetime('now')),
('home.cards.count',    '3',                              datetime('now')),
('home.card.1.title',   'Selected Works',                 datetime('now')),
('home.card.1.text',    'A curated look at recent paintings.', datetime('now')),
('home.card.1.image',   'https://picsum.photos/seed/card-works/800/1000', datetime('now')),
('home.card.1.link',    '#/works',                        datetime('now')),
('home.card.2.title',   'Studio Notes',                   datetime('now')),
('home.card.2.text',    'Sketches and process behind the finished pieces.', datetime('now')),
('home.card.2.image',   'https://picsum.photos/seed/card-notes/800/1000', datetime('now')),
('home.card.2.link',    '#/about',                        datetime('now')),
('home.card.3.title',   'Meet Up',                        datetime('now')),
('home.card.3.text',    'Exhibitions, studio visits and in-person exchange.', datetime('now')),
('home.card.3.image',   'https://picsum.photos/seed/card-meetup/800/1000', datetime('now')),
('home.card.3.link',    '#/meetup',                       datetime('now')),
('home.entry.contact.desc', 'Commissions and press inquiries are welcome.', datetime('now'))
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
