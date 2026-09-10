import { json, methodNotAllowed } from '../../_lib/http.js';

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

const MIME_LABELS = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'image/avif': 'AVIF'
};

function generateRandom(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hasAscii(bytes, offset, text) {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

function matchesImageSignature(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);

  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === 'image/gif') {
    return hasAscii(bytes, 0, 'GIF87a') || hasAscii(bytes, 0, 'GIF89a');
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12 && hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP');
  }
  if (mimeType === 'image/avif') {
    return bytes.length >= 12 && hasAscii(bytes, 4, 'ftyp') &&
      (hasAscii(bytes, 8, 'avif') || hasAscii(bytes, 8, 'avis'));
  }

  return false;
}

function buildPublicUrl(env, key) {
  if (env.R2_CUSTOM_DOMAIN) {
    try {
      const domain = new URL(env.R2_CUSTOM_DOMAIN);
      if (domain.protocol === 'https:') {
        return `${domain.toString().replace(/\/$/, '')}/${key}`;
      }
    } catch {
      console.error('R2_CUSTOM_DOMAIN is invalid');
    }
  }

  return `/r2/${key}`;
}

async function rollbackUploads(bucket, keys) {
  const results = await Promise.allSettled(keys.map((key) => bucket.delete(key)));
  for (const result of results) {
    if (result.status === 'rejected') console.error('upload rollback failed:', result.reason);
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  if (!env.BUCKET) {
    return json({
      ok: false,
      error: 'bucket_not_configured',
      message: 'R2 未绑定'
    }, 500);
  }

  const maxSize = Number.parseInt(env.MAX_UPLOAD_SIZE || '10485760', 10);
  const maxTotalSize = Number.parseInt(env.MAX_TOTAL_UPLOAD_SIZE || '41943040', 10);
  if (!Number.isInteger(maxSize) || maxSize <= 0 || !Number.isInteger(maxTotalSize) || maxTotalSize <= 0) {
    return json({ ok: false, error: 'invalid_upload_config' }, 500);
  }

  const configuredTypes = new Set(
    String(env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp,image/gif,image/avif')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const allowedTypes = Object.keys(MIME_EXTENSIONS).filter((mime) => configuredTypes.has(mime));

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: 'invalid_form_data' }, 400);
  }

  const files = formData.getAll('images');
  if (files.length === 0) return json({ ok: false, error: 'no_files' }, 400);
  if (files.length > 20) {
    return json({ ok: false, error: 'too_many_files', message: '单次最多上传 20 张图片' }, 400);
  }

  let totalSize = 0;
  for (const file of files) {
    if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function' ||
        typeof file.size !== 'number' || typeof file.type !== 'string') {
      return json({ ok: false, error: 'invalid_file' }, 400);
    }
    if (!allowedTypes.includes(file.type)) {
      return json({
        ok: false,
        error: 'unsupported_type',
        message: `不支持的图片格式: ${MIME_LABELS[file.type] || file.type || '未知'}`
      }, 400);
    }
    if (file.size <= 0 || file.size > maxSize) {
      return json({
        ok: false,
        error: 'file_too_large',
        message: `文件大小无效或超过 ${Math.floor(maxSize / 1024 / 1024)}MB`
      }, 400);
    }
    totalSize += file.size;
  }

  if (totalSize > maxTotalSize) {
    return json({
      ok: false,
      error: 'total_size_too_large',
      message: `单次上传总大小不能超过 ${Math.floor(maxTotalSize / 1024 / 1024)}MB`
    }, 400);
  }

  const now = new Date();
  const dateDir = now.toISOString().slice(0, 10);
  const urls = [];
  const keys = [];

  try {
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      if (!matchesImageSignature(buffer, file.type)) {
        await rollbackUploads(env.BUCKET, keys);
        return json({
          ok: false,
          error: 'invalid_image_content',
          message: `${MIME_LABELS[file.type] || '图片'} 文件内容与扩展类型不匹配`
        }, 400);
      }

      const extension = MIME_EXTENSIONS[file.type];
      const key = `artworks/${dateDir}/${generateRandom(12)}.${extension}`;

      await env.BUCKET.put(key, buffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });

      keys.push(key);
      urls.push(buildPublicUrl(env, key));
    }

    return json({
      ok: true,
      data: { urls, keys, count: keys.length }
    });
  } catch (error) {
    console.error('upload images failed:', error);
    await rollbackUploads(env.BUCKET, keys);
    return json({
      ok: false,
      error: 'internal_error',
      message: '图片上传失败'
    }, 500);
  }
}