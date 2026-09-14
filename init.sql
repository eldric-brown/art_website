-- ============================================================
-- Art Website - Complete D1 Initialization
-- ============================================================
-- 用途：一次性初始化或彻底重置 Cloudflare D1。
-- 包含：完整表结构、触发器、demo 作品、艺术家资料、站点配置、
--       首页 Artvee 图片配置，以及 users 表中的 admin 哈希密码。
--
-- 登录名：admin
-- 密码：使用当前项目约定的后台密码；脚本中只保存 PBKDF2 哈希，不保存明文。
--
-- 注意：本脚本会 DROP 并重建业务表，只应在新建或需要重置的数据库执行。
--
-- 执行：
--   npx wrangler@latest d1 execute art-website-db --remote --file=./init.sql
-- ============================================================

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS view_logs;
DROP TABLE IF EXISTS artworks;
DROP TABLE IF EXISTS artist;
DROP TABLE IF EXISTS site_content;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS meetup_items;
DROP TABLE IF EXISTS users;

PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE artworks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,                    
    description TEXT    DEFAULT '',                  
    images      TEXT    NOT NULL,                    
    category    TEXT    NOT NULL DEFAULT 'other',    
    year        INTEGER NOT NULL,                    
    medium      TEXT    DEFAULT '',                  
    dimensions  TEXT    DEFAULT '',                  
    published   INTEGER NOT NULL DEFAULT 0,          
    featured    INTEGER NOT NULL DEFAULT 0,          
    sort_order  INTEGER NOT NULL DEFAULT 0,          
    sold        INTEGER NOT NULL DEFAULT 0,          
    price       TEXT    NOT NULL DEFAULT '',         
    views       INTEGER NOT NULL DEFAULT 0,          
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(1,'Harbor at Dusk','Riverfront study painted over three autumn afternoons.','["https://picsum.photos/seed/art-oil-1/900/1200","https://picsum.photos/seed/art-oil-1b/900/1200"]','oil',2024,'Oil on canvas','80 x 100 cm',1,1,70,1,'USD 3,800',1246,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(2,'Riverside Notes','Loose watercolour pages from a walk along the Suzhou Creek.','["https://picsum.photos/seed/art-wc-1/900/1200"]','watercolor',2023,'Watercolour on paper','38 x 56 cm',1,0,60,0,'USD 950',623,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(3,'Urban Fragments','Graphite sheet from a series on street signage.','["https://picsum.photos/seed/art-sketch-1/900/1200","https://picsum.photos/seed/art-sketch-1b/900/1200","https://picsum.photos/seed/art-sketch-1c/900/1200"]','sketch',2025,'Graphite on paper','29.7 x 42 cm',1,1,50,0,'',410,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(4,'Empty Mountain','Ink landscape after a study of early twentieth century prints.','["https://picsum.photos/seed/art-ink-1/900/1200"]','ink',2022,'Ink on paper','45 x 68 cm',1,1,40,1,'Price on request',980,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(5,'Neon Field','Digital piece exploring saturated light at night.','["https://picsum.photos/seed/art-digital-1/1200/900"]','digital',2026,'Digital artwork','3840 x 2160 px',1,0,30,0,'USD 620',350,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(6,'Quiet Street','Archival photograph of an early morning lane.','["https://picsum.photos/seed/art-photo-1/1200/900","https://picsum.photos/seed/art-photo-1b/1200/900"]','photograph',2025,'Archival pigment print','50 x 75 cm',1,0,20,0,'USD 780',260,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "artworks" ("id","title","description","images","category","year","medium","dimensions","published","featured","sort_order","sold","price","views","created_at","updated_at") VALUES(7,'Mixed Study','Small mixed media experiment, kept as a private study.','["https://picsum.photos/seed/art-other-1/900/900"]','other',2024,'Mixed media','30 x 30 cm',0,0,10,0,'',140,'2026-09-14 01:17:54','2026-09-14 01:17:54');
CREATE TABLE artist (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    name       TEXT    NOT NULL,
    name_en    TEXT    DEFAULT '',
    bio        TEXT    DEFAULT '',                   
    bio_short  TEXT    DEFAULT '',                   
    avatar     TEXT    DEFAULT '',
    signature  TEXT    DEFAULT '',                   
    socials    TEXT    DEFAULT '{}',                 
    contact_email TEXT DEFAULT '',
    contact_wechat TEXT DEFAULT '',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "artist" ("id","name","name_en","bio","bio_short","avatar","signature","socials","contact_email","contact_wechat","updated_at") VALUES(1,'汤一白','Tang Yibai','Tang Yibai lives and works in Shanghai. Her practice moves between oil, ink and digital media, looking at how everyday urban scenes keep and lose meaning.','Shanghai-based painter working across oil, ink and digital media.','https://picsum.photos/seed/artist-portrait/600/600','','{"instagram":"https://instagram.com/tangyibai","website":"https://tangyibai.art"}','studio@tangyibai.art','tangyibai_studio','2026-09-14 01:30:56');
CREATE TABLE view_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    artwork_id INTEGER NOT NULL,
    ip_hash    TEXT    DEFAULT '',
    user_agent TEXT    DEFAULT '',
    viewed_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE site_content (
    key        TEXT    PRIMARY KEY,              
    value      TEXT    NOT NULL DEFAULT '',      
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "site_content" ("key","value","updated_at") VALUES('nav.home','Home','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('nav.works','Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('nav.about','About','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('nav.contact','Contact','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('nav.meetup','Meet Up','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('site.title','Tang Yibai · Portfolio','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('site.description','Tang Yibai · Personal Art Portfolio · Painting & Visual Arts','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('site.og_description','Painting and visual art showcase','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('site.logo','Tang Yibai','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('hero.title','Tang Yibai','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('hero.eyebrow','Tang Yibai · Art Portfolio','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('hero.subtitle','Painting as the confession of the soul — stories told through color and line.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('hero.cta.primary','Browse Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('hero.cta.secondary','Meet the Artist','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.hero.image','https://mdl.artvee.com/assets/tmbg.jpg','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.hero.title','Classical & Modern Art','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.hero.subtitle','Browse and download high-resolution, public domain paintings, posters and illustrations','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.hero.cta','','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('works.title','Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('works.subtitle','Filter by category, sorted by year.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('works.empty.title','No Works Yet','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('works.empty.subtitle','Tang Yibai has not published any works yet.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.all','All','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.oil','Oil Painting','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.watercolor','Watercolor','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.sketch','Sketch','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.ink','Chinese Painting','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.digital','Digital','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.photograph','Photograph','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('category.other','Other','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.back','← Back to Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.backBottom','← All Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.meta.category','Category','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.meta.year','Year','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.meta.medium','Medium','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.meta.dimensions','Dimensions','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.meta.published','Published','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.notFound.title','Artwork Not Found','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.notFound.subtitle','It may have been unpublished or the link is invalid.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('detail.noImages','This artwork has no images.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('work.sold','Sold','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('work.price','Price','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('about.unavailable','Artist information unavailable','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.title','Contact','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.subtitle','Commissions, exhibitions, press inquiries — welcome.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.email.label','Email','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.wechat.label','WeChat','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.note','Note','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('contact.empty','Contact details not yet provided.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.brand','Tang Yibai · Art Portfolio','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.links.works','All Works','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.links.about','About','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.links.contact','Contact','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.links.admin','Admin','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.links.meetup','Meet Up','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('footer.copyright','© {year} All Rights Reserved','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.title','Meet Up','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.subtitle','Exhibitions, studio visits and in-person exchange.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.intro','','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.item.date','Date','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.item.location','Location','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('meetup.empty','No meetups have been announced yet.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('common.loading','Loading...','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('common.thumbnail','Thumbnail','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('common.notFound.title','Page Not Found','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('common.notFound.subtitle','The page you are looking for does not exist.','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.cards.title','Dive into the Collection','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.cards.subtitle','A closer look at selected works and themes.','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.cards.count','3','2026-09-14 02:26:26');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.1.title','Harbor at Dusk','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.1.text','Oil on canvas · 80 x 100 cm','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.1.image','https://picsum.photos/seed/art-oil-1/900/1200','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.1.link','#/works/1','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.2.title','Riverside Notes','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.2.text','Watercolour on paper · 38 x 56 cm','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.2.image','https://picsum.photos/seed/art-wc-1/900/1200','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.2.link','#/works/2','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.3.title','Urban Fragments','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.3.text','Graphite on paper · 29.7 x 42 cm','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.3.image','https://picsum.photos/seed/art-sketch-1/900/1200','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.3.link','#/works/3','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.4.title','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.4.text','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.4.image','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.4.link','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('common.backHome','Back to Home','2026-09-14 01:17:46');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.nav.home.image','https://mdl.artvee.com/assets/bgs/abstract.jpg','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.nav.works.image','https://mdl.artvee.com/assets/bgs/landscape.jpg','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.nav.about.image','https://mdl.artvee.com/assets/bgs/figurative.jpg','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.nav.meetup.image','https://mdl.artvee.com/assets/bgs/posters.jpg','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.nav.contact.image','https://mdl.artvee.com/assets/bgs/still-life.jpg','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.5.title','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.5.text','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.5.image','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.5.link','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.6.title','','2026-09-14 02:26:27');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.6.text','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.6.image','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.6.link','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.7.title','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.7.text','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.7.image','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.7.link','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.8.title','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.8.text','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.8.image','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.card.8.link','','2026-09-14 02:26:28');
INSERT INTO "site_content" ("key","value","updated_at") VALUES('home.hero.eyebrow','Discover the best in','2026-09-14 02:26:26');
CREATE TABLE categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT    NOT NULL UNIQUE,           
    name       TEXT    NOT NULL,                  
    image      TEXT    NOT NULL DEFAULT '',       
    sort_order INTEGER NOT NULL DEFAULT 0,        
    enabled    INTEGER NOT NULL DEFAULT 1,        
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(1,'oil','Oil Painting','',70,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(2,'watercolor','Watercolor','',60,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(3,'sketch','Sketch','',50,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(4,'ink','Chinese Painting','',40,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(5,'digital','Digital','',30,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(6,'photograph','Photograph','',20,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
INSERT INTO "categories" ("id","key","name","image","sort_order","enabled","created_at","updated_at") VALUES(7,'other','Other','',10,1,'2026-09-14 01:17:46','2026-09-14 01:17:46');
CREATE TABLE meetup_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,                  
    date_text  TEXT    NOT NULL DEFAULT '',       
    location   TEXT    NOT NULL DEFAULT '',       
    image      TEXT    NOT NULL DEFAULT '',       
    sort_order INTEGER NOT NULL DEFAULT 0,        
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(1,'Spring Salon — New Works','May 2026','Shanghai · Xintiandi','https://picsum.photos/seed/meetup-1/1200/800',30,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(2,'Studio Visit: Tang Yibai','June 2026','Shanghai · M50','https://picsum.photos/seed/meetup-2/1200/800',20,'2026-09-14 01:17:54','2026-09-14 01:17:54');
INSERT INTO "meetup_items" ("id","title","date_text","location","image","sort_order","created_at","updated_at") VALUES(3,'Group Exhibition Opening','March 2026','Beijing · 798 Art District','https://picsum.photos/seed/meetup-3/1200/800',10,'2026-09-14 01:17:54','2026-09-14 01:17:54');
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT    NOT NULL,
    password_salt       TEXT    NOT NULL,
    password_iterations INTEGER NOT NULL DEFAULT 210000,
    password_algo       TEXT    NOT NULL DEFAULT 'PBKDF2-SHA256',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "users" ("id","username","password_hash","password_salt","password_iterations","password_algo","created_at","updated_at") VALUES(1,'admin','lgT7N58-y6l95fC5wVDdyJzdaSeBAr24qwTahy3sXD0','bPN1AEEs0nZHgpeotAczcw',210000,'PBKDF2-SHA256','2026-09-14 01:51:07','2026-09-14 02:33:59');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('categories',35);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('artworks',7);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('meetup_items',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',1);
CREATE INDEX idx_artworks_published ON artworks(published, sort_order DESC);
CREATE INDEX idx_artworks_category  ON artworks(published, category, sort_order DESC);
CREATE INDEX idx_artworks_featured  ON artworks(featured, sort_order DESC);
CREATE INDEX idx_view_logs_artwork ON view_logs(artwork_id, viewed_at);
CREATE INDEX idx_categories_order ON categories(enabled, sort_order DESC);
CREATE INDEX idx_meetup_items_order ON meetup_items(sort_order DESC);
CREATE TRIGGER trg_artworks_update_time
AFTER UPDATE OF title, description, images, category, year, medium,
                dimensions, published, featured, sort_order, sold, price ON artworks
FOR EACH ROW
BEGIN
    UPDATE artworks SET updated_at = datetime('now')
    WHERE id = OLD.id;
END;
CREATE TRIGGER trg_categories_update_time
AFTER UPDATE OF key, name, image, sort_order, enabled ON categories
FOR EACH ROW
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = OLD.id;
END;
CREATE TRIGGER trg_meetup_items_update_time
AFTER UPDATE OF title, date_text, location, image, sort_order ON meetup_items
FOR EACH ROW
BEGIN
    UPDATE meetup_items SET updated_at = datetime('now') WHERE id = OLD.id;
END;
CREATE TRIGGER trg_users_update_time
AFTER UPDATE OF username, password_hash, password_salt, password_iterations, password_algo ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;
PRAGMA foreign_keys=ON;
COMMIT;

-- 009 迁移：站点 Logo / favicon（Artvee 默认资源）
INSERT OR REPLACE INTO site_content (key, value) VALUES
  ('site.favicon',         'https://mdl.artvee.com/assets/icon-350x350.png'),
  ('site.logo_icon_light', 'https://mdl.artvee.com/assets/logow-4.svg'),
  ('site.logo_icon_dark',  'https://mdl.artvee.com/assets/icon-350x350.png');
