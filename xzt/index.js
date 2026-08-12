document.addEventListener('DOMContentLoaded', function () {
    // ---------- DOM 元素 ----------
    const editor = document.getElementById('editor');
    const readDisplay = document.getElementById('read');
    const readStats = document.getElementById('readStats');
    const docList = document.getElementById('doc-list');
    const mobileDocList = document.getElementById('mobile-doc-list');
    const newDocBtn = document.getElementById('newDocBtn');
    const mobileNewDocBtn = document.getElementById('mobileNewDocBtn');
    const mobileDocBtn = document.getElementById('mobileDocBtn');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileDrawerClose = document.getElementById('mobileDrawerClose');
    const scrollTopButton = document.getElementById('scrollTopButton');
    const cleanMarkdownButton = document.getElementById('cleanMarkdown');
    const numBigButton = document.getElementById('numBigButton');
    const copyButton = document.getElementById('copyButton');
    const clearButton = document.getElementById('clearButton');
    const xhButton = document.getElementById('xh');
    const exportImgButton = document.getElementById('exportImgButton');
    const archiveButton = document.getElementById('archiveButton');
    const boldButton = document.getElementById('boldButton');
    const authorInput = document.getElementById('authorInput');
    const sloganInput = document.getElementById('sloganInput');
    const qrToggleButton = document.getElementById('qrToggleButton');
    const exportModal = document.getElementById('export-modal');
    const exportModalClose = document.getElementById('exportModalClose');
    const exportConfirmBtn = document.getElementById('exportConfirmBtn');
    const promptToggleButton = document.getElementById('promptToggleButton');

    // 提示词 - PC端
    const promptModal = document.getElementById('prompt-modal');
    const promptModalClose = document.getElementById('promptModalClose');
    const promptSelect = document.getElementById('promptSelect');
    const promptCopyBtn = document.getElementById('promptCopyBtn');

    // 提示词 - 手机端
    const promptMobileOverlay = document.getElementById('prompt-mobile-overlay');
    const promptMobileDrawer = document.getElementById('prompt-mobile-drawer');
    const promptMobileClose = document.getElementById('promptMobileClose');
    const promptMobileSelect = document.getElementById('promptMobileSelect');
    const promptMobileCopyBtn = document.getElementById('promptMobileCopyBtn');


    // ---------- 数据模型 ----------
    const STORAGE_KEY = 'xzt';
    let docs = [];
    let currentId = null;
    let undoStacks = {};
    var EXPORT_CONFIG = null;     // 从 config/export-config.json 加载
    var DEFAULT_PROMPTS = [];     // 从 config/prompts.json 加载
    let author = '';
    let slogan = '';
    const MAX_UNDO = 50;

    // ---------- 工具函数 ----------
    function generateId() {
        return Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function getFirstNonEmptyLine(text) {
        const lines = text.split('\n');
        for (let line of lines) {
            if (line.trim()) return line.trim();
        }
        return '无标题';
    }

    // ---------- 加载配置（通过 <script src> 全局变量，兼容 file:// 协议）----------
    function loadConfigs() {
        if (typeof window.EXPORT_CONFIG !== 'undefined') EXPORT_CONFIG = window.EXPORT_CONFIG;
        if (typeof window.DEFAULT_PROMPTS !== 'undefined') DEFAULT_PROMPTS = window.DEFAULT_PROMPTS;
    }

    // ---------- 用 JSON 配置填充下拉框 ----------
    function fillSelectOptions() {
        if (EXPORT_CONFIG && EXPORT_CONFIG.authors && authorInput) {
            authorInput.innerHTML = '';
            EXPORT_CONFIG.authors.forEach(function (a) {
                var opt = document.createElement('option');
                opt.value = a.value;
                opt.textContent = a.short;
                authorInput.appendChild(opt);
            });
        }
        if (EXPORT_CONFIG && EXPORT_CONFIG.slogans && sloganInput) {
            sloganInput.innerHTML = '';
            EXPORT_CONFIG.slogans.forEach(function (s) {
                var opt = document.createElement('option');
                opt.value = s.value;
                opt.textContent = s.short;
                sloganInput.appendChild(opt);
            });
        }
    }

    // ---------- 编辑器内容读写 ----------
    function getEditorContent() {
        return editor.innerText.replace(/\n{3,}/g, '\n\n');
    }

    function getEditorHTML() {
        return editor.innerHTML;
    }

    function setEditorContent(content) {
        if (typeof content === 'string' && /<[a-z][\s\S]*>/i.test(content)) {
            // 剥离旧 <a> 标签（保留文本），再统一转换 URL 为可点击链接
            content = content.replace(/<a[^>]*>([\s\S]*?)<\/a>/g, '$1');
            content = content.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
            editor.innerHTML = content;
        } else {
            const withLinks = (content || '').replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
            editor.innerHTML = withLinks.replace(/\n/g, '<br>');
        }
    }

    // ---------- 光标位置保存 / 恢复（基于 innerText 字符偏移） ----------
    function saveCaret() {
        try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return null;
            const range = sel.getRangeAt(0);
            if (!editor.contains(range.startContainer)) return null;
            const preRange = document.createRange();
            preRange.selectNodeContents(editor);
            preRange.setEnd(range.startContainer, range.startOffset);
            return preRange.toString().length;
        } catch (err) {
            return null;
        }
    }

    function mapCaretOffsetAcrossTransform(oldText, newText, oldOffset) {
        try {
            oldText = oldText || '';
            newText = newText || '';
            if (oldOffset == null) return (newText || '').length;
            const safeOld = Math.max(0, Math.min(oldOffset, oldText.length));
            if (oldText === newText) return safeOld;
            const oldPrefix = oldText.substring(0, safeOld);
            const normOldPrefix = normalizeForSearch(oldPrefix);
            const normNew = normalizeForSearch(newText);
            const normPos = Math.max(0, Math.min(normOldPrefix.length, normNew.length));
            return findRealPosition(newText, normNew, normPos);
        } catch (err) {
            return (newText || '').length;
        }
    }

    function restoreCaret(offset) {
        try {
            if (offset == null) return;
            editor.focus();
            const sel = window.getSelection();
            if (!sel) return;
            const fullText = editor.innerText || '';
            const target = Math.max(0, Math.min(offset, fullText.length));
            let walked = 0;
            const stack = [editor];
            let foundNode = null;
            let foundOffset = 0;
            while (stack.length > 0) {
                const node = stack.pop();
                if (node.nodeType === Node.TEXT_NODE) {
                    const len = node.nodeValue.length;
                    if (walked + len >= target) {
                        foundNode = node;
                        foundOffset = target - walked;
                        break;
                    }
                    walked += len;
                } else if (node.nodeName === 'BR') {
                    if (walked + 1 >= target) {
                        foundNode = node.parentNode;
                        foundOffset = Array.prototype.indexOf.call(node.parentNode.childNodes, node);
                        break;
                    }
                    walked += 1;
                } else {
                    const children = node.childNodes;
                    for (let i = children.length - 1; i >= 0; i--) {
                        stack.push(children[i]);
                    }
                }
            }
            if (!foundNode) {
                const last = editor.lastChild;
                if (last && last.nodeType === Node.TEXT_NODE) {
                    foundNode = last;
                    foundOffset = last.nodeValue.length;
                } else {
                    foundNode = editor;
                    foundOffset = editor.childNodes.length;
                }
            }
            const newRange = document.createRange();
            newRange.setStart(foundNode, foundOffset);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } catch (err) {
            /* ignore */
        }
    }

    // ---------- 加载 / 保存数据 ----------
    function loadDocs() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // 检查是否为新格式（包含 docs 和 currentId）
                if (parsed && parsed.docs && Array.isArray(parsed.docs)) {
                    docs = parsed.docs;
                    // 如果 currentId 存在且有效，则使用；否则取第一个文档的 id
                    if (parsed.currentId && docs.some(d => d.id === parsed.currentId)) {
                        currentId = parsed.currentId;
                    } else if (docs.length > 0) {
                        currentId = docs[0].id;
                    } else {
                        // 如果 docs 为空，创建默认文档
                        const id = generateId();
                        docs = [{ id: id, title: '无标题', content: '' }];
                        currentId = id;
                    }
                    // 读取作者名（新字段）；若无，则尝试从旧 xzt_author 字段迁移
                    author = typeof parsed.author === 'string' ? parsed.author : '';
                    if (!author) {
                        var legacy = localStorage.getItem('xzt_author');
                        if (legacy) {
                            author = legacy.trim();
                        }
                    }
                    // 读取 slogan
                    slogan = typeof parsed.slogan === 'string' ? parsed.slogan : '';
                    // 初始化撤销栈
                    docs.forEach(doc => {
                        if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
                    });
                    saveDocs(); // 确保 author 字段写入 xzt，并清除旧的 xzt_author
                    return;
                }
            } catch (e) {
                // JSON 解析失败，作为旧格式（纯文本）处理
            }
            // 如果数据不是 JSON 或解析失败，作为旧格式（纯文本）处理
            const id = generateId();
            const title = getFirstNonEmptyLine(raw);
            docs = [{ id: id, title: title, content: raw }];
            currentId = id;
            // 尝试从旧 xzt_author 迁移
            var legacy2 = localStorage.getItem('xzt_author');
            author = legacy2 ? legacy2.trim() : '';
            saveDocs(); // 转换为新格式保存
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
            return;
        }

        // 没有任何数据，尝试从旧 xzt_author 迁移作者名
        var legacy3 = localStorage.getItem('xzt_author');
        if (legacy3) author = legacy3.trim();

        // 没有任何数据，创建默认文档
        if (docs.length === 0) {
            const id = generateId();
            docs = [{ id: id, title: '无标题', content: '' }];
            currentId = id;
            saveDocs();
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
        }
    }

    function saveDocs() {
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const payload = {
            docs: docs,
            currentId: currentId,
            author: author,
            slogan: slogan,
            qrEnabled: existing.qrEnabled !== undefined ? existing.qrEnabled : true,
            prompts: existing.prompts || [],
            currentPromptId: existing.currentPromptId !== undefined ? existing.currentPromptId : null
        };
        const data = JSON.stringify(payload);
        localStorage.setItem(STORAGE_KEY, data);
        // 新字段已写入 xzt，清除旧的 xzt_author 避免双写
        if (localStorage.getItem('xzt_author') !== null) {
            try { localStorage.removeItem('xzt_author'); } catch (_) { }
        }
    }

    function getCurrentDoc() {
        return docs.find(d => d.id === currentId);
    }

    // ---------- 保存当前文档内容 ----------
    function saveCurrentContent() {
        const doc = getCurrentDoc();
        if (!doc) return;
        const html = editor.innerHTML;
        if (doc.content !== html) {
            doc.content = html;
            const newTitle = getFirstNonEmptyLine(editor.innerText);
            if (doc.title !== newTitle) {
                doc.title = newTitle;
            }
            saveDocs();
            renderLists();
        }
    }

    // ---------- 切换文档 ----------
    function switchDoc(id) {
        if (id === currentId) return;
        saveCurrentContent();
        if (currentId) {
            undoStacks[currentId] = undoStacks[currentId] || [];
        }
        currentId = id;
        const doc = getCurrentDoc();
        if (doc) {
            setEditorContent(doc.content);
            if (!undoStacks[id]) undoStacks[id] = [];
            updateReadTime();
            renderLists();
            highlightActive();
            editor.scrollTop = 0;
            editor.focus();
        }
        saveDocs();
    }

    // ---------- 新建文档 ----------
    function createNewDoc() {
        const id = generateId();
        const newDoc = { id: id, title: '无标题', content: '' };
        docs.push(newDoc);
        undoStacks[id] = [];
        currentId = id;
        setEditorContent('');
        updateReadTime();
        saveDocs();
        renderLists();
        highlightActive();
        editor.focus();
        closeMobileDrawer();
    }

    // ---------- 删除文档 ----------
    function deleteDoc(id) {
        if (docs.length <= 1) {
            showAutoCloseAlert('至少保留一个文档');
            return;
        }
        if (!confirm('确定删除此文档吗？')) return;
        const idx = docs.findIndex(d => d.id === id);
        if (idx === -1) return;
        docs.splice(idx, 1);
        delete undoStacks[id];
        if (currentId === id) {
            currentId = docs[0].id;
            const doc = docs[0];
            setEditorContent(doc.content);
            updateReadTime();
            if (!undoStacks[currentId]) undoStacks[currentId] = [];
        }
        saveDocs();
        renderLists();
        highlightActive();
        closeMobileDrawer();
    }

    // ---------- 渲染列表 ----------
    function renderLists() {
        renderList(docList, 'doc-item', 'doc-delete');
        renderList(mobileDocList, 'mobile-doc-item', 'doc-delete');
    }

    function renderList(container, itemClass, deleteClass) {
        if (!container) return;
        container.innerHTML = '';
        docs.forEach(doc => {
            const div = document.createElement('div');
            div.className = itemClass;
            if (doc.id === currentId) div.classList.add('active');

            const titleSpan = document.createElement('span');
            titleSpan.className = 'doc-title';
            titleSpan.textContent = doc.title;
            div.appendChild(titleSpan);

            const delBtn = document.createElement('button');
            delBtn.className = deleteClass;
            delBtn.textContent = '×';
            delBtn.title = '删除';
            delBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteDoc(doc.id);
            });
            div.appendChild(delBtn);

            div.addEventListener('click', function () {
                switchDoc(doc.id);
                closeMobileDrawer();
            });

            container.appendChild(div);
        });
    }

    function highlightActive() {
        renderLists();
    }

    // ---------- 浮层控制 ----------
    function openMobileDrawer() {
        mobileOverlay.classList.add('show');
        renderLists();
    }

    function closeMobileDrawer() {
        mobileOverlay.classList.remove('show');
    }

    // ---------- 字数统计 ----------
    function countWords(text) {
        const wordRegex = /[\u4e00-\u9fa5a-zA-Z0-9]+/g;
        const matches = text.match(wordRegex);
        return matches ? matches.join('').length : 0;
    }

    function madeReadTime(wordCount) {
        return Number((wordCount / 350).toFixed(1));
    }

    function updateReadTime() {
        const text = getEditorContent();
        const wordCount = countWords(text);
        const readTime = madeReadTime(wordCount);
        if (readStats) readStats.textContent = '全文 ' + wordCount + ' 字 预计 ' + readTime + ' 分钟';
    }

    // ---------- 置顶 ----------
    function scrollTop() {
        editor.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }

    // ---------- 撤销历史 ----------
    function saveState() {
        const id = currentId;
        if (!id) return;
        if (!undoStacks[id]) undoStacks[id] = [];
        const stack = undoStacks[id];
        const currentHTML = editor.innerHTML;
        if (stack.length > 0 && stack[stack.length - 1] === currentHTML) return;
        stack.push(currentHTML);
        if (stack.length > MAX_UNDO) stack.shift();
    }

    function undo() {
        const id = currentId;
        if (!id) return;
        const stack = undoStacks[id];
        if (!stack || stack.length === 0) {
            showAutoCloseAlert('没有可撤销的操作');
            return;
        }
        const prev = stack.pop();
        setEditorContent(prev);
        restoreCaret((editor.innerText || '').length);
        updateReadTime();
        saveCurrentContent();
        showAutoCloseAlert('已撤销');
    }

    // ---------- 快捷键 ----------
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'z' && document.activeElement === editor) {
            e.preventDefault();
            undo();
            return;
        }
        if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
            e.preventDefault();
            saveCurrentContent();
            showAutoCloseAlert('已保存');
            return;
        }
        if (e.altKey && e.key === '1') {
            e.preventDefault();
            scrollTop();
            return;
        }
        if (e.altKey && e.key === '4') {
            e.preventDefault();
            numBig();
            return;
        }
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            copy();
            return;
        }
    });

    // ---------- 数字加粗 ----------
    function numBig() {
        saveState();
        var doToggle = !localStorage.getItem('numBig');
        transformPreserveBold(function (text) {
            if (!text) return text;
            const urlRegex = /https?:\/\/[^\s]+/g;
            const urlPlaceholders = [];
            text = text.replace(urlRegex, function (match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });

            if (!doToggle) {
                text = text.replace(/𝟬/g, '0')
                    .replace(/𝟭/g, '1')
                    .replace(/𝟮/g, '2')
                    .replace(/𝟯/g, '3')
                    .replace(/𝟰/g, '4')
                    .replace(/𝟱/g, '5')
                    .replace(/𝟲/g, '6')
                    .replace(/𝟳/g, '7')
                    .replace(/𝟴/g, '8')
                    .replace(/𝟵/g, '9');
                text = text.replace(/𝗔|𝗕|𝗖|𝗗|𝗘|𝗙|𝗚|𝗛|𝗜|𝗝|𝗞|𝗟|𝗠|𝗡|𝗢|𝗣|𝗤|𝗥|𝗦|𝗧|𝗨|𝗩|𝗪|𝗫|𝗬|𝗭/g, function (char) {
                    const map = {
                        '𝗔': 'A', '𝗕': 'B', '𝗖': 'C', '𝗗': 'D', '𝗘': 'E', '𝗙': 'F', '𝗚': 'G', '𝗛': 'H',
                        '𝗜': 'I', '𝗝': 'J', '𝗞': 'K', '𝗟': 'L', '𝗠': 'M', '𝗡': 'N', '𝗢': 'O', '𝗣': 'P',
                        '𝗤': 'Q', '𝗥': 'R', '𝗦': 'S', '𝗧': 'T', '𝗨': 'U', '𝗩': 'V', '𝗪': 'W', '𝗫': 'X',
                        '𝗬': 'Y', '𝗭': 'Z'
                    };
                    return map[char] || char;
                });
            } else {
                text = text.split('').map(function (char) {
                    const boldMap = {
                        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
                        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
                        'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
                        'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
                        'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
                        'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭'
                    };
                    return boldMap[char] || char;
                }).join('');
            }

            text = text.replace(/[\uE000-\uE7FF]/g, function (ch) {
                const idx = ch.charCodeAt(0) - 0xE000;
                return urlPlaceholders[idx] || ch;
            });
            return text;
        });
        if (doToggle) localStorage.setItem('numBig', 1);
        else localStorage.removeItem('numBig');
    }

    // ---------- 通用：对文本做转换但保留加粗格式 ----------
    function transformPreserveBold(transformFn) {
        var caretOffset = saveCaret();
        var oldHTML = editor.innerHTML;
        var oldText = editor.innerText;

        // 1. 提取所有加粗文本
        var parser = new DOMParser();
        var doc = parser.parseFromString(oldHTML, 'text/html');
        var boldEls = doc.querySelectorAll('b, strong');
        var boldTexts = [];
        for (var i = 0; i < boldEls.length; i++) {
            var t = boldEls[i].innerText;
            if (t) boldTexts.push(t);
        }

        // 2. 对纯文本执行转换
        var newText = transformFn(oldText);

        // 3. 在新文本中定位原加粗内容（支持模糊匹配）
        // 按长度降序排，防止短文本先匹配导致长文本匹配错位
        boldTexts.sort(function (a, b) { return b.length - a.length; });

        var boldRanges = [];
        for (var i = 0; i < boldTexts.length; i++) {
            var searchText = boldTexts[i];
            if (!searchText) continue;

            // 尝试多种匹配策略
            var ranges = [];

            // 策略1：精确匹配
            var pos = 0;
            while ((pos = newText.indexOf(searchText, pos)) !== -1) {
                ranges.push({ start: pos, end: pos + searchText.length });
                pos += searchText.length;
            }

            // 策略2：去空格后匹配（适配排版在中英文间加空格的情况）
            if (ranges.length === 0) {
                var normalizedSearch = searchText.replace(/\s+/g, '');
                var normalizedTarget = newText.replace(/\s+/g, '');
                var npos = 0;
                while ((npos = normalizedTarget.indexOf(normalizedSearch, npos)) !== -1) {
                    // 在原 newText 中回溯定位真实位置
                    var realStart = findRealPosition(newText, normalizedTarget, npos);
                    var realEnd = findRealPosition(newText, normalizedTarget, npos + normalizedSearch.length);
                    if (realStart >= 0 && realEnd >= 0) {
                        ranges.push({ start: realStart, end: realEnd });
                    }
                    npos += normalizedSearch.length;
                }
            }

            // 策略3：逐字符归一化匹配（适配标点符号替换）
            if (ranges.length === 0) {
                var normSearch = normalizeForSearch(searchText);
                var normTarget = normalizeForSearch(newText);
                var n3pos = 0;
                while ((n3pos = normTarget.indexOf(normSearch, n3pos)) !== -1) {
                    var rs = findRealPosition(newText, normTarget, n3pos);
                    var re = findRealPosition(newText, normTarget, n3pos + normSearch.length);
                    if (rs >= 0 && re >= 0) {
                        ranges.push({ start: rs, end: re });
                    }
                    n3pos += normSearch.length;
                }
            }

            for (var r = 0; r < ranges.length; r++) {
                boldRanges.push(ranges[r]);
            }
        }

        // 4. 合并重叠区间
        if (boldRanges.length > 0) {
            boldRanges.sort(function (a, b) { return a.start - b.start; });
            var merged = [];
            for (var i = 0; i < boldRanges.length; i++) {
                if (merged.length > 0 && merged[merged.length - 1].end >= boldRanges[i].start) {
                    merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, boldRanges[i].end);
                } else {
                    merged.push({ start: boldRanges[i].start, end: boldRanges[i].end });
                }
            }
            boldRanges = merged;
        }

        // 5. 构建新 HTML（非加粗部分把 URL 转成可点击链接）
        function escapeHtmlAndLink(text) {
            var escaped = escapeHtml(text);
            return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
        }
        var result = '';
        var lastEnd = 0;
        for (var i = 0; i < boldRanges.length; i++) {
            result += escapeHtmlAndLink(newText.substring(lastEnd, boldRanges[i].start));
            result += '<b>' + escapeHtml(newText.substring(boldRanges[i].start, boldRanges[i].end)) + '</b>';
            lastEnd = boldRanges[i].end;
        }
        result += escapeHtmlAndLink(newText.substring(lastEnd));

        // escapeHtml 不会处理纯文本里的换行字符，这里手动替换成 <br>
        // 否则拼接出来的 result 里会有 \n 而不是 <br>，和 editor.innerHTML 格式对不上
        result = result.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>').replace(/\r/g, '<br>');

        // 文本内容没变化时不重写 DOM，光标直接不动，避免 Range 重建误差
        if (newText === oldText && result === oldHTML) {
            updateReadTime();
            saveCurrentContent();
            return;
        }

        setEditorContent(result);
        var newCaret = mapCaretOffsetAcrossTransform(oldText, newText, caretOffset);
        restoreCaret(newCaret);
        updateReadTime();
        saveCurrentContent();
    }

    // 归一化文本用于搜索：统一标点、空格
    function normalizeForSearch(text) {
        return text
            .replace(/,/g, '，').replace(/:/g, '：')
            .replace(/"/g, '」').replace(/“/g, '「').replace(/”/g, '」')
            .replace(/\s+/g, '')
            .toLowerCase();
    }

    // 从归一化位置映射回真实字符串位置
    function findRealPosition(original, normalized, normPos) {
        if (normPos <= 0) return 0;
        if (normPos >= normalized.length) return original.length;
        var normIdx = 0;
        for (var i = 0; i < original.length; i++) {
            var ch = original[i];
            // 跳过空格（归一化时被移除）
            if (/\s/.test(ch)) continue;
            // 跳过被归一化的标点
            var normCh = ch;
            if (ch === ',') normCh = '，';
            else if (ch === ':') normCh = '：';
            else if (ch === '"' || ch === '“' || ch === '”') normCh = '「';
            normCh = normCh.toLowerCase();

            if (normIdx >= normPos) return i;
            // 比较归一化字符
            var targetChar = normalized[normIdx];
            if (normCh === targetChar) {
                normIdx++;
                if (normIdx >= normPos) return i + 1;
            }
        }
        return original.length;
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // ---------- 排版 ----------
    function reformatText(saveHistory = true) {
        if (saveHistory) saveState();
        try {
            transformPreserveBold(function (text) {
                if (!text) return text;
                const urlRegex = /https?:\/\/[^\s]+/g;
                const urlPlaceholders = [];
                text = text.replace(urlRegex, function (match) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                });

                text = text.replace(/@[A-Za-z][A-Za-z\u4e00-\u9fa5]*|@[\u4e00-\u9fa5]+[A-Za-z]+/g, function (match) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                });
                text = text.replace(/[A-Za-z0-9]+/g, function (match) {
                    if (/[A-Za-z]/.test(match) && /\d/.test(match)) {
                        urlPlaceholders.push(match);
                        return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                    }
                    return match;
                });
                text = text.replace(/[A-Za-z]+[\u4e00-\u9fa5]+[A-Za-z]+/g, function (match) {
                    var engParts = match.match(/[A-Za-z]+/g);
                    var hasUppercase = engParts.some(function (p) { return p[0] >= 'A' && p[0] <= 'Z'; });
                    if (hasUppercase) {
                        urlPlaceholders.push(match);
                        return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                    }
                    return match;
                });
                text = text.replace(/[\u4e00-\u9fa5]{2,}[A-Z][a-z]+/g, function (match) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                });

                text = text.replace(/,/g, '，').replace(/:/g, '：');
                text = text.replace(/(\d+%?)-(\d+%?)/g, '$1~$2');
                text = text.replace(/。[ \t]*$/gm, '');
                text = text.replace(/([\u4e00-\u9fa5])([A-Za-z]+)/g, '$1 $2');
                text = text.replace(/([A-Za-z]+)([\u4e00-\u9fa5]+)/g, function (match, eng, chi) {
                    if (/^[a-z]+$/.test(eng)) return eng + ' ' + chi;
                    if (/^[A-Z]{2,}$/.test(eng)) return eng + ' ' + chi;
                    return match;
                });
                text = text.replace(/([\u4e00-\u9fa5])(\d)/g, '$1 $2');
                text = text.replace(/(\d)([\u4e00-\u9fa5])/g, '$1 $2');
                text = text.replace(/“/g, '「').replace(/”/g, '」');
                text = text.replace(/"([^"]+)"/g, '「$1」');
                text = text.replace(/%([\u4e00-\u9fa5])/g, '% $1');
                text = text.replace(/%\s+(?=[，,])/g, '%');
                text = text.replace(new RegExp('\\[语音开始\\]', 'g'), '');
                text = text.replace(new RegExp('\\[语音结束\\]', 'g'), '');
                text = text.replace(/^\s+/, '');

                text = text.replace(/([\u4e00-\u9fa5])([\uE000-\uE7FF])/g, '$1 $2');
                text = text.replace(/([\uE000-\uE7FF])([\u4e00-\u9fa5])/g, '$1 $2');
                text = text.replace(/(\d)([\uE000-\uE7FF])/g, '$1 $2');
                text = text.replace(/([\uE000-\uE7FF])(\d)/g, '$1 $2');
                text = text.replace(/([a-z])([\uE000-\uE7FF])/g, '$1 $2');
                text = text.replace(/([\uE000-\uE7FF])([a-z])/g, '$1 $2');

                text = text.replace(/[\uE000-\uE7FF]/g, function (ch) {
                    const idx = ch.charCodeAt(0) - 0xE000;
                    return urlPlaceholders[idx] || ch;
                });

                // 链接后补空行
                const lines = text.split('\n');
                const resultLines = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    resultLines.push(line);
                    if (/^\s*https?:\/\/\S+\s*$/.test(line)) {
                        const nextLine = lines[i + 1];
                        if (nextLine !== undefined && nextLine.trim() !== '') {
                            resultLines.push('');
                        }
                    }
                }
                text = resultLines.join('\n');

                // 压缩多余空行
                text = text.replace(/\n{3,}/g, '\n\n');
                return text;
            });
            showAutoCloseAlert('已美化保存');
        } catch (e) {
            showAutoCloseAlert('排版出错，请重试');
        }
    }

    // ---------- 复制（仅正文，外部按钮调用）----------
    async function copy() {
        var bodyContent = getEditorContent();
        try {
            await navigator.clipboard.writeText(bodyContent);
            showAutoCloseAlert('复制成功');
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = bodyContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showAutoCloseAlert('复制成功（降级方式）');
        }
    }

    // ---------- 复制提示词+正文（提示词面板内按钮调用）----------
    async function copyWithPrompt() {
        var selectedPrompt = getCurrentPrompt();
        var bodyContent = getEditorContent().replace(/\n{3,}/g, '\n\n');
        if (!selectedPrompt || !selectedPrompt.content) {
            showAutoCloseAlert('请先选择提示词');
            return;
        }
        var finalContent = selectedPrompt.content + bodyContent;
        try {
            await navigator.clipboard.writeText(finalContent);
            showAutoCloseAlert('已复制「' + selectedPrompt.title + '」+正文');
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = finalContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showAutoCloseAlert('已复制「' + selectedPrompt.title + '」+正文（降级）');
        }
    }

    // ---------- 清除 Markdown ----------
    function cleanMarkdown() {
        saveState();
        const savedScrollTop = editor.scrollTop;
        transformPreserveBold(function (text) {
            if (!text) return text;
            text = text.replace(/\*\*/g, '');
            text = text.replace(/#+/g, '\n\n');
            text = text.replace(/(\d+)\.\s+(.+)/g, '\n$1、$2\n\n');
            text = text.replace(/^[\s\uFEFF\xA0]*-/gm, '-')
                .replace(/^(-.*)/gm, '$1\n');
            text = text.replace(/(\n\s*){2,}/g, '\n\n');
            text = text.replace(/\n+$/, '');
            return text;
        });
        reformatText(false);
        editor.scrollTop = savedScrollTop;
    }

    // ---------- 归档 ----------
    function sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    function copyToClipboardSafe(text) {
        setTimeout(function () {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(function () { });
                    return;
                }
            } catch (e) { }
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (e) { }
        }, 0);
    }

    function triggerDownload(text, fileName) {
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function archiveDoc() {
        const text = getEditorContent();
        if (!text.trim()) {
            showAutoCloseAlert('文档为空，无法归档');
            return;
        }
        const title = getFirstNonEmptyLine(text);
        const cleanTitle = sanitizeFileName(title);
        const now = new Date();
        const dateStr = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const fileName = `${dateStr}_${cleanTitle}.md`;
        const archivePath = 'D:\\BaiduSyncdisk\\Adu-ai\\AduStyleLib';

        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }]
            }).then(function (handle) {
                return handle.createWritable().then(function (writable) {
                    return writable.write(text).then(function () { return writable.close(); });
                });
            }).then(function () {
                copyToClipboardSafe(archivePath);
                showAutoCloseAlert('已归档，路径已复制到剪贴板');
            }).catch(function (e) {
                if (e && e.name === 'AbortError') return;
                triggerDownload(text, fileName);
                copyToClipboardSafe(archivePath);
                showAutoCloseAlert('已下载，路径已复制到剪贴板');
            });
            return;
        }
        triggerDownload(text, fileName);
        copyToClipboardSafe(archivePath);
        showAutoCloseAlert('已下载，路径已复制到剪贴板');
    }

    // ---------- 从 editor HTML 渲染格式化正文到导出卡片 ----------
    function renderFormattedBody(bodyEl, html, skipLines) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var nodes = [];
        function collectNodesFrom(parent, arr, isTopLevel) {
            for (var i = 0; i < parent.childNodes.length; i++) {
                var child = parent.childNodes[i];
                if (child.nodeType === 3) {
                    var text = child.nodeValue;
                    // Handle \n in text nodes as line breaks
                    var parts = text.split('\n');
                    for (var p = 0; p < parts.length; p++) {
                        if (p > 0) {
                            arr.push({ type: 'br' });
                        }
                        if (parts[p]) {
                            arr.push({ type: 'text', data: parts[p] });
                        }
                    }
                } else if (child.nodeType === 1) {
                    var t = child.tagName.toLowerCase();
                    if (t === 'br') {
                        arr.push({ type: 'br' });
                    } else if (t === 'b' || t === 'strong') {
                        var sub = [];
                        collectNodesFrom(child, sub, false);
                        arr.push({ type: 'bold', children: sub });
                    } else if (t === 'a') {
                        var sub2 = [];
                        collectNodesFrom(child, sub2, false);
                        arr.push({ type: 'link', children: sub2 });
                    } else if (t === 'div' || t === 'p' || t === 'li') {
                        if (isTopLevel && arr.length > 0) {
                            var last = arr[arr.length - 1];
                            if (last.type !== 'br') {
                                arr.push({ type: 'br' });
                            }
                        }
                        collectNodesFrom(child, arr, false);
                    } else {
                        collectNodesFrom(child, arr, isTopLevel);
                    }
                }
            }
        }
        collectNodesFrom(doc.body, nodes, true);

        // Collapse consecutive br nodes: single br = line break, 2+ br = small blank gap
        var collapsedNodes = [];
        var brCount = 0;
        for (var ci = 0; ci < nodes.length; ci++) {
            if (nodes[ci].type === 'br') {
                brCount++;
            } else {
                if (brCount > 0) {
                    if (brCount === 1) {
                        collapsedNodes.push({ type: 'br' });
                    } else {
                        collapsedNodes.push({ type: 'blank' });
                    }
                    brCount = 0;
                }
                collapsedNodes.push(nodes[ci]);
            }
        }
        if (brCount > 0) {
            if (brCount === 1) {
                collapsedNodes.push({ type: 'br' });
            } else {
                collapsedNodes.push({ type: 'blank' });
            }
        }

        var lineCount = 0;
        var skipDone = false;
        var skipTarget = skipLines || 0;

        function renderNodes(container, nodeList, isBold) {
            for (var i = 0; i < nodeList.length; i++) {
                var n = nodeList[i];
                if (n.type === 'text') {
                    var part = n.data;
                    if (!skipDone && part.trim()) {
                        lineCount++;
                        if (lineCount > skipTarget) {
                            skipDone = true;
                        } else {
                            continue;
                        }
                    }
                    if (part) {
                        var span = document.createElement('span');
                        span.textContent = part;
                        if (isBold) {
                            span.style.color = '#feda05';
                            span.style.fontWeight = 'bold';
                        }
                        container.appendChild(span);
                    }
                } else if (n.type === 'br') {
                    container.appendChild(document.createElement('br'));
                    lineCount++;
                } else if (n.type === 'blank') {
                    var gap = document.createElement('span');
                    gap.style.display = 'block';
                    //空行间距
                    gap.style.height = '50px';
                    container.appendChild(gap);
                } else if (n.type === 'bold') {
                    renderNodes(container, n.children, true);
                } else if (n.type === 'link') {
                    renderNodes(container, n.children, isBold);
                }
            }
        }

        renderNodes(bodyEl, collapsedNodes, false);

        if (!bodyEl.childNodes.length) {
            bodyEl.style.display = 'none';
        }
    }

    // ---------- 导出图片 ----------
    var isExporting = false;
    function exportImage() {
        if (isExporting) return;
        if (!editor.innerText.trim()) {
            showAutoCloseAlert('文档为空，无法导出');
            return;
        }
        if (typeof html2canvas !== 'function') {
            showAutoCloseAlert('导出组件加载中，请稍后再试');
            return;
        }

        // 作者名：优先使用下拉框当前值，其次全局 author，最后兜底
        var exportAuthor = (authorInput && authorInput.value && authorInput.value.trim())
            ? authorInput.value.trim()
            : (author || '杜林 保险第1课作者');

        // slogan：优先使用下拉框当前值，其次全局 slogan，最后兜底
        var exportSlogan = (sloganInput && sloganInput.value && sloganInput.value.trim())
            ? sloganInput.value.trim()
            : (slogan || '家庭规划 协助理赔');

        showAutoCloseAlert('正在生成图片…');
        isExporting = true;

        setTimeout(function () {
            try {
                var editorHTML = editor.innerHTML;
                var fullText = editor.innerText;
                var lines = fullText.split('\n');
                var titleLine = '';
                var bodyStartIdx = 0;
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].trim()) {
                        titleLine = lines[i].trim();
                        bodyStartIdx = i + 1;
                        break;
                    }
                }

         var titleForFile = sanitizeFileName(titleLine || '无标题');
var now = new Date();
var fileDateStr = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
var fileName = fileDateStr + '_' + titleForFile + '.png';

                var cardWidth = 1012;
                var contentPadding = 48;
                var borderWidth = 1;
                var outerPadding = 40;
                var bodyFontSize = 45;
                var titleFontSize = 60;

                var container = document.createElement('div');
                container.style.position = 'fixed';
                container.style.left = '-99999px';
                container.style.top = '0';
                container.style.width = (cardWidth + outerPadding * 2) + 'px';
                container.style.height = 'auto';
                container.style.padding = outerPadding + 'px';
                container.style.background = '#19191F';
                container.style.boxSizing = 'border-box';
                container.style.zIndex = '-1';

                var card = document.createElement('div');
                card.style.width = cardWidth + 'px';
                card.style.background = '#19191F';
               // card.style.border = borderWidth + 'px solid #fff';
                card.style.border = '0';
                card.style.boxSizing = 'border-box';
                card.style.padding = contentPadding + 'px';
                card.style.color = '#EAEBF0';
                card.style.fontFamily = "'HarmonyOS Sans SC', 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif";
                card.style.textAlign = 'left';
                card.style.wordWrap = 'break-word';

                // 标题
                var titleEl = document.createElement('div');
                titleEl.textContent = titleLine;
                titleEl.style.fontSize = titleFontSize + 'px';
                titleEl.style.fontWeight = '900';
                titleEl.style.lineHeight = '1.4';
                titleEl.style.fontFamily = "'HarmonyOS Sans SC', 'HarmonyOS Sans', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif";
                //标题与正文间距
                titleEl.style.marginBottom = '8px';
                titleEl.style.marginTop = '100px';
                titleEl.style.color = '#EAEBF0';
                card.appendChild(titleEl);

                // 正文：解析 HTML 渲染加粗
                var bodyEl = document.createElement('div');
                bodyEl.style.fontSize = bodyFontSize + 'px';
                //文字间距
                bodyEl.style.lineHeight = '1.5';
                bodyEl.style.color = '#EAEBF0';
                bodyEl.style.wordWrap = 'break-word';
                bodyEl.style.whiteSpace = 'pre-wrap';
                renderFormattedBody(bodyEl, editorHTML, bodyStartIdx);
                card.appendChild(bodyEl);

                // 页脚
                var footer = document.createElement('div');
                //正文与页脚的距离
                footer.style.marginTop = '32px';
                //页脚分割线与内容的间距
                footer.style.paddingTop = '40px';
               footer.style.paddingBottom = '100px';
                footer.style.borderTop = '1px solid rgba(148,152,166,0.25)';
                footer.style.width = '100%';

                var footerInner = document.createElement('div');
                footerInner.style.display = 'flex';
                footerInner.style.flexDirection = 'row';
               footerInner.style.alignItems = 'center';
                footerInner.style.gap = '24px';
                footerInner.style.width = '100%';
                footerInner.style.justifyContent = 'flex-start';

                var badge = null;
                var qrImg = null;

                if (qrEnabled) {
                    // 二维码开启：左列（徽章+作者 + Slogan），右列二维码
               var leftCol = document.createElement('div');
leftCol.style.display = 'flex';
leftCol.style.flexDirection = 'column';
leftCol.style.alignItems = 'flex-start';
leftCol.style.gap = '28px';   // 这个值你可以自己调，12~20px 都行
leftCol.style.flexShrink = '0';
                    if (exportAuthor) {
                        var authorRow = document.createElement('div');
                        authorRow.style.display = 'flex';
                        authorRow.style.alignItems = 'center';
                        authorRow.style.gap = '12px';
                        authorRow.style.flexShrink = '0';

                        badge = document.createElement('img');
                        badge.src = BADGE_DATA_URL;
                        badge.style.width = '48px';
                        badge.style.height = '48px';
                        badge.style.objectFit = 'contain';
                        badge.style.flexShrink = '0';
                        authorRow.appendChild(badge);

                        var authorEl = document.createElement('span');
                        authorEl.textContent = exportAuthor;
                        authorEl.style.fontSize = '38px';
                        authorEl.style.color = '#feda05';
                        authorRow.appendChild(authorEl);

                        leftCol.appendChild(authorRow);
                    }

                    var serviceEl = document.createElement('div');
                    serviceEl.textContent = exportSlogan;
                    serviceEl.style.fontSize = '32px';
                    serviceEl.style.color = '#9498A6';
                    serviceEl.style.flexShrink = '0';
                    serviceEl.style.paddingLeft = '6px';
                    leftCol.appendChild(serviceEl);

                    footerInner.appendChild(leftCol);

                    // 根据作者选择对应二维码
                    var qrUrl = null;
                    if (exportAuthor.indexOf('杜 林') !== -1) {
                        qrUrl = DULIN_QR_DATA_URL;
                    } else if (exportAuthor.indexOf('罗小布') !== -1) {
                        qrUrl = LUOXIAOBU_QR_DATA_URL;
                    }
                    if (qrUrl) {
                        qrImg = document.createElement('img');
                        qrImg.src = qrUrl;
                        qrImg.style.width = '180px';
                        qrImg.style.height = '180px';
                        qrImg.style.objectFit = 'contain';
                        qrImg.style.flexShrink = '0';
                        qrImg.style.marginLeft = 'auto';
                        footerInner.appendChild(qrImg);
                    }
                } else {
                    // 二维码关闭：紧凑左对齐布局（保持现有样式）
                    if (exportAuthor) {
                        var authorRow = document.createElement('div');
                        authorRow.style.display = 'flex';
                        authorRow.style.alignItems = 'center';
                        authorRow.style.gap = '12px';
                        authorRow.style.flexShrink = '0';

                        badge = document.createElement('img');
                        badge.src = BADGE_DATA_URL;
                        badge.style.width = '42px';
                        badge.style.height = '42px';
                        badge.style.objectFit = 'contain';
                        badge.style.flexShrink = '0';
                        authorRow.appendChild(badge);

                        var authorEl = document.createElement('span');
                        authorEl.textContent = exportAuthor;
                        authorEl.style.fontSize = '38px';
                        authorEl.style.color = '#feda05';
                        authorRow.appendChild(authorEl);

                        footerInner.appendChild(authorRow);
                    }

                    var serviceEl = document.createElement('div');
                    serviceEl.textContent = exportSlogan;
                    serviceEl.style.fontSize = '32px';
                    serviceEl.style.color = '#9498A6';
                    serviceEl.style.flexShrink = '0';
                    footerInner.appendChild(serviceEl);
                }

                footer.appendChild(footerInner);
                card.appendChild(footer);
                container.appendChild(card);
                document.body.appendChild(container);

                // 3x 高清输出，防朋友圈压缩
                var scale = 3;
                var isFileProtocol = window.location.protocol === 'file:';
                function doCapture() {
                    var h2cOpts = {
                        backgroundColor: '#19191F',
                        scale: scale,
                        logging: false,
                        allowTaint: true,
                        foreignObjectRendering: false,
                        useCORS: false,
                        // 关键：强制 iframe 用 about:blank，避免 file:// 下同源策略错误
                        windowUrl: 'about:blank',
                        removeContainer: true,
                        imageTimeout: 15000
                    };
                    html2canvas(card, h2cOpts).then(function (canvas) {
                        try {
                            document.body.removeChild(container);
                        } catch (e) { }

                        var link = document.createElement('a');
                        link.download = fileName;
                        link.href = canvas.toDataURL('image/png');
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        showAutoCloseAlert('图片已导出');
                        isExporting = false;
                    }).catch(function (err) {
                        try {
                            document.body.removeChild(container);
                        } catch (e) { }
                        console.error('html2canvas error:', err);
                        showAutoCloseAlert('导出失败，请重试');
                        isExporting = false;
                    });
                }

                // 等所有图片加载完成后再截图
                var captureTriggered = false;
                var _imgLoadCount = 0;
                var _imgTotal = (badge ? 1 : 0) + (qrImg ? 1 : 0);
                function doCaptureSafe() {
                    if (captureTriggered) return;
                    if (_imgLoadCount < _imgTotal) return;
                    captureTriggered = true;
                    setTimeout(doCapture, 50);
                }
                function trackImg(img) {
                    img.onload = function () { _imgLoadCount++; doCaptureSafe(); };
                    img.onerror = function () { _imgLoadCount++; doCaptureSafe(); };
                    if (img.complete && img.naturalWidth > 0) {
                        _imgLoadCount++;
                    }
                }
                if (badge) trackImg(badge);
                if (qrImg) trackImg(qrImg);
                // 检查是否所有图片已就绪（无图片或都已缓存）
                doCaptureSafe();
                // 兜底：超时强执执行，避免图片加载卡住导致无法导出（file:// 下常见）
                setTimeout(function () {
                    if (!captureTriggered) {
                        captureTriggered = true;
                        setTimeout(doCapture, 50);
                    }
                }, 2000);
            } catch (e) {
                showAutoCloseAlert('导出失败，请重试');
                isExporting = false;
            }
        }, 200);
    }

    // ---------- 清空 ----------
    function clear() {
        if (confirm('确定要清空当前文档吗？')) {
            saveState();
            setEditorContent('');
            localStorage.removeItem('numBig');
            updateReadTime();
            saveCurrentContent();
            showAutoCloseAlert('已清空');
        }
    }

    // ---------- 序号切换 ----------
    function xhText() {
        saveState();
        function isNormalDigit(ch) { return ch >= '0' && ch <= '9'; }

        function processLine(line) {
            const leading = line.match(/^[ \t]*/)[0];
            const rest = line.substring(leading.length);
            if (rest.length === 0) return line;
            if (!isNormalDigit(rest[0])) return line;

            let numSeq = '';
            for (let i = 0; i < rest.length && i < 3; i++) {
                if (isNormalDigit(rest[i])) numSeq += rest[i];
                else break;
            }
            if (numSeq.length === 0) return line;

            const nextIdx = numSeq.length;
            if (nextIdx >= rest.length) return line;
            const delimiter = rest[nextIdx];
            if (delimiter !== '、' && delimiter !== ' ') return line;

            const after = rest.substring(nextIdx + 1);
            const value = parseInt(numSeq, 10);
            if (isNaN(value)) return line;

            const isThree = numSeq.length === 3;
            const hasLeadingZero = (numSeq[0] === '0');

            let targetNum, targetDelimiter;
            if (isThree && hasLeadingZero) {
                targetNum = value.toString();
                targetDelimiter = '、';
            } else {
                targetNum = value.toString().padStart(3, '0');
                targetDelimiter = ' ';
            }
            return leading + targetNum + targetDelimiter + after;
        }

        var text = editor.innerText;
        const lines = text.split('\n');
        let hasChanged = false;
        const newLines = lines.map(line => {
            const processed = processLine(line);
            if (processed !== line) hasChanged = true;
            return processed;
        });

        if (!hasChanged) {
            showAutoCloseAlert('未找到行首序号格式（如 1、 或 001 ）');
            return;
        }

        transformPreserveBold(function () {
            return newLines.join('\n');
        });
        showAutoCloseAlert('序号切换成功');
    }

    // ---------- 自定义提示 ----------
    function showAutoCloseAlert(message) {
        const alert = document.createElement('div');
        alert.style.position = 'fixed';
        alert.style.bottom = '0.1%';
        alert.style.left = '50%';
        alert.style.transform = 'translate(-50%, -50%)';
        alert.style.padding = '20px 30px';
        alert.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        alert.style.backdropFilter = 'blur(10px)';
        alert.style.border = '1px solid rgba(200, 200, 200, 0.5)';
        alert.style.borderRadius = '8px';
        alert.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        alert.style.zIndex = '9999';
        alert.style.color = 'black';
        alert.style.fontSize = '16px';
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 800);
    }

    // ---------- 编辑器事件 ----------
    editor.addEventListener('input', function () {
        updateReadTime();
        saveCurrentContent();
    });

    editor.addEventListener('paste', function (e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    });

    editor.addEventListener('click', function (e) {
        const target = e.target.closest('a');
        if (target && target.href) {
            e.preventDefault();
            window.open(target.href, '_blank');
        }
    });

    // ---------- 按钮事件 ----------
    newDocBtn.addEventListener('click', createNewDoc);
    mobileNewDocBtn.addEventListener('click', createNewDoc);
    mobileDocBtn.addEventListener('click', openMobileDrawer);
    mobileDrawerClose.addEventListener('click', closeMobileDrawer);
    mobileOverlay.addEventListener('click', function (e) {
        if (e.target === mobileOverlay) closeMobileDrawer();
    });
    scrollTopButton.addEventListener('click', scrollTop);
    numBigButton.addEventListener('click', numBig);
    copyButton.addEventListener('click', copy);
    clearButton.addEventListener('click', clear);
    xhButton.addEventListener('click', xhText);
    cleanMarkdownButton.addEventListener('click', cleanMarkdown);
    if (exportImgButton) exportImgButton.addEventListener('click', openExportPanel);
    archiveButton.addEventListener('click', archiveDoc);
    if (qrToggleButton) {
        qrToggleButton.addEventListener('click', function () {
            qrEnabled = !qrEnabled;
            applyQrToggleUI();
            // 持久化
            try {
                var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                raw.qrEnabled = qrEnabled;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
            } catch (_) { }
        });
    }

    // ---------- 生图面板 ----------
    function openExportPanel() {
        if (!editor.innerText.trim()) {
            showAutoCloseAlert('文档为空，无法导出');
            return;
        }
        // 刷新二维码开关UI
        applyQrToggleUI();
        if (exportModal) exportModal.classList.add('show');
    }
    function closeExportPanel() {
        if (exportModal) exportModal.classList.remove('show');
    }
    if (exportModalClose) exportModalClose.addEventListener('click', closeExportPanel);
    if (exportModal) {
        exportModal.addEventListener('click', function (e) {
            if (e.target === exportModal) closeExportPanel();
        });
    }
    if (exportConfirmBtn) {
        exportConfirmBtn.addEventListener('click', function () {
            closeExportPanel();
            setTimeout(exportImage, 100);
        });
    }

    // ---------- 提示词：数据模型（需在 UI 初始化前执行）----------
    var prompts = [];          // [{id, title, content}]
    var currentPromptId = null;
    function loadPrompts() {
        // 提示词数据只从 JSON 配置文件加载，不在 localStorage 持久化
        prompts = DEFAULT_PROMPTS || [];
        try {
            var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (raw.currentPromptId !== undefined) {
                currentPromptId = raw.currentPromptId;
            }
        } catch (_) { }
        // 默认选中第一个可用提示词：点击提示词进来就是需要用的
        var exists = prompts.some(function (p) { return p.id === currentPromptId; });
        if (!exists && prompts.length > 0) {
            currentPromptId = prompts[0].id;
            savePrompts();
        }
    }
    function savePrompts() {
        // 只持久化 currentPromptId，prompts 数据由 JSON 文件维护
        try {
            var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            existing.currentPromptId = currentPromptId;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        } catch (_) { }
    }
    function getCurrentPrompt() {
        return prompts.find(function (p) { return p.id === currentPromptId; }) || null;
    }

    // ---------- 提示词：UI 渲染 & 交互 ----------
    function renderPromptSelectOptions() {
        if (promptSelect) {
            var curVal = promptSelect.value;
            promptSelect.innerHTML = '';
            prompts.forEach(function (p) {
                var opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.title;
                promptSelect.appendChild(opt);
            });
            promptSelect.value = curVal || currentPromptId || (prompts[0] ? prompts[0].id : '');
        }
        if (promptMobileSelect) {
            promptMobileSelect.innerHTML = '';
            prompts.forEach(function (p) {
                var opt2 = document.createElement('option');
                opt2.value = p.id;
                opt2.textContent = p.title;
                promptMobileSelect.appendChild(opt2);
            });
            promptMobileSelect.value = currentPromptId || (prompts[0] ? prompts[0].id : '');
        }
    }

    function applyPromptToggleUI() {
        if (promptToggleButton) {
            var cur = getCurrentPrompt();
            promptToggleButton.title = cur ? ('当前提示词：' + cur.title) : '选择提示词';
        }
    }

    function openPromptPanel() {
        var isMobile = window.innerWidth <= 768;
        renderPromptSelectOptions();
        if (isMobile) {
            if (promptMobileOverlay) promptMobileOverlay.classList.add('show');
        } else {
            if (promptModal) promptModal.classList.add('show');
        }
    }

    function closePromptPanel() {
        if (promptModal) promptModal.classList.remove('show');
        if (promptMobileOverlay) promptMobileOverlay.classList.remove('show');
    }

    function selectPromptById(id) {
        currentPromptId = id || null;
        savePrompts();
        applyPromptToggleUI();
        renderPromptSelectOptions();
    }

    if (promptToggleButton) {
        promptToggleButton.addEventListener('click', openPromptPanel);
    }
    if (promptModalClose) promptModalClose.addEventListener('click', closePromptPanel);
    if (promptModal) {
        promptModal.addEventListener('click', function (e) {
            if (e.target === promptModal) closePromptPanel();
        });
    }
    if (promptMobileClose) promptMobileClose.addEventListener('click', closePromptPanel);
    if (promptMobileOverlay) {
        promptMobileOverlay.addEventListener('click', function (e) {
            if (e.target === promptMobileOverlay) closePromptPanel();
        });
    }

    // PC 端下拉选择
    if (promptSelect) {
        promptSelect.addEventListener('change', function () {
            selectPromptById(promptSelect.value);
        });
    }
    // 手机端下拉选择
    if (promptMobileSelect) {
        promptMobileSelect.addEventListener('change', function () {
            selectPromptById(promptMobileSelect.value);
        });
    }

    // 复制按钮（PC端 + 手机端共用）
    if (promptCopyBtn) {
        promptCopyBtn.addEventListener('click', copyWithPrompt);
    }
    if (promptMobileCopyBtn) {
        promptMobileCopyBtn.addEventListener('click', copyWithPrompt);
    }

    // 初始化提示词 UI 状态
    renderPromptSelectOptions();
    applyPromptToggleUI();

    var savedRange = null;
    document.addEventListener('selectionchange', function () {
        var sel = window.getSelection();
        if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    });

    if (boldButton) {
        // touchstart: 在浏览器转移焦点前保存选区
        boldButton.addEventListener('touchstart', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var sel = window.getSelection();
            if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
                savedRange = sel.getRangeAt(0).cloneRange();
            }
        }, { passive: false });

        // mousedown: 桌面端同样阻止焦点转移
        boldButton.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        boldButton.addEventListener('click', function (e) {
            e.preventDefault();
            // 直接恢复选区，不调用 focus() 防止页面滚动
            if (savedRange) {
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
            document.execCommand('bold');
            savedRange = null;
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Delete' && document.activeElement !== editor) {
            clear();
        }
    });

    // ---------- 初始化 ----------
    loadConfigs();
    loadPrompts();
    fillSelectOptions();
    loadDocs();

    // ---------- 作者下拉框（loadDocs 后再赋值，确保使用 xzt 字段内的 author，并完成旧数据迁移）----------
    if (authorInput) {
        authorInput.value = author || '';
        authorInput.addEventListener('change', function () {
            author = authorInput.value.trim();
            saveDocs();
        });
    }

    // ---------- slogan 下拉框 ----------
    if (sloganInput) {
        sloganInput.value = slogan || '';
        sloganInput.addEventListener('change', function () {
            slogan = sloganInput.value.trim();
            saveDocs();
        });
    }

    // ---------- 二维码开关 ----------
    var qrEnabled = true;
    try {
        var storedQr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        qrEnabled = storedQr.qrEnabled !== false;
    } catch (_) { }
    function applyQrToggleUI() {
        if (qrToggleButton) {
            qrToggleButton.classList.toggle('toggle-active', qrEnabled);
            qrToggleButton.textContent = qrEnabled ? '开' : '关';
        }
    }
    applyQrToggleUI();

    const doc = getCurrentDoc();
    if (doc) {
        setEditorContent(doc.content);
        updateReadTime();
        renderLists();
        highlightActive();
        if (!undoStacks[currentId]) undoStacks[currentId] = [];
        editor.focus();
    } else {
        createNewDoc();
    }
});