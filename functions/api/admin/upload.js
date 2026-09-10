// ============================================================
// POST /api/admin/upload
// 接收 multipart/form-data 上传多张图片到 R2
//
// 请求：FormData { images: File[] }
// 响应：{ ok: true, data: { urls: ["https://..."], keys: [...] } }
//
// 参考：https://developers.cloudflare.com/r2/api-reference/
// ============================================================

export async function onRequest({ request, env }) {
  const ALLOWED_TYPES = (env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,image/gif,image/avif')
    .split(',').map(s => s.trim());
  const MAX_SIZE = env.MAX_UPLOAD_SIZE ? parseInt(env.MAX_UPLOAD_SIZE, 10) : 10 * 1024 * 1024;
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  if (!env.BUCKET) {
    return json(
      { ok: false, error: 'bucket_not_configured', message: 'R2 未绑定' },
      500
    );
  }

  const formData = await request.formData();
  const files = formData.getAll('images');

  if (!files || files.length === 0) {
    return json({ ok: false, error: 'no_files' }, 400);
  }

  const urls = [];
  const keys = [];
  const now = new Date();
  const dateDir = now.toISOString().slice(0, 10); // e.g. "2025-09-10"

  for (const file of files) {
    // 类型检查
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json(
        { ok: false, error: 'unsupported_type', message: `不支持的图片格式: ${file.type}` },
        400
      );
    }

    // 大小检查
    if (file.size > MAX_SIZE) {
      return json(
        { ok: false, error: 'file_too_large', message: `文件过大：${file.name}` },
        400
      );
    }

    // 生成唯一文件名
    const ext = file.name.split('.').pop().toLowerCase();
    const random = generateRandom(12);
    const key = `artworks/${dateDir}/${random}.${ext}`;

    // 上传到 R2
    const body = await file.arrayBuffer();
    await env.BUCKET.put(key, body, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    // 构建访问 URL
    // R2 有 public bucket 时可以直接访问
    // 否则需要通过 Worker/API 代理读取
    const url = buildPublicUrl(env, key);
    urls.push(url);
    keys.push(key);
  }

  return Response.json({
    ok: true,
    data: { urls, keys, count: keys.length }
  });
}

/**
 * 构建图片的公共访问 URL
 *
 * 方案 A（推荐）：R2 bucket 设为 public，直接用 R2 自定义域名访问
 *   格式：<YOUR_CUSTOM_DOMAIN>/<key>
 *
 * 方案 B：通过 Cloudflare Pages 的 /r2/* 路由代理
 *   格式：<SITE_ORIGIN>/r2/<key>
 *
 * 当前默认走方案 B（无需额外配置），生产可选 A
 */
function buildPublicUrl(env, key) {
  // 优先使用 R2_CUSTOM_DOMAIN 环境变量（方案 A）
  if (env.R2_CUSTOM_DOMAIN) {
    return `${env.R2_CUSTOM_DOMAIN.replace(/\/$/, '')}/${key}`;
  }
  // 否则走本站 /r2/* 代理（方案 B）
  return `/r2/${key}`;
}

function generateRandom(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
