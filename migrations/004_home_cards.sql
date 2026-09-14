-- ============================================================
-- Migration 004: 首页内容卡（「Dive into …」区）默认文案键
-- ============================================================
-- 用途：给首页第二屏（内容卡）补齐 site_content 默认键。
-- 何时跑：老库（已跑过 schema.sql + 001/002/003）执行一次：
--   npx wrangler d1 execute art-website-db --remote --file=./migrations/004_home_cards.sql
-- 新建空库：schema.sql 已包含，无需再跑本文件。
-- 幂等性：INSERT OR IGNORE + PRIMARY KEY，可反复执行，不覆盖后台已改值。
-- ============================================================

INSERT OR IGNORE INTO site_content (key, value) VALUES

-- 内容卡区块标题与数量
('home.cards.title',    'Dive into the Collection'),
('home.cards.subtitle', 'A closer look at selected works and themes.'),
('home.cards.count',    '0'),

-- 内容卡 1-4（title/text 留空或 image 留空的卡前台不显示）
('home.card.1.title',  ''),
('home.card.1.text',   ''),
('home.card.1.image',  ''),
('home.card.1.link',   '#/works'),
('home.card.2.title',  ''),
('home.card.2.text',   ''),
('home.card.2.image',  ''),
('home.card.2.link',   '#/meetup'),
('home.card.3.title',  ''),
('home.card.3.text',   ''),
('home.card.3.image',  ''),
('home.card.3.link',   ''),
('home.card.4.title',  ''),
('home.card.4.text',   ''),
('home.card.4.image',  ''),
('home.card.4.link',   ''),

-- 首页入口区（联系我们）描述
('home.entry.contact.desc', 'Commissions and press inquiries are welcome.');
