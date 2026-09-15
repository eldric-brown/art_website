// ============================================================
// _lib/html.js - 富文本白名单净化 + 图片/链接地址校验
// ============================================================
// 研究方向（research_items.body）等富文本内容由后台写入、前台直接渲染。
// 这里在【写入时】做白名单过滤：只保留明确允许的标签 / 属性 / 地址 / 布局 class，
// 其余一律丢弃。前台渲染时再走一遍 utils.sanitizeRichHtml 兜底，双保险。
//
// ⚠️ 布局/排版 class 白名单是三处同步的（必须一起改）：
//   1. 本文件 ALLOWED_CLASSES          —— 服务端权威校验
//   2. public/assets/js/editor.js      —— 编辑器只产出这些 class
//   3. public/assets/styles/rich.css   —— 前台/后台共用渲染样式
// ============================================================

export const MAX_BODY_LENGTH = 40000;   // 单条富文本上限（字符）
export const MAX_TEXT_LENGTH = 300;     // subtitle / alt 等文本字段上限
export const MAX_TITLE_LENGTH = 120;
export const MAX_SORT_ORDER = 99999;

// 允许的标签：不在名单里的标签会被“拆壳”（标签丢弃，子内容保留）
export const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's',
  'span', 'strong', 'strike', 'sub', 'sup', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'u', 'ul'
]);

// 完全不允许出现的标签：整块连内容一起删除
export const FORBIDDEN_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'base', 'frame', 'frameset',
  'noscript', 'template', 'svg', 'math', 'video', 'audio', 'source', 'track',
  'applet', 'marquee', 'portal'
];

// 允许的排版 / 布局 class（编辑器、服务端、样式表三处同步）
export const ALLOWED_CLASSES = new Set([
  // 对齐与字号
  'text-center', 'text-right',
  'text-small', 'text-lg', 'text-xl',
  // 文字颜色与字体
  'text-muted', 'text-accent',
  'font-serif', 'font-caps',
  // 图片尺寸
  'img-full', 'img-half', 'img-center', 'img-square', 'img-plain',
  // 结构布局
  'columns-2', 'columns-3', 'column',
  'box-accent', 'box-note', 'box-quote',
  // 间距
  'mt-lg', 'mb-lg', 'no-margin'
]);

// 允许的图片地址：https 任意直链 / 本站 R2 静态代理 / 本地开发
const IMAGE_RE = /^(?:https:\/\/[^\s'"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'"<>]*|\/r2\/artworks\/[^\s'"<>]*)$/i;

// 允许的链接地址：https 外链 / 站内 hash 路由 / 站内路径 / 本地开发
const LINK_RE = /^(?:https:\/\/[^\s'"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'"<>]*|#\/?[^\s'"<>]*|\/[^/\s'"<>][^\s'"<>]*)$/i;

const MAX_URL_LENGTH = 1024;

export function isSafeImageUrl(url) {
  const value = String(url == null ? '' : url).trim();
  return value.length > 0 && value.length <= MAX_URL_LENGTH && IMAGE_RE.test(value);
}

export function isSafeLinkUrl(url) {
  const value = String(url == null ? '' : url).trim();
  return value.length > 0 && value.length <= MAX_URL_LENGTH && LINK_RE.test(value);
}

// ============================================================
// 无 DOM 依赖的标签白名单过滤器
// Cloudflare Workers 运行环境没有 DOMParser / document，
// 所以这里用正则分词 + 栈的方式实现，保证前台后台行为一致。
// ============================================================

const VOID_TAGS = new Set(['br', 'hr', 'img']);
// 块级标签：开启时会隐式关闭已打开的 <p>（与浏览器解析行为一致）
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'ul', 'ol', 'table', 'figure']);
const TAG_TOKEN_RE = /<[^>]*>/g;
const ATTR_RE = /([^\s=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g;
const ENTITY_RE = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z][a-zA-Z0-9]*));/g;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

