-- ============================================================
-- Art Website - D1 校验脚本（只读，单条 SQL）
-- ============================================================
-- 用法：
--   npx wrangler@latest d1 execute art-website-db --local  --file=./verify.sql
--   npx wrangler@latest d1 execute art-website-db --remote --file=./verify.sql
--
-- 输出一列 report，内容为 JSON，包含：
--   objects   数据库对象清单
--   counts    各表行数与关键数量
--   users     用户密码算法和哈希长度（不含哈希正文）
--   problems  数据完整性计数，所有值应为 0
-- ============================================================

WITH
object_rows AS (
    SELECT type, name
    FROM sqlite_master
    WHERE type IN ('table', 'index', 'trigger')
    ORDER BY type, name
),
counts AS (
    SELECT
        (SELECT COUNT(*) FROM artworks) AS artworks,
        (SELECT COUNT(*) FROM artist) AS artist,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM meetup_items) AS meetup_items,
        (SELECT COUNT(*) FROM site_content) AS site_content,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM view_logs) AS view_logs,
        (SELECT COUNT(*) FROM categories WHERE enabled = 1) AS enabled_categories,
        (SELECT COUNT(*) FROM artworks WHERE published = 1 AND featured = 1) AS published_featured
),
user_rows AS (
    SELECT
        id,
        username,
        password_algo,
        password_iterations,
        length(password_hash) AS hash_length,
        length(password_salt) AS salt_length,
        created_at,
        updated_at
    FROM users
    ORDER BY id
),
problems AS (
    SELECT json_object(
        'invalid_artwork_images', (
            SELECT COUNT(*) FROM artworks WHERE json_valid(images) = 0
        ),
        'empty_artwork_images', (
            SELECT COUNT(*) FROM artworks
            WHERE json_valid(images) = 1 AND json_array_length(images) = 0
        ),
        'orphan_artwork_category', (
            SELECT COUNT(*)
            FROM artworks a
            LEFT JOIN categories c ON c.key = a.category
            WHERE c.id IS NULL
        ),
        'invalid_artwork_year', (
            SELECT COUNT(*) FROM artworks WHERE year < 1900 OR year > 2100
        ),
        'invalid_user_password_record', (
            SELECT COUNT(*) FROM users
            WHERE password_hash = '' OR password_salt = '' OR password_iterations < 10000
        ),
        'missing_artist_baseline', (
            CASE WHEN EXISTS (SELECT 1 FROM artist WHERE id = 1) THEN 0 ELSE 1 END
        ),
        'missing_admin_user', (
            CASE WHEN EXISTS (SELECT 1 FROM users WHERE username = 'admin' COLLATE NOCASE) THEN 0 ELSE 1 END
        )
    ) AS value
)SELECT json_object(
    'objects', (
        SELECT json_group_array(json_object('type', type, 'name', name))
        FROM object_rows
    ),
    'counts', (
        SELECT json_object(
            'artworks', artworks,
            'artist', artist,
            'categories', categories,
            'meetup_items', meetup_items,
            'site_content', site_content,
            'users', users,
            'view_logs', view_logs,
            'enabled_categories', enabled_categories,
            'published_featured', published_featured
        )
        FROM counts
    ),
    'users', (
        SELECT json_group_array(json_object(
            'id', id,
            'username', username,
            'password_algo', password_algo,
            'password_iterations', password_iterations,
            'hash_length', hash_length,
            'salt_length', salt_length,
            'created_at', created_at,
            'updated_at', updated_at
        ))
        FROM user_rows
    ),
    'problems', (SELECT value FROM problems)
) AS report;
