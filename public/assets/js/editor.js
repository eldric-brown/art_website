// ============================================================
// editor.js - 零依赖富文本编辑器（contentEditable + execCommand）
// ============================================================
// 用法：
//   const ed = window.RTE.mount(document.getElementById('box'), {
//     value: '<p>初始内容</p>',
//     placeholder: '从这里开始写……',
//     onMessage: function (msg, type) {},   // 提示回调（后台传 toast）
//     onChange:  function (editor) {}       // 内容变化回调
//   });
//   ed.getValue() / ed.getPlain() / ed.getImageCount()
//   ed.isEmpty() / ed.setValue(html) / ed.focus()
//
// 约定：
//   · 图片只能填直链 URL（R2 上传上线后把「图片」按钮换成文件选择器即可）
//   · 粘贴一律转纯文本，避免把外部网页的 CSS 带进站内
//   · 拖拽图片被禁用（会生成 blob: 地址，前台 CSP 与后端都会拒绝）
//   · 输出的 class 全部来自下方 CLASSES，服务端还会再过滤一遍
//
// ⚠️ CLASSES 必须与 functions/_lib/html.js 的 ALLOWED_CLASSES、
//    public/assets/styles/rich.css 保持同步。
// ============================================================

window.RTE = (function () {
  'use strict';

  const CLASSES = [
    'text-center', 'text-right',
    'text-small', 'text-lg', 'text-xl',
    'text-muted', 'text-accent',
    'font-serif', 'font-caps',
    'img-full', 'img-half', 'img-center', 'img-square', 'img-plain',
    'columns-2', 'columns-3', 'column',
    'box-accent', 'box-note', 'box-quote',
    'mt-lg', 'mb-lg', 'no-margin'
  ];

  const IMAGE_SIZES = ['img-full', 'img-half', 'img-center', 'img-square', 'img-plain'];
  const ALIGN_CLASSES = ['text-center', 'text-right'];
  const SPACE_CLASSES = ['mt-lg', 'mb-lg', 'no-margin'];
  const BLOCK_TAGS = { P: 1, DIV: 1, LI: 1, BLOCKQUOTE: 1, H1: 1, H2: 1, H3: 1, H4: 1, FIGCAPTION: 1 };

  // 与服务端 functions/_lib/html.js 的 IMAGE_RE / LINK_RE 保持一致
  const IMAGE_RE = /^(?:https:\/\/[^\s'"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'"<>]*|\/r2\/artworks\/[^\s'"<>]*)$/i;
  const LINK_RE = /^(?:https:\/\/[^\s'"<>]+|http:\/\/(?:127\.0\.0\.1|localhost):\d+[^\s'"<>]*|#\/?[^\s'"<>]*|\/[^/\s'"<>][^\s'"<>]*)$/i;
  const MAX_URL_LENGTH = 1024;

  // 同一次编辑只允许打开一个弹窗
  let activeDialog = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isValidImageUrl(url) {
    const value = String(url == null ? '' : url).trim();
    return value.length > 0 && value.length <= MAX_URL_LENGTH && IMAGE_RE.test(value);
  }

  function isValidLinkUrl(url) {
    const value = String(url == null ? '' : url).trim();
    return value.length > 0 && value.length <= MAX_URL_LENGTH && LINK_RE.test(value);
  }

  // 从图片文件名猜一个 alt，纯优化不是必须
  function guessAlt(url) {
    const match = String(url).match(/\/([^\/?#]+)\.(?:jpg|jpeg|png|gif|webp|svg|avif|bmp|tif|tiff)$/i);
    return match ? match[1].replace(/[-_]+/g, ' ').slice(0, 80) : '';
  }

  function isEmptyEditor(editor) {
    if (editor.querySelector('img, table, hr')) return false;
    return String(editor.textContent || '').trim().length === 0;
  }

  function syncPlaceholder(instance) {
    if (isEmptyEditor(instance.editor)) instance.editor.classList.add('is-empty');
    else instance.editor.classList.remove('is-empty');
  }

  // 工具栏按钮被点中会抢焦点、选区可能丢失，所以先存一次、执行前恢复
  function saveSelection(instance) {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) { instance._saved = null; return; }
    const range = sel.getRangeAt(0);
    if (!instance.editor.contains(range.commonAncestorContainer)) { instance._saved = null; return; }
    instance._saved = range.cloneRange();
  }

  function restoreSelection(instance) {
    const saved = instance._saved;
    if (!saved) return false;
    if (!instance.editor.contains(saved.commonAncestorContainer)) return false;
    const sel = document.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(saved);
    return true;
  }

  // ============================================================
  // 挂载编辑器
  // ============================================================
  function mount(target, options) {
    options = options || {};
    target.innerHTML = '';
    target.classList.add('rte');

    const toolbar = document.createElement('div');
    toolbar.className = 'rte-toolbar';
    toolbar.setAttribute('role', 'toolbar');

    const editor = document.createElement('div');
    editor.className = 'rte-editor research-body';
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('spellcheck', 'true');
    editor.setAttribute('data-placeholder', options.placeholder || '');
    editor.innerHTML = String(options.value == null ? '' : options.value);

    target.appendChild(toolbar);
    target.appendChild(editor);

    const instance = {
      toolbar: toolbar,
      editor: editor,
      _saved: null,
      _selectedImage: null,
      _options: options,
      getValue: function () { return editor.innerHTML; },
      getPlain: function () { return String(editor.innerText || editor.textContent || '').trim(); },
      getImageCount: function () { return editor.querySelectorAll('img').length; },
      isEmpty: function () { return isEmptyEditor(editor); },
      setValue: function (html) {
        editor.innerHTML = String(html == null ? '' : html);
        instance._saved = null;
        instance._selectedImage = null;
        syncPlaceholder(instance);
        return instance;
      },
      focus: function () { editor.focus(); }
    };

    function emitChange() {
      syncPlaceholder(instance);
      if (options.onChange) options.onChange(instance);
    }

    editor.addEventListener('input', emitChange);
    editor.addEventListener('blur', function () { saveSelection(instance); });
    editor.addEventListener('keyup', function () { saveSelection(instance); });
    editor.addEventListener('mouseup', function () { saveSelection(instance); });

    // 点选图片：记住这张图，尺寸按钮就作用在它上面（比“猜光标位置”可靠）
    editor.addEventListener('click', function (event) {
      const el = event.target;
      if (!el || el.nodeType !== 1 || el.tagName !== 'IMG') return;
      instance._selectedImage = el;
      editor.querySelectorAll('img').forEach(function (node) { node.classList.remove('rte-img-selected'); });
      el.classList.add('rte-img-selected');
    });

    // 粘贴一律转纯文本，按换行拆段
    editor.addEventListener('paste', function (event) {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;

      const data = event.clipboardData || window.clipboardData;
      const text = String((data && data.getData('text/plain')) || '').replace(/\r\n/g, '\n');
      if (!text) return;

      event.preventDefault();
      range.deleteContents();
      const parts = text.split('\n');
      for (let i = 0; i < parts.length; i += 1) {
        if (i > 0) document.execCommand('insertParagraph', false, null);
        const piece = parts[i].replace(/\s/g, ' ');
        if (piece) document.execCommand('insertText', false, piece);
      }
      emitChange();
    });

    // 禁用拖拽：本地图片会变成 blob: 地址，前台 CSP 与后端都会拒绝
    editor.addEventListener('dragover', function (event) { event.preventDefault(); });
    editor.addEventListener('drop', function (event) {
      event.preventDefault();
      if (options.onMessage) options.onMessage('图片请用工具栏「图片」按钮粘贴直链地址', 'info');
    });

    buildToolbar(toolbar, instance, emitChange);
    syncPlaceholder(instance);
    return instance;
  }

  // ============================================================
  // 工具栏
  // ============================================================
  const BLOCK_TEMPLATES = {
    hr: '<hr><p><br></p>',
    twoColumns: '<div class="columns-2"><div class="column"><p><br></p></div><div class="column"><p><br></p></div></div><p><br></p>',
    threeColumns: '<div class="columns-3"><div class="column"><p><br></p></div><div class="column"><p><br></p></div><div class="column"><p><br></p></div></div><p><br></p>',
    boxAccent: '<div class="box-accent"><p><br></p></div><p><br></p>',
    boxNote: '<div class="box-note"><p><br></p></div><p><br></p>',
    boxQuote: '<div class="box-quote"><p><br></p></div><p><br></p>'
  };

  function buildToolbar(toolbar, instance, emitChange) {
    const options = instance._options;
    const editor = instance.editor;

    function msg(message, type) {
      if (options.onMessage) options.onMessage(message, type || 'info');
    }

    // 恢复选区后执行一条 execCommand
    function run(command, value) {
      editor.focus();
      if (!restoreSelection(instance)) return;
      try { document.execCommand(command, false, value == null ? null : value); }
      catch (error) { console.warn('execCommand failed:', command, error); }
      emitChange();
    }

    function block(tag) { run('formatBlock', '<' + tag + '>'); }

    function clearFormatting() {
      editor.focus();
      if (!restoreSelection(instance)) return;
      try {
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
        document.execCommand('formatBlock', false, '<p>');
      } catch (error) { console.warn('clear formatting failed:', error); }
      emitChange();
    }

    // 把选中的文字包进 <span class="...">
    function wrapClass(cls) {
      editor.focus();
      if (!restoreSelection(instance)) return;
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        msg('请先选中要改样式的文字');
        return;
      }
      const range = sel.getRangeAt(0);
      const wrap = document.createElement('span');
      wrap.className = cls;
      try {
        range.surroundContents(wrap);
      } catch (error) {
        // 选中跨多个节点时 surroundContents 会失败：改为提取内容再包裹
        const fragment = range.extractContents();
        wrap.appendChild(fragment);
        range.insertNode(wrap);
      }
      const next = document.getSelection();
      if (next) next.removeAllRanges();
      emitChange();
    }

    // 把 class 加到光标所在的整块（段落 / 列表项 / 引用……）
    function applyClassToBlock(cls, siblings) {
      editor.focus();
      if (!restoreSelection(instance)) return;
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) { msg('请先点进正文再设置'); return; }
      let node = sel.getRangeAt(0).startContainer;
      if (node.nodeType === 3) node = node.parentNode;
      let block = null;
      let current = node;
      while (current && current !== editor) {
        if (current.nodeType === 1 && BLOCK_TAGS[current.tagName]) { block = current; break; }
        current = current.parentNode;
      }
      if (!block) { msg('请把光标放在一个段落里再设置'); return; }
      for (let i = 0; i < siblings.length; i += 1) {
        if (siblings[i] !== cls) block.classList.remove(siblings[i]);
      }
      block.classList.add(cls);
      emitChange();
    }

    // 给点选中的图片切换尺寸 class
    function applyClassToImage(cls) {
      const img = instance._selectedImage;
      if (!img || !editor.contains(img)) {
        msg('请先在正文里点选一张图片，再设置尺寸');
        return;
      }
      for (let i = 0; i < IMAGE_SIZES.length; i += 1) {
        if (IMAGE_SIZES[i] !== cls) img.classList.remove(IMAGE_SIZES[i]);
      }
      img.classList.add(cls);
      emitChange();
    }

    function insertHtml(html) { run('insertHTML', html); }

    function insertBlock(key) { insertHtml(BLOCK_TEMPLATES[key]); }

    // 插入图片：弹窗校验 URL，确认后插入 <img>
    function openImageDialog() {
      editor.focus();
      saveSelection(instance);
      openUrlDialog({
        title: '插入图片',
        help: '粘贴图片直链，支持 <code>https://</code> 开头的任意图床，或 <code>/r2/artworks/...</code> 本站资源。' +
              'R2 上传上线后会换成文件选择器。<br>插入后可点选图片，再用「图片尺寸」按钮调整。',
        placeholder: 'https://example.com/photo.jpg',
        okLabel: '插入图片',
        validate: isValidImageUrl,
        invalidMessage: '地址不合法：请填写 https:// 开头的图片直链（不含空格）；本地开发可用 http://localhost:8788/...',
        preview: function (url) { return '<img src="' + escapeHtml(url) + '" alt="">'; },
        onOk: function (url) {
          const alt = guessAlt(url);
          restoreSelection(instance);
          insertHtml('<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">');
          instance._selectedImage = null;
        }
      });
    }

    // 插入链接：支持 https 外链与站内 #/xxx、/xxx
    function openLinkDialog() {
      editor.focus();
      saveSelection(instance);
      const sel = document.getSelection();
      let currentHref = '';
      if (sel && sel.rangeCount) {
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;
        const link = (node && node.closest) ? node.closest('a') : null;
        if (link) currentHref = link.getAttribute('href') || '';
      }
      openUrlDialog({
        title: currentHref ? '编辑链接' : '插入链接',
        help: '可填 <code>https://</code> 外链，或站内地址如 <code>#/works/12</code>、<code>/about</code>。',
        placeholder: 'https://...   或   #/works/12',
        value: currentHref,
        okLabel: '确定',
        validate: isValidLinkUrl,
        invalidMessage: '地址不合法：只允许 https:// 外链，或 #/xxx、/xxx 站内地址',
        onOk: function (url) {
          restoreSelection(instance);
          if (sel && sel.rangeCount && !sel.isCollapsed) {
            run('createLink', url);
          } else {
            insertHtml('<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>');
          }
        }
      });
    }

    // 按钮定义：[分组, 按钮内容(HTML), 提示文字, 点击动作]
    function btn(group, label, title, action) { return [group, label, title, action]; }
    function t(text) { return '<span class="rte-icon-txt">' + text + '</span>'; }

    const buttons = [
      btn('段落', t('正文'), '正文段落', function () { block('p'); }),
      btn('段落', t('H2'), '大标题', function () { block('h2'); }),
      btn('段落', t('H3'), '小标题', function () { block('h3'); }),
      btn('段落', t('“ ”'), '引用段落', function () { block('blockquote'); }),

      btn('文字', '<strong>B</strong>', '加粗', function () { run('bold'); }),
      btn('文字', '<em>I</em>', '斜体', function () { run('italic'); }),
      btn('文字', '<span class="u">U</span>', '下划线', function () { run('underline'); }),
      btn('文字', '<span class="s">S</span>', '删除线', function () { run('strikeThrough'); }),
      btn('文字', t('清除格式'), '清除所选文字的字体、颜色与链接', clearFormatting),

      btn('列表', t('• 列表'), '无序列表', function () { run('insertUnorderedList'); }),
      btn('列表', t('1. 列表'), '有序列表', function () { run('insertOrderedList'); }),
      btn('列表', t('— —'), '插入分隔线', function () { insertBlock('hr'); }),

      btn('链接与图片', t('链接'), '为所选文字添加链接', openLinkDialog),
      btn('链接与图片', t('图片'), '插入图片直链 URL', openImageDialog),

      btn('文字样式', t('小字'), '文字改小', function () { wrapClass('text-small'); }),
      btn('文字样式', t('大字'), '文字加大', function () { wrapClass('text-lg'); }),
      btn('文字样式', t('特大'), '文字特大', function () { wrapClass('text-xl'); }),
      btn('文字样式', t('弱化'), '弱化色（灰色）', function () { wrapClass('text-muted'); }),
      btn('文字样式', t('强调'), '强调色（主题色）', function () { wrapClass('text-accent'); }),
      btn('文字样式', t('衬线'), '宋体', function () { wrapClass('font-serif'); }),
      btn('文字样式', t('标签体'), '小号大写字距', function () { wrapClass('font-caps'); }),

      btn('对齐与间距', t('居中'), '整段居中', function () { applyClassToBlock('text-center', ALIGN_CLASSES); }),
      btn('对齐与间距', t('右对齐'), '整段右对齐', function () { applyClassToBlock('text-right', ALIGN_CLASSES); }),
      btn('对齐与间距', t('↑ 段前距'), '段落上方加大间距', function () { applyClassToBlock('mt-lg', SPACE_CLASSES); }),
      btn('对齐与间距', t('↓ 段后距'), '段落下方加大间距', function () { applyClassToBlock('mb-lg', SPACE_CLASSES); }),

      btn('图片尺寸', t('全宽'), '图片占满整行（先点选图片）', function () { applyClassToImage('img-full'); }),
      btn('图片尺寸', t('半宽'), '图片占一半宽（先点选图片）', function () { applyClassToImage('img-half'); }),
      btn('图片尺寸', t('居中图'), '图片居中显示（先点选图片）', function () { applyClassToImage('img-center'); }),
      btn('图片尺寸', t('方图'), '图片裁成正方形（先点选图片）', function () { applyClassToImage('img-square'); }),
      btn('图片尺寸', t('直角'), '去掉图片圆角（先点选图片）', function () { applyClassToImage('img-plain'); }),

      btn('布局块', t('两列'), '插入两列布局', function () { insertBlock('twoColumns'); }),
      btn('布局块', t('三列'), '插入三列布局', function () { insertBlock('threeColumns'); }),
      btn('布局块', t('强调块'), '插入主题色强调块', function () { insertBlock('boxAccent'); }),
      btn('布局块', t('备注块'), '插入浅底备注块', function () { insertBlock('boxNote'); }),
      btn('布局块', t('引言块'), '插入衬线引言块', function () { insertBlock('boxQuote'); })
    ];

    const groups = {};
    buttons.forEach(function (item) {
      if (!groups[item[0]]) groups[item[0]] = [];
      groups[item[0]].push(item);
    });

    Object.keys(groups).forEach(function (name) {
      const wrap = document.createElement('div');
      wrap.className = 'rte-toolbar-group';

      const label = document.createElement('span');
      label.className = 'rte-toolbar-label';
      label.textContent = name;
      wrap.appendChild(label);

      groups[name].forEach(function (item) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'rte-btn';
        element.title = item[2];
        element.innerHTML = item[1];
        // 阻止 mousedown 默认行为：避免编辑区失焦导致选区丢失
        element.addEventListener('mousedown', function (event) { event.preventDefault(); });
        element.addEventListener('click', function (event) {
          event.preventDefault();
          try { item[3](); }
          catch (error) { console.error('toolbar action failed:', item[2], error); }
        });
        wrap.appendChild(element);
      });

      toolbar.appendChild(wrap);
    });
  }

  // ============================================================
  // 地址输入弹窗（图片 / 链接共用）
  // opts.help 允许传已转义的 HTML（里面可以放 <code>、<br>）
  // ============================================================
  function openUrlDialog(opts) {
    if (activeDialog) return;

    const overlay = document.createElement('div');
    overlay.className = 'rte-dialog-overlay';
    overlay.innerHTML =
      '<div class="rte-dialog" role="dialog" aria-modal="true">' +
        '<div class="rte-dialog-header">' +
          '<h4>' + escapeHtml(opts.title || '') + '</h4>' +
          '<button type="button" class="rte-dialog-close" aria-label="关闭">×</button>' +
        '</div>' +
        (opts.help ? '<p class="rte-dialog-help">' + opts.help + '</p>' : '') +
        '<input type="text" class="rte-dialog-input" autocomplete="off" spellcheck="false"' +
          ' placeholder="' + escapeHtml(opts.placeholder || '') + '"' +
          ' value="' + escapeHtml(opts.value || '') + '">' +
        (opts.preview ? '<div class="rte-dialog-preview" hidden></div>' : '') +
        '<div class="rte-dialog-error" hidden></div>' +
        '<div class="rte-dialog-actions">' +
          '<button type="button" class="rte-dialog-cancel btn">取消</button>' +
          '<button type="button" class="rte-dialog-ok btn btn-primary">' + escapeHtml(opts.okLabel || '确定') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    activeDialog = overlay;

    // 绑定监听期间如果抛错，必须把弹窗和键盘监听一并清掉
    try {
      var initOk = initDialog(overlay);
    } catch (error) {
      console.error('rte dialog init failed:', error);
      initOk = false;
    }
    if (!initOk) closeDialog(overlay);

    return initOk;

    // 关掉弹窗：清掉引用、键盘监听与 DOM（重复调用安全）
    function closeDialog(node) {
      if (!node) return;
      if (activeDialog === node) activeDialog = null;
      if (node._rteOnKeydown) {
        document.removeEventListener('keydown', node._rteOnKeydown);
        node._rteOnKeydown = null;
      }
      if (node.parentNode) node.remove();
    }

    function initDialog(node) {
      const input = node.querySelector('.rte-dialog-input');
      const errorBox = node.querySelector('.rte-dialog-error');
      const previewBox = node.querySelector('.rte-dialog-preview');
      if (!input) return false;

      function showError(text) {
        if (!errorBox) return;
        if (!text) { errorBox.hidden = true; errorBox.textContent = ''; return; }
        errorBox.hidden = false;
        errorBox.textContent = text;
      }

      function submit() {
        const value = String(input.value || '').trim();
        if (!value) { showError('请填写地址'); input.focus(); return; }
        if (!opts.validate || !opts.validate(value)) {
          showError(opts.invalidMessage || '地址格式不正确');
          input.focus();
          return;
        }
        closeDialog(node);
        if (opts.onOk) opts.onOk(value);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') { event.preventDefault(); closeDialog(node); }
        else if (event.key === 'Enter' && event.target === input) { event.preventDefault(); submit(); }
      }
      node._rteOnKeydown = onKeydown;

      function onInput() {
        showError('');
        if (!opts.preview || !previewBox) return;
        const value = String(input.value || '').trim();
        if (!value || !opts.validate || !opts.validate(value)) {
          previewBox.hidden = true;
          previewBox.innerHTML = '';
          return;
        }
        previewBox.hidden = false;
        previewBox.innerHTML = opts.preview(value);
      }

      node.addEventListener('click', function (event) {
        if (event.target === node) closeDialog(node);
      });
      node.querySelector('.rte-dialog-close').addEventListener('click', function () { closeDialog(node); });
      node.querySelector('.rte-dialog-cancel').addEventListener('click', function () { closeDialog(node); });
      node.querySelector('.rte-dialog-ok').addEventListener('click', submit);
      input.addEventListener('input', onInput);
      document.addEventListener('keydown', onKeydown);

      input.focus();
      input.select();
      return true;
    }
  }

  return {
    mount: mount,
    isValidImageUrl: isValidImageUrl,
    isValidLinkUrl: isValidLinkUrl,
    CLASSES: CLASSES.slice()
  };
})();