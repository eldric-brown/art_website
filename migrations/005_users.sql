-- ============================================================
-- Migration 005: 后台用户表与密码哈希存储
-- ============================================================
-- 现有数据库执行一次：
--   npx wrangler@latest d1 execute art-website-db --remote --file=./migrations/005_users.sql
--   npx wrangler@latest d1 execute art-website-db --local  --file=./migrations/005_users.sql
--
-- 新库直接运行 schema.sql，无需再跑本文件。
-- 本迁移不写入默认密码。首次登录使用：
--   用户名：admin
--   密码：Cloudflare 的 ADMIN_PASSWORD 环境变量
-- 首次成功登录后会在 users 表中创建哈希记录。
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT    NOT NULL COLLATE NOCASE UNIQUE,
    password_hash       TEXT    NOT NULL,
    password_salt       TEXT    NOT NULL,
    password_iterations INTEGER NOT NULL DEFAULT 100000,
    password_algo       TEXT    NOT NULL DEFAULT 'PBKDF2-SHA256',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

DROP TRIGGER IF EXISTS trg_users_update_time;
CREATE TRIGGER trg_users_update_time
AFTER UPDATE OF username, password_hash, password_salt, password_iterations, password_algo ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = OLD.id;
END;
