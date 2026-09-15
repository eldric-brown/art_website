// sanitize_test.js - ES5 port of functions/_lib/html.js sanitizeRichHtml()
// Run: cscript //nologo tools\sanitize_test.js
// ASCII-only source on purpose: Windows Script Host has no UTF-8 support.

var MAX_TEXT_LENGTH = 300;
var MAX_URL_LENGTH = 1024;

var ALLOWED_TAGS = 'a b blockquote br code div em figcaption figure h1 h2 h3 h4 hr i img li ol p pre s small span strong strike sub sup table tbody td th thead tr u ul'.split(' ');
var FORBIDDEN_TAGS = 'script style iframe object embed form input button textarea select option link meta base frame frameset noscript template svg math video audio source track applet marquee portal'.split(' ');
var ALLOWED_CLASSES = 'text-center text-right text-small text-lg text-xl text-muted text-accent font-serif font-caps img-full img-half img-center img-square img-plain columns-2 columns-3 column box-accent box-note box-quote mt-lg mb-lg no-margin'.split(' ');
var VOID_TAGS = 'br hr img'.split(' ');
var BLOCK_TAGS = 'p div h1 h2 h3 h4 blockquote pre ul ol table figure'.split(' ');
var ENTITY_RE = /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|([a-zA-Z][a-zA-Z0-9]*));/g;
var NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

var TAG_RE = /<[^>]*>/g;
var ATTR_RE = /([^\s=/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g;
var IMAGE_RE = /^(?:https:\/\/[^\s'\"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'\"<>]*|\/r2\/artworks\/[^\s'\"<>]*)$/i;
var LINK_RE = /^(?:https:\/\/[^\s'\"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'\"<>]*|#\/?[^\s'\"<>]*|\/[^/\s'\"<>][^\s'\"<>]*)$/i;

function inList(list, value) { for (var i = 0; i < list.length; i += 1) { if (list[i] === value) return true; } return false; }
function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }

function isSafeImageUrl(url) {
  var value = trim(url == null ? '' : String(url));
  return value.length > 0 && value.length <= MAX_URL_LENGTH && IMAGE_RE.test(value);
}

function isSafeLinkUrl(url) {
  var value = trim(url == null ? '' : String(url));
  return value.length > 0 && value.length <= MAX_URL_LENGTH && LINK_RE.test(value);
}

function decodeEntities(value) {
  return String(value).replace(ENTITY_RE, function (match, hex, dec, name) {
    if (hex !== undefined || dec !== undefined) {
      var code = parseInt(hex !== undefined ? hex : dec, hex !== undefined ? 16 : 10);
      if (!isFinite(code) || code > 0x10FFFF) return match;
      return String.fromCharCode(code);
    }
    var named = NAMED_ENTITIES[name.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

function escapeText(value) {
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&(?!#?\w{1,8};)/g, '&amp;');
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function tokenize(source) {
  var tokens = [];
  var last = 0;
  var match;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(source)) !== null) {
    if (match.index > last) tokens.push({ kind: 'text', value: source.slice(last, match.index) });
    tokens.push({ kind: 'tag', value: match[0] });
    last = match.index + match[0].length;
    if (match[0].length === 0) TAG_RE.lastIndex += 1;
  }
  if (last < source.length) tokens.push({ kind: 'text', value: source.slice(last) });
  return tokens;
}

function parseTag(raw) {
  var body = raw.slice(1, raw.length - 1);
  var isClosing = /^\s*\//.test(body);
  var cleaned = body.replace(/^\s*\/\s*/, '');
  var nameMatch = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(cleaned);
  if (!nameMatch) return { name: '', isClosing: false, isSelfClosing: false, attrs: [] };
  var name = nameMatch[1].toLowerCase();
  return {
    name: name,
    isClosing: isClosing,
    isSelfClosing: /\/\s*$/.test(body),
    attrs: parseAttrs(cleaned.slice(name.length))
  };
}

function parseAttrs(body) {
  var attrs = [];
  ATTR_RE.lastIndex = 0;
  var match;
  while ((match = ATTR_RE.exec(body)) !== null) {
    var name = match[1].toLowerCase();
    if (!name || /^\d/.test(name)) {
      if (match[0].length === 0) ATTR_RE.lastIndex += 1;
      continue;
    }
    var value = '';
    if (match[2] !== undefined) {
      value = decodeEntities(match[2]);
      if (value.charAt(0) === '"' || value.charAt(0) === "'") value = value.slice(1, value.length - 1);
    }
    attrs.push({ name: name, value: value });
    if (match[0].length === 0) ATTR_RE.lastIndex += 1;
  }
  return attrs;
}

function attrValue(attrs, wanted) {
  for (var i = 0; i < attrs.length; i += 1) { if (attrs[i].name === wanted) return attrs[i].value; }
  return '';
}

function skipSubtree(tokens, index, name, selfClosing) {
  if (selfClosing) return index + 1;
  var depth = 1;
  for (var i = index + 1; i < tokens.length; i += 1) {
    if (tokens[i].kind !== 'tag') continue;
    var tag = parseTag(tokens[i].value);
    if (tag.name !== name) continue;
    if (tag.isClosing) {
      depth -= 1;
      if (depth === 0) return i + 1;
    } else if (!tag.isSelfClosing && !inList(VOID_TAGS, tag.name)) depth += 1;
  }
  return tokens.length;
}

function buildOpenTag(tag) {
  var kept = {};
  for (var i = 0; i < tag.attrs.length; i += 1) {
    var name = tag.attrs[i].name;
    var value = tag.attrs[i].value;

    if (name === 'class') {
      var parts = value.split(/\s+/);
      var classes = [];
      for (var j = 0; j < parts.length; j += 1) {
        var cls = trim(parts[j]);
        if (cls.length > 0 && inList(ALLOWED_CLASSES, cls)) classes.push(cls);
      }
      if (classes.length) kept['class'] = classes.join(' ');
      continue;
    }
    if (name === 'width' || name === 'height') {
      var num = Math.round(Number(value));
      if (isFinite(num) && num >= 1 && num <= 8000) kept[name] = String(num);
      continue;
    }
    if (name === 'alt' || name === 'title') {
      var text = trim(value);
      if (text.length > 0 && text.length <= MAX_TEXT_LENGTH) kept[name] = text;
      continue;
    }
    if (tag.name === 'img' && name === 'src') { kept.src = value; continue; }
    if (tag.name === 'a' && name === 'href') {
      kept.href = value;
      kept.target = '_blank';
      kept.rel = 'noopener noreferrer';
      continue;
    }
    if (name === 'target' && value.toLowerCase() === '_blank') { kept.target = '_blank'; continue; }
  }

  var order = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'width', 'height'];
  var attrs = '';
  for (var k = 0; k < order.length; k += 1) {
    if (kept[order[k]] === undefined) continue;
    attrs += ' ' + order[k] + '="' + escapeAttr(kept[order[k]]) + '"';
  }
  var isVoid = inList(VOID_TAGS, tag.name) || tag.isSelfClosing;
  return '<' + tag.name + attrs + (isVoid ? ' /' : '') + '>';
}

function filterTokens(tokens) {
  var out = '';
  var stack = [];
  var unwrapped = [];
  var index = 0;

  while (index < tokens.length) {
    var token = tokens[index];

    if (token.kind === 'text') { out += escapeText(token.value); index += 1; continue; }
    if (/^<!--/.test(token.value) || /^<!(?:[a-zA-Z]|DOCTYPE)/i.test(token.value)) { index += 1; continue; }

    var tag = parseTag(token.value);
    if (!tag.name) { out += escapeText(token.value); index += 1; continue; }

    if (tag.isClosing) {
      var consumed = false;
      for (var n = unwrapped.length - 1; n >= 0; n -= 1) {
        if (unwrapped[n] === tag.name) { unwrapped.splice(n, 1); consumed = true; break; }
      }
      if (consumed) { index += 1; continue; }
      if (inList(stack, tag.name)) {
        while (stack.length > 0 && stack[stack.length - 1] !== tag.name) stack.pop();
        if (stack.length > 0) { stack.pop(); out += '</' + tag.name + '>'; }
      }
      index += 1;
      continue;
    }

    if (inList(FORBIDDEN_TAGS, tag.name)) {
      index = skipSubtree(tokens, index, tag.name, tag.isSelfClosing || inList(VOID_TAGS, tag.name));
      continue;
    }
    if (!inList(ALLOWED_TAGS, tag.name)) {
      if (!tag.isSelfClosing && !inList(VOID_TAGS, tag.name)) unwrapped.push(tag.name);
      index += 1;
      continue;
    }
    if (tag.name === 'img' && !isSafeImageUrl(attrValue(tag.attrs, 'src'))) { index += 1; continue; }
    if (tag.name === 'a' && !isSafeLinkUrl(attrValue(tag.attrs, 'href'))) {
      unwrapped.push(tag.name);
      index += 1;
      continue;
    }

    if (inList(BLOCK_TAGS, tag.name)) {
      while (stack.length > 0 && stack[stack.length - 1] === 'p') { stack.pop(); out += '</p>'; }
    }

    out += buildOpenTag(tag);
    if (!inList(VOID_TAGS, tag.name) && !tag.isSelfClosing) stack.push(tag.name);
    index += 1;
  }

  while (stack.length > 0) out += '</' + stack.pop() + '>';
  return out.replace(/^\s+|\s+$/g, '');
}

function sanitizeRichHtml(rawHtml) {
  var source = String(rawHtml == null ? '' : rawHtml);
  if (!trim(source)) return '';
  return filterTokens(tokenize(source));
}

// ============================================================
// cases: [name, input, mustContain[], mustNotContain[]]
// ============================================================
var CASES = [
  ['keep columns layout',
    '<div class="columns-2"><div class="column">A</div><div class="column">B</div></div>',
    ['<div class="columns-2">', '<div class="column">A</div>', '<div class="column">B</div>'],
    []],

  ['keep text size and align classes',
    '<p class="text-center text-xl">Title</p><p class="text-right text-muted">Note</p><p class="mb-lg">End</p>',
    ['class="text-center text-xl"', 'class="text-right text-muted"', 'class="mb-lg"'],
    []],

  ['remove script block',
    '<p>ok</p><script>alert(1)</script><p>also ok</p>',
    ['<p>ok</p>', '<p>also ok</p>'],
    ['script', 'alert(1)']],

  ['drop on* and style attributes',
    '<p onclick="alert(1)" style="color:red" class="box-note">body</p>',
    ['<p class="box-note">body</p>'],
    ['onclick', 'style']],

  ['unwrap unknown tag',
    '<div><blink>emphasized</blink></div>',
    ['<div>emphasized</div>'],
    ['blink']],

  ['remove iframe',
    'before<iframe src="https://evil"></iframe>after',
    ['before', 'after'],
    ['iframe', 'evil']],

  ['keep https image',
    '<img src="https://example.com/a.jpg" alt="pic" class="img-half">',
    ['src="https://example.com/a.jpg"', 'alt="pic"', 'class="img-half"'],
    []],

  ['drop data: image',
    '<p>body</p><img src="data:image/png;base64,AAA">',
    ['<p>body</p>'],
    ['img', 'data:']],

  ['drop image without src',
    '<p>body</p><img alt="x">',
    ['<p>body</p>'],
    ['img']],

  ['keep r2 image path',
    '<img src="/r2/artworks/12/x.jpg">',
    ['src="/r2/artworks/12/x.jpg"'],
    []],

  ['keep external link with rel',
    '<a href="https://example.com">site</a>',
    ['href="https://example.com"', 'target="_blank"', 'rel="noopener noreferrer"'],
    []],

  ['keep internal path and hash links',
    '<a href="/works">works</a><a href="#/research">research</a>',
    ['href="/works"', 'href="#/research"'],
    []],

  ['unwrap javascript: link',
    '<a href="javascript:alert(1)">click</a>',
    ['click'],
    ['href', 'javascript']],

  ['filter non-whitelisted class',
    '<p class="text-center evil-1">body</p>',
    ['class="text-center"'],
    ['evil-1']],

  ['drop class attr when all classes invalid',
    '<p class="x1 x2">body</p>',
    ['<p>body</p>'],
    ['class']],

  ['escaped angle brackets stay literal',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    ['&lt;script&gt;', '&lt;/script&gt;'],
    ['<script>']],

  ['bare ampersand is escaped',
    'A & B',
    ['A &amp; B'],
    ['A & B']],

  ['nbsp entity preserved',
    'a&nbsp;b',
    ['&nbsp;'],
    []],

  ['remove comment',
    '<p>body</p><!-- private note -->',
    ['<p>body</p>'],
    ['private note']],

  ['remove doctype',
    '<!DOCTYPE html><p>body</p>',
    ['<p>body</p>'],
    ['DOCTYPE']],



  ['deep nesting stays intact',
    '<div class="box-quote"><blockquote><p>line one</p><p>line two</p></blockquote></div>',
    ['<div class="box-quote">', '<blockquote>', '<p>line one</p>', '<p>line two</p>', '</blockquote>', '</div>'],
    []],

  ['list intact',
    '<ul><li>one</li><li>two</li></ul>',
    ['<ul>', '<li>one</li>', '<li>two</li>', '</ul>'],
    []],

  ['table intact',
    '<table><thead><tr><th>col</th></tr></thead><tbody><tr><td>val</td></tr></tbody></table>',
    ['<table>', '<thead>', '<th>col</th>', '<tbody>', '<td>val</td>', '</table>'],
    []],

  ['unclosed tags are balanced',
    '<p>first<p>second',
    ['<p>first</p>', '<p>second</p>'],
    []],

  ['empty input returns empty',
    '',
    [''],
    []],

  ['svg carrying script removed whole',
    '<svg><script>alert(1)</script><text x="0">hi</text></svg>safe',
    ['safe'],
    ['svg', 'script']],

  ['attribute quote breakout neutralised',
    '<img src=x" onload=alert(1)>body',
    ['body'],
    ['onload']],

  ['nested script removed',
    '<div><p>ok</p><script>var a=1;</script></div>',
    ['<div>', '<p>ok</p>', '</div>'],
    ['script', 'var a=1']],

  ['style url() dropped',
    '<span style="background:url(https://x)">text</span>',
    ['<span>text</span>'],
    ['url']],

  ['form controls removed',
    '<p>heading</p><input type="text" value="x"><button>submit</button>',
    ['<p>heading</p>'],
    ['input', 'button', 'submit']],

  ['realistic body keeps every block',
    '<h2 class="text-lg">Research question</h2>' +
    '<p class="mt-lg">What does the <em class="text-accent">brushwork</em> record?</p>' +
    '<div class="columns-3">' +
    '<div class="column"><img src="https://cdn.example.com/1.jpg" class="img-full" alt="study 1"></div>' +
    '<div class="column"><img src="https://cdn.example.com/2.jpg" class="img-full" alt="study 2"></div>' +
    '<div class="column"><p>caption text</p></div>' +
    '</div>' +
    '<blockquote class="box-quote">field note</blockquote>' +
    '<hr />' +
    '<p class="text-right text-small">- recorded 2026</p>',
    ['<h2 class="text-lg">Research question</h2>',
     '<em class="text-accent">brushwork</em>',
     '<div class="columns-3">',
     '<div class="column"><img src="https://cdn.example.com/1.jpg" alt="study 1" class="img-full" />',
     'caption text',
     '<blockquote class="box-quote">field note</blockquote>',
     '- recorded 2026'],
    []],

  ['link query string keeps single escaping',
    '<a href="https://example.com/?a=1&amp;b=2">link</a>',
    ['href="https://example.com/?a=1&amp;b=2"', 'target="_blank"'],
    ['&amp;amp;']],

  ['numeric entity in alt is decoded once',
    '<img src="https://cdn.example.com/x.jpg" alt="a&#64;b.com">',
    ['alt="a@b.com"'],
    ['&#64;']],

  ['unknown entity stays literal text',
    '<p class="text-center">a&amp;nbsp;b</p>',
    ['a&amp;nbsp;b'],
    []],

  ['uppercase tag name normalises',
    '<P>UPPER</P>',
    ['<p>UPPER</p>'],
    []],

  ['uppercase tag and attributes normalise',
    '<P CLASS="text-center">X</P>',
    ['<p class="text-center">X</p>'],
    []],

  ['nbsp in text is preserved',
    '<p>foo&nbsp;bar</p>',
    ['foo&nbsp;bar'],
    []],

  ['unknown entity stays literal',
    '<p class="text-center">a&amp;nbsp;b</p>',
    ['a&amp;nbsp;b'],
    []],

  ['unclosed p is balanced when another block opens',
    '<p>first<p>second',
    ['<p>first</p>', '<p>second</p>'],
    []],

  ['p closed when a div opens inside it',
    '<p>lead<div class="box-note">note</div>tail</p>',
    ['<p>lead</p>', '<div class="box-note">note</div>'],
    []],

  ['self closing img syntax',
    '<p>x</p><img src="https://cdn.example.com/1.jpg" /><p>y</p>',
    ['<p>x</p>', '<p>y</p>', 'src="https://cdn.example.com/1.jpg"'],
    []],

  ['script nested inside an allowed tag is removed',
    '<p>ok<script>alert(1)</script>end</p>',
    ['okend'],
    ['script', 'alert(1)']],

  ['comment between tags is dropped',
    '<p>one</p><!-- hi --><p>two</p>',
    ['<p>one</p>', '<p>two</p>'],
    ['hi']],

  ['repeated spaces in class collapse',
    '<p class="text-center  text-right">x</p>',
    ['class="text-center text-right"'],
    []],

  ['width and height are kept',
    '<img src="https://cdn.example.com/1.jpg" width="800" height="600">',
    ['width="800"', 'height="600"'],
    []],

  ['out of range width is dropped',
    '<img src="https://cdn.example.com/1.jpg" width="99999">',
    ['src="https://cdn.example.com/1.jpg"'],
    ['width']],

  ['title longer than the limit is dropped',
    '<a href="https://example.com" title="' + new Array(400).join('a') + '">t</a>',
    ['href="https://example.com"', 'target="_blank"'],
    ['title']],

  ['src on a non img tag is dropped',
    '<span src="https://x.com">x</span>',
    ['<span>x</span>'],
    ['src']],

  ['href on a non anchor tag is dropped',
    '<img src="https://cdn.example.com/1.jpg" href="https://y.com">',
    ['src="https://cdn.example.com/1.jpg"'],
    ['href']],

  ['unknown self closing tag is unwrapped',
    '<foo />x',
    ['x'],
    ['foo']],

  ['unknown tag is unwrapped keeping text',
    '<blink>Hello</blink>',
    ['Hello'],
    ['blink']],

  ['javascript in img src is dropped',
    '<img src="javascript:alert(1)">',
    [],
    ['img', 'javascript']],

  ['blockquote hr figure sub sup and strike survive',
    '<blockquote class="box-quote">q</blockquote><hr /><figure><figcaption class="text-muted">cap</figcaption></figure><sub>sub</sub><sup>sup</sup><strike>out</strike>',
    ['<blockquote class="box-quote">q</blockquote>', '<hr />', '<figure>',
     '<figcaption class="text-muted">cap</figcaption>', '</figure>',
     '<sub>sub</sub>', '<sup>sup</sup>', '<strike>out</strike>'],
    []],

  ['pre code and small survive',
    '<pre class="font-serif">  spaced  </pre><code>c</code><small class="text-small">s</small><s>z</s><i>i</i><u>u</u><strong>b</strong><em>e</em>',
    ['<pre class="font-serif">  spaced  </pre>', '<code>c</code>',
     '<small class="text-small">s</small>', '<s>z</s>', '<i>i</i>',
     '<u>u</u>', '<strong>b</strong>', '<em>e</em>'],
    []],

  ['full table round trips',
    '<table><thead><tr><th class="text-right">Year</th><th>Title</th></tr></thead><tbody><tr><td>2026</td><td>Work</td></tr></tbody></table>',
    ['<table>', '<thead>', '<tr>', '<th class="text-right">Year</th>', '<th>Title</th>',
     '</tr>', '</thead>', '<tbody>', '<td>2026</td>', '<td>Work</td>',
     '</tbody>', '</table>'],
    []],

  ['ordered list round trips',
    '<ol><li>one</li><li>two</li><li>three</li></ol>',
    ['<ol>', '<li>one</li>', '<li>two</li>', '<li>three</li>', '</ol>'],
    []],

  ['columns layout keeps every column',
    '<div class="columns-3"><div class="column">a</div><div class="column">b</div><div class="column">c</div></div>',
    ['<div class="columns-3">', '<div class="column">a</div>',
     '<div class="column">b</div>', '<div class="column">c</div>'],
    []],

  ['columns two keeps every column',
    '<div class="columns-2"><div class="column"><p>left</p></div><div class="column"><p>right</p></div></div>',
    ['<div class="columns-2">', '<div class="column"><p>left</p></div>',
     '<div class="column"><p>right</p></div>'],
    []],

  ['box accents all survive',
    '<div class="box-accent">a</div><div class="box-note">n</div><div class="box-quote">q</div>',
    ['<div class="box-accent">a</div>', '<div class="box-note">n</div>',
     '<div class="box-quote">q</div>'],
    []],

  ['every forbidden tag is removed with its content',
    'x<script>s</script>x<style>st</style>x<iframe>i</iframe>x<object>o</object>x<embed>x<form>f</form>x<input type="text"x<button>b</button>x<textarea>t</textarea>x<select>s2</select>x<option>o2</option>x<link>x<meta>x<base>x<frame>x<frameset>x<noscript>ns</noscript>x<template>tp</template>x<svg>sv</svg>x<math>mt</math>x<video>vd</video>x<audio>ad</audio>x<source>x<track>x<applet>x<marquee>x<portal>',
    ['x'],
    ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
     'textarea', 'select', 'option', 'link', 'meta', 'base', 'frame', 'frameset',
     'noscript', 'template', 'svg', 'math', 'video', 'audio', 'source', 'track',
     'applet', 'marquee', 'portal']],

  ['unterminated tag does not eat the rest',
    '<p>safe<img src="https://cdn.example.com/1.jpg" width=',
    ['safe', 'src="https://cdn.example.com/1.jpg"'],
    []],

  ['stray close tag is ignored',
    '<p>hello</p></div></p></span>after',
    ['<p>hello</p>', 'after'],
    []],

  ['deep nesting keeps order',
    '<div class="columns-2"><div class="column"><blockquote class="box-quote"><p>inner</p><p>inner2</p></blockquote></div><div class="column"><ul><li>l1</li></ul></div></div>',
    ['<div class="columns-2">', '<div class="column">', '<blockquote class="box-quote">',
     '<p>inner</p>', '<p>inner2</p>', '</blockquote>', '<div class="column">',
     '<ul>', '<li>l1</li>', '</ul>', '</div>', '</div>'],
    []],

  ['whitespace only input returns empty',
    '   \t\n  ',
    [''],
    []],

  ['real article body keeps everything',
    '<h2 class="text-center text-lg">Research question</h2>' +
    '<p class="mt-lg">What does the <em class="text-accent">brushwork</em> record?</p>' +
    '<div class="columns-3">' +
    '<div class="column"><img src="https://cdn.example.com/1.jpg" class="img-full" alt="study 1"></div>' +
    '<div class="column"><img src="https://cdn.example.com/2.jpg" class="img-full" alt="study 2"></div>' +
    '<div class="column"><p>caption text</p></div>' +
    '</div>' +
    '<blockquote class="box-quote">field note</blockquote>' +
    '<hr />' +
    '<p class="text-right text-small mb-lg">- recorded 2026</p>',
    ['<h2 class="text-center text-lg">Research question</h2>',
     '<p class="mt-lg">', '<em class="text-accent">brushwork</em>',
     '<div class="columns-3">',
     '<div class="column"><img src="https://cdn.example.com/1.jpg" alt="study 1" class="img-full" />',
     'caption text',
     '<blockquote class="box-quote">field note</blockquote>',
     '<hr />',
     '<p class="text-right text-small mb-lg">- recorded 2026</p>'],
    []]

];


var passed = 0;
var failed = 0;

for (var c = 0; c < CASES.length; c += 1) {
  var item = CASES[c];
  var output;
  try {
    output = sanitizeRichHtml(item[1]);
  } catch (error) {
    WScript.Echo('[FAIL] ' + item[0] + '  threw: ' + error.message);
    failed += 1;
    continue;
  }
  var problems = [];
  var i;
  for (i = 0; i < item[2].length; i += 1) {
    if (output.indexOf(item[2][i]) === -1) problems.push('missing <<' + item[2][i] + '>>');
  }
  for (i = 0; i < item[3].length; i += 1) {
    if (output.indexOf(item[3][i]) !== -1) problems.push('unexpected <<' + item[3][i] + '>>');
  }
  if (problems.length) {
    WScript.Echo('[FAIL] ' + item[0]);
    WScript.Echo('       in : ' + item[1]);
    WScript.Echo('       out: ' + output);
    WScript.Echo('       why: ' + problems.join(' | '));
    failed += 1;
  } else {
    WScript.Echo('[OK]   ' + item[0]);
    passed += 1;
  }
}

WScript.Echo('');
WScript.Echo('passed ' + passed + ' / failed ' + failed + ' / total ' + CASES.length);
WScript.Quit(failed === 0 ? 0 : 1);