// 属性值在源码里带着实体转义（href 里的 &amp;），先解码再由 escapeAttr 统一重编码，
// 否则会出现 &amp;amp; 这种双重转义，链接地址就错了。
function decodeEntities(value) {
  return String(value).replace(ENTITY_RE, function (match, hex, dec, name) {
    if (hex !== undefined || dec !== undefined) {
      const code = parseInt(hex !== undefined ? hex : dec, hex !== undefined ? 16 : 10);
      if (!Number.isFinite(code) || code > 0x10FFFF) return match;
      return String.fromCharCode(code);
    }
    const named = NAMED_ENTITIES[name.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

function escapeText(value) {
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!#?\w{1,8};)/g, '&amp;');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

// 切分成 {kind:'text'} / {kind:'tag'} 两种 token
function tokenize(source) {
  const tokens = [];
  let last = 0;
  let match;
  TAG_TOKEN_RE.lastIndex = 0;
  while ((match = TAG_TOKEN_RE.exec(source)) !== null) {
    if (match.index > last) tokens.push({ kind: 'text', value: source.slice(last, match.index) });
    tokens.push({ kind: 'tag', value: match[0] });
    last = match.index + match[0].length;
    if (match[0].length === 0) TAG_TOKEN_RE.lastIndex += 1;
  }
  if (last < source.length) tokens.push({ kind: 'text', value: source.slice(last) });
  return tokens;
}

function parseTag(raw) {
  const body = raw.slice(1, raw.length - 1);
  const isClosing = /^\s*\//.test(body);
  const trimmed = body.replace(/^\s*\/\s*/, '');
  const nameMatch = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(trimmed);
  if (!nameMatch) return { name: '', isClosing: false, isSelfClosing: false, attrs: [] };

  const name = nameMatch[1].toLowerCase();
  return {
    name: name,
    isClosing: isClosing,
    isSelfClosing: /\/\s*$/.test(body),
    attrs: parseAttrs(trimmed.slice(name.length))
  };
}

function parseAttrs(body) {
  const attrs = [];
  ATTR_RE.lastIndex = 0;
  let match;
  while ((match = ATTR_RE.exec(body)) !== null) {
    const name = match[1].toLowerCase();
    if (!name || /^\d/.test(name)) {
      if (match[0].length === 0) ATTR_RE.lastIndex += 1;
      continue;
    }
    let value = '';
    if (match[2] !== undefined) {
      value = decodeEntities(match[2]);
      if ((value.charAt(0) === '"' || value.charAt(0) === "'") && value.length > 1) {
        value = value.slice(1, value.length - 1);
      }
    }
    attrs.push({ name: name, value: value });
    if (match[0].length === 0) ATTR_RE.lastIndex += 1;
  }
  return attrs;
}

function attrValue(attrs, wanted) {
  for (let i = 0; i < attrs.length; i += 1) {
    if (attrs[i].name === wanted) return attrs[i].value;
  }
  return '';
}

// 从 index 起跳过 name 标签的整棵子树，返回下一个待处理下标
function skipSubtree(tokens, index, name, selfClosing) {
  if (selfClosing) return index + 1;
  let depth = 1;
  for (let i = index + 1; i < tokens.length; i += 1) {
    if (tokens[i].kind !== 'tag') continue;
    const tag = parseTag(tokens[i].value);
    if (tag.name !== name) continue;
    if (tag.isClosing) {
      depth -= 1;
      if (depth === 0) return i + 1;
    } else if (!tag.isSelfClosing && !VOID_TAGS.has(tag.name)) {
      depth += 1;
    }
  }
  return tokens.length;
}


// 兜底：去掉全部标签后转义，最坏情况也只是纯文字，绝不会执行脚本
function toPlainText(source) {
  return String(source)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[<>&]/g, function (ch) {
      return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;';
    });
}

// 重建一个只含白名单属性的开标签（style / on* / srcdoc 等一律丢弃）
function buildOpenTag(tag) {
  const kept = {};
  for (let i = 0; i < tag.attrs.length; i += 1) {
    const attr = tag.attrs[i];
    const name = attr.name;
    const value = attr.value;

    if (name === 'class') {
      const classes = value
        .split(/\s+/)
        .map(function (token) { return token.trim(); })
        .filter(function (token) { return token.length > 0 && ALLOWED_CLASSES.has(token); });
      if (classes.length) kept.class = classes.join(' ');
      continue;
    }
    if (name === 'width' || name === 'height') {
      const num = Math.round(Number(value));
      if (Number.isFinite(num) && num >= 1 && num <= 8000) kept[name] = String(num);
      continue;
    }
    if (name === 'alt' || name === 'title') {
      const text = value.trim();
      if (text.length > 0 && text.length <= MAX_TEXT_LENGTH) kept[name] = text;
      continue;
    }
    if (tag.name === 'img' && name === 'src') { kept.src = value; continue; }
    if (tag.name === 'a' && name === 'href') {
      // 链接统一新窗口打开，并带上 rel，避免 tabnabbing
      kept.href = value;
      kept.target = '_blank';
      kept.rel = 'noopener noreferrer';
      continue;
    }
    if (name === 'target' && value.toLowerCase() === '_blank') { kept.target = '_blank'; continue; }
  }

  const order = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'width', 'height'];
  let attrs = '';
  for (const key of order) {
    if (kept[key] === undefined) continue;
    attrs += ' ' + key + '="' + escapeAttr(kept[key]) + '"';
  }

  const isVoid = VOID_TAGS.has(tag.name) || tag.isSelfClosing;
  return '<' + tag.name + attrs + (isVoid ? ' /' : '') + '>';
}

function filterTokens(tokens) {
  let out = '';
  const stack = [];
  const unwrapped = [];      // 已拆壳、待丢弃闭合标签的标签名
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.kind === 'text') {
      out += escapeText(token.value);
      index += 1;
      continue;
    }

    // 注释与 doctype 直接丢弃
    if (/^<!--/.test(token.value) || /^<!(?:[a-zA-Z]|DOCTYPE)/i.test(token.value)) {
      index += 1;
      continue;
    }

    const tag = parseTag(token.value);
    if (!tag.name) {
      // 解析不出标签名的尖括号片段按纯文本输出，不会变成可执行结构
      out += escapeText(token.value);
      index += 1;
      continue;
    }

    if (tag.isClosing) {
      // 拆壳过的标签：只丢掉闭合标签本身，子内容已经在上面正常输出了
      let consumed = false;
      for (let n = unwrapped.length - 1; n >= 0; n -= 1) {
        if (unwrapped[n] === tag.name) { unwrapped.splice(n, 1); consumed = true; break; }
      }
      if (consumed) { index += 1; continue; }

      if (stack.indexOf(tag.name) !== -1) {
        while (stack.length > 0 && stack[stack.length - 1] !== tag.name) stack.pop();
        if (stack.length > 0) {
          stack.pop();
          out += '</' + tag.name + '>';
        }
      }
      index += 1;
      continue;
    }

    if (FORBIDDEN_TAGS.indexOf(tag.name) !== -1) {
      // 禁止的标签：连内容整块删除
      index = skipSubtree(tokens, index, tag.name, tag.isSelfClosing || VOID_TAGS.has(tag.name));
      continue;
    }
    if (!ALLOWED_TAGS.has(tag.name)) {
      // 其他未知标签：拆壳保留子内容，闭合标签在后面会被丢弃
      if (!tag.isSelfClosing && !VOID_TAGS.has(tag.name)) unwrapped.push(tag.name);
      index += 1;
      continue;
    }

    if (tag.name === 'img' && !isSafeImageUrl(attrValue(tag.attrs, 'src'))) {
      index += 1;                              // 非法图片地址：整张图删掉
      continue;
    }
    if (tag.name === 'a' && !isSafeLinkUrl(attrValue(tag.attrs, 'href'))) {
      // 非法链接：拆壳保留文字
      unwrapped.push(tag.name);
      index += 1;
      continue;
    }

    // 块级标签开启时先关掉已打开的 <p>，避免出现 <p>…<p>… 这种未闭合结构
    if (BLOCK_TAGS.has(tag.name)) {
      while (stack.length > 0 && stack[stack.length - 1] === 'p') {
        stack.pop();
        out += '</p>';
      }
    }

    out += buildOpenTag(tag);
    if (!VOID_TAGS.has(tag.name) && !tag.isSelfClosing) stack.push(tag.name);
    index += 1;
  }

  while (stack.length > 0) out += '</' + stack.pop() + '>';
  return out.replace(/^\s+|\s+$/g, '');
}

/**
 * 净化富文本 HTML（无 DOM 依赖，Workers 与浏览器行为一致）。
 * @param {string} rawHtml 原始 HTML
 * @param {number} [maxLength] 长度上限，默认 MAX_BODY_LENGTH
 * @returns {string} 只含白名单标签 / 属性 / class 的 HTML
 */
export function sanitizeRichHtml(rawHtml, maxLength) {
  const limit = Number.isFinite(maxLength) && maxLength > 0 ? maxLength : MAX_BODY_LENGTH;
  const text = String(rawHtml == null ? '' : rawHtml);
  const source = text.length > limit ? text.slice(0, limit) : text;

  if (!source.trim()) return '';

  try {
    return filterTokens(tokenize(source));
  } catch (error) {
    console.error('rich html sanitize failed, falling back to plain text:', error);
    return toPlainText(source);
  }
}