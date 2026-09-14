-- ============================================================
-- reset_users.sql - 重建 users 表，admin 密码为空（首次登录后强制改密）
-- ============================================================
-- 登录名：admin
-- 密码：  首次登录留空即可，登录后强制设置新密码
--
-- 用法（远程）：
--   npx wrangler d1 execute art-website-db --remote --file=./reset_users.sql
-- 用法（本地）：
--   npx wrangler d1 execute art-website-db --local --file=./reset_users.sql
-- ============================================================

-- 清空旧表（如果存在）
DROP TABLE IF EXISTS users;

-- 建表
CREATE TABLE users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT    NOT NULL DEFAULT '',
    password_salt       TEXT    NOT NULL DEFAULT '',
    password_iterations INTEGER NOT NULL DEFAULT 210000,
    password_algo       TEXT    NOT NULL DEFAULT 'PBKDF2-SHA256',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 插入 admin 账号：password_hash 为空，表示首次登录需设置密码
INSERT INTO users (id, username, password_hash, password_salt, password_iterations, password_algo)
VALUES (1, 'admin', '', '', 210000, 'PBKDF2-SHA256');

-- 触发器
DROP TRIGGER IF EXISTS trg_users_update_time;
CREATE TRIGGER trg_users_update_time
AFTER UPDATE OF username, password_hash, password_salt, password_iterations, password_algo ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;