-- ============================================================
-- Art Website - 02_demo_data.sql  demo 数据导入脚本
-- ============================================================
-- 用途：在 01_schema.sql 建库后灌入演示数据：
--       7 件作品、7 个栏目、3 条线下活动、站点文案、艺术家档案、
--       admin 后台用户（PBKDF2 哈希，密码见 doc/PROJECT.md）。
--
--   npx wrangler d1 execute art-website-db --local  --file=./doc/sql/02_demo_data.sql
--   npx wrangler d1 execute art-website-db --remote --file=./doc/sql/02_demo_data.sql
--
-- ⚠️ 全部为占位演示数据（picsum.photos 随机配图），上线前请替换成真实资料。
-- ============================================================

-- ---------- 1. 作品（7 件，覆盖 7 个栏目） ----------
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(1,'Harbor at Dusk','Riverfront study painted over three autumn afternoons.','["https://picsum.photos/seed/art-oil-1/900/1200","https://picsum.photos/seed/art-oil-1b/900/1200"]','oil',2024,'Oil on canvas','80 x 100 cm',1,1,70,1,'USD 3,800',1246,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(2,'Riverside Notes','Loose watercolour pages from a walk along the Suzhou Creek.','["https://picsum.photos/seed/art-wc-1/900/1200"]','watercolor',2023,'Watercolour on paper','38 x 56 cm',1,0,60,0,'USD 950',623,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(3,'Urban Fragments','Graphite sheet from a series on street signage.','["https://picsum.photos/seed/art-sketch-1/900/1200","https://picsum.photos/seed/art-sketch-1b/900/1200","https://picsum.photos/seed/art-sketch-1c/900/1200"]','sketch',2025,'Graphite on paper','29.7 x 42 cm',1,1,50,0,'',410,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(4,'Empty Mountain','Ink landscape after a study of early twentieth century prints.','["https://picsum.photos/seed/art-ink-1/900/1200"]','ink',2022,'Ink on paper','45 x 68 cm',1,1,40,1,'Price on request',980,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(5,'Neon Field','Digital piece exploring saturated light at night.','["https://picsum.photos/seed/art-digital-1/1200/900"]','digital',2026,'Digital artwork','3840 x 2160 px',1,0,30,0,'USD 620',350,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(6,'Quiet Street','Archival photograph of an early morning lane.','["https://picsum.photos/seed/art-photo-1/1200/900","https://picsum.photos/seed/art-photo-1b/1200/900"]','photograph',2025,'Archival pigment print','50 x 75 cm',1,0,20,0,'USD 780',260,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(7,'Mixed Study','Small mixed media experiment, kept as a private study.','["https://picsum.photos/seed/art-other-1/900/900"]','other',2024,'Mixed media','30 x 30 cm',0,0,10,0,'',140,'2026-09-14 01:17:54','2026-09-14 01:17:54');

-- ---------- 2. 栏目（7 个，全部启用） ----------
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(1,'oil','Oil Painting','',70,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(2,'watercolor','Watercolor','',60,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(3,'sketch','Sketch','',50,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(4,'ink','Chinese Painting','',40,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(5,'digital','Digital','',30,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(6,'photograph','Photograph','',20,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(7,'other','Other','',10,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');

-- ---------- 3. 线下活动（3 条） ----------
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(1,'Spring Salon — New Works','May 2026','Shanghai · Xintiandi','https://picsum.photos/seed/meetup-1/1200/800',30,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(2,'Studio Visit: Tang Yibai','June 2026','Shanghai · M50','https://picsum.photos/seed/meetup-2/1200/800',20,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(3,'Group Exhibition Opening','March 2026','Beijing · 798 Art District','https://picsum.photos/seed/meetup-3/1200/800',10,'2026-09-14 01:17:54','2026-09-14 01:17:54');

-- ---------- 4. 艺术家档案（单行 id = 1） ----------
INSERT INTO "artist" ("id","name","name_en","bio","bio_short","avatar","signature","socials","contact_email","contact_wechat","updated_at") VALUES(1,'汤一白','Tang Yibai','Tang Yibai lives and works in Shanghai. Her practice moves between oil, ink and digital media, looking at how everyday urban scenes keep and lose meaning.','Shanghai-based painter working across oil, ink and digital media.','https://picsum.photos/seed/artist-portrait/600/600','','{"instagram":"https://instagram.com/tangyibai","website":"https://tangyibai.art"}','studio@tangyibai.art','tangyibai_studio','2026-09-14 01:30:56');

-- ---------- 5. 后台用户（admin，PBKDF2-SHA256，100000 迭代） ----------
-- 密码：art-d8ca469c21de651fdc97（上线前务必在后台「账号安全」改密）
INSERT INTO "users" ("id","username","password_hash","password_salt","password_iterations","password_algo","created_at","updated_at") VALUES(1,'admin','lgT7N58-y6l95fC5wVDdyJzdaSeBAr24qwTahy3sXD0','bPN1AEEs0nZHgpeotAczcw',100000,'PBKDF2-SHA256','2026-09-14 01:51:07','2026-09-14 02:33:59');

-- ---------- 6. 站点文案（site_content） ----------
INSERT INTO "site_content" ("key","value","updated_at") VALUES
('nav.home','Home','2026-09-14 01:17:46'),
('nav.works','Works','2026-09-14 01:17:46'),
('nav.about','About','2026-09-14 01:17:46'),
('nav.contact','Contact','2026-09-14 01:17:46'),
('nav.meetup','Meet Up','2026-09-14 01:17:46'),
('site.title','Tang Yibai · Portfolio','2026-09-14 01:17:46'),
('site.description','Tang Yibai · Personal Art Portfolio · Painting & Visual Arts','2026-09-14 01:17:46'),
('site.og_description','Painting and visual art showcase','2026-09-14 01:17:46'),
('site.logo','Tang Yibai','2026-09-14 01:17:46'),
('hero.title','Tang Yibai','2026-09-14 01:17:46'),
('hero.eyebrow','Tang Yibai · Art Portfolio','2026-09-14 01:17:46'),
('hero.subtitle','Painting as the confession of the soul — stories told through color and line.','2026-09-14 01:17:46'),
('hero.cta.primary','Browse Works','2026-09-14 01:17:46'),
('hero.cta.secondary','Meet the Artist','2026-09-14 01:17:46'),
('home.hero.image','https://mdl.artvee.com/assets/tmbg.jpg','2026-09-14 02:26:26'),
('home.hero.eyebrow','Discover the best in','2026-09-14 02:26:26'),
('home.hero.title','Classical & Modern Art','2026-09-14 02:26:26'),
('home.hero.subtitle','Browse and download high-resolution, public domain paintings, posters and illustrations','2026-09-14 02:26:26'),
('home.hero.cta','','2026-09-14 02:26:26'),
('home.nav.home.image','https://mdl.artvee.com/assets/bgs/abstract.jpg','2026-09-14 02:26:27'),
('home.nav.works.image','https://mdl.artvee.com/assets/bgs/landscape.jpg','2026-09-14 02:26:27'),
('home.nav.about.image','https://mdl.artvee.com/assets/bgs/figurative.jpg','2026-09-14 02:26:27'),
('home.nav.meetup.image','https://mdl.artvee.com/assets/bgs/posters.jpg','2026-09-14 02:26:27'),
('home.nav.contact.image','https://mdl.artvee.com/assets/bgs/still-life.jpg','2026-09-14 02:26:27'),
('home.cards.title','Dive into the Collection','2026-09-14 02:26:26'),
('home.cards.subtitle','A closer look at selected works and themes.','2026-09-14 02:26:26'),
('home.cards.count','3','2026-09-14 02:26:26'),
('home.card.1.title','Harbor at Dusk','2026-09-14 02:26:27'),
('home.card.1.text','Oil on canvas · 80 x 100 cm','2026-09-14 02:26:27'),
('home.card.1.image','https://picsum.photos/seed/art-oil-1/900/1200','2026-09-14 02:26:27'),
('home.card.1.link','#/works/1','2026-09-14 02:26:27'),
('home.card.2.title','Riverside Notes','2026-09-14 02:26:27'),
('home.card.2.text','Watercolour on paper · 38 x 56 cm','2026-09-14 02:26:27'),
('home.card.2.image','https://picsum.photos/seed/art-wc-1/900/1200','2026-09-14 02:26:27'),
('home.card.2.link','#/works/2','2026-09-14 02:26:27'),
('home.card.3.title','Urban Fragments','2026-09-14 02:26:27'),
('home.card.3.text','Graphite on paper · 29.7 x 42 cm','2026-09-14 02:26:27'),
('home.card.3.image','https://picsum.photos/seed/art-sketch-1/900/1200','2026-09-14 02:26:27'),
('home.card.3.link','#/works/3','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES
('works.title','Works','2026-09-14 01:17:46'),
('works.subtitle','Filter by category, sorted by year.','2026-09-14 01:17:46'),
('works.empty.title','No Works Yet','2026-09-14 01:17:46'),
('works.empty.subtitle','Tang Yibai has not published any works yet.','2026-09-14 01:17:46'),
('category.all','All','2026-09-14 01:17:46'),
('category.oil','Oil Painting','2026-09-14 01:17:46'),
('category.watercolor','Watercolor','2026-09-14 01:17:46'),
('category.sketch','Sketch','2026-09-14 01:17:46'),
('category.ink','Chinese Painting','2026-09-14 01:17:46'),
('category.digital','Digital','2026-09-14 01:17:46'),
('category.photograph','Photograph','2026-09-14 01:17:46'),
('category.other','Other','2026-09-14 01:17:46'),
('detail.back','← Back to Works','2026-09-14 01:17:46'),
('detail.backBottom','← All Works','2026-09-14 01:17:46'),
('detail.meta.category','Category','2026-09-14 01:17:46'),
('detail.meta.year','Year','2026-09-14 01:17:46'),
('detail.meta.medium','Medium','2026-09-14 01:17:46'),
('detail.meta.dimensions','Dimensions','2026-09-14 01:17:46'),
('detail.meta.published','Published','2026-09-14 01:17:46'),
('detail.notFound.title','Artwork Not Found','2026-09-14 01:17:46'),
('detail.notFound.subtitle','It may have been unpublished or the link is invalid.','2026-09-14 01:17:46'),
('detail.noImages','This artwork has no images.','2026-09-14 01:17:46'),
('work.sold','Sold','2026-09-14 01:17:46'),
('work.price','Price','2026-09-14 01:17:46'),
('about.unavailable','Artist information unavailable','2026-09-14 01:17:46'),
('contact.title','Contact','2026-09-14 01:17:46'),
('contact.subtitle','Commissions, exhibitions, press inquiries — welcome.','2026-09-14 01:17:46'),
('contact.email.label','Email','2026-09-14 01:17:46'),
('contact.wechat.label','WeChat','2026-09-14 01:17:46'),
('contact.note','Note','2026-09-14 01:17:46'),
('contact.empty','Contact details not yet provided.','2026-09-14 01:17:46'),
('footer.brand','Tang Yibai · Art Portfolio','2026-09-14 01:17:46'),
('footer.links.works','All Works','2026-09-14 01:17:46'),
('footer.links.about','About','2026-09-14 01:17:46'),
('footer.links.contact','Contact','2026-09-14 01:17:46'),
('footer.links.admin','Admin','2026-09-14 01:17:46'),
('footer.links.meetup','Meet Up','2026-09-14 01:17:46'),
('footer.copyright','© {year} All Rights Reserved','2026-09-14 01:17:46'),
('meetup.title','Meet Up','2026-09-14 01:17:46'),
('meetup.subtitle','Exhibitions, studio visits and in-person exchange.','2026-09-14 01:17:46'),
('meetup.intro','','2026-09-14 01:17:46'),
('meetup.item.date','Date','2026-09-14 01:17:46'),
('meetup.item.location','Location','2026-09-14 01:17:46'),
('meetup.empty','No meetups have been announced yet.','2026-09-14 01:17:46'),
('common.loading','Loading...','2026-09-14 01:17:46'),
('common.thumbnail','Thumbnail','2026-09-14 01:17:46'),
('common.notFound.title','Page Not Found','2026-09-14 01:17:46'),
('common.notFound.subtitle','The page you are looking for does not exist.','2026-09-14 01:17:46'),
('common.backHome','Back to Home','2026-09-14 01:17:46');