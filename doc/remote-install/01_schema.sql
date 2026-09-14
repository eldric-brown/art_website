DROP TABLE IF EXISTS artworks;

DROP TABLE IF EXISTS artist;

DROP TABLE IF EXISTS site_content;

DROP TABLE IF EXISTS categories;

DROP TABLE IF EXISTS meetup_items;

DROP TABLE IF EXISTS users;

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

-- 009 迁移：站点 Logo / favicon（Artvee 默认资源）
INSERT OR REPLACE INTO site_content (key, value) VALUES
  ('site.favicon',         'https://mdl.artvee.com/assets/icon-350x350.png'),
  ('site.logo_icon_light', 'https://mdl.artvee.com/assets/logow-4.svg'),
  ('site.logo_icon_dark',  'https://mdl.artvee.com/assets/icon-350x350.png');
