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
    const sidebar = document.getElementById('sidebar');
    const sidebarLockBtn = document.getElementById('sidebarLockBtn');
    const sidebarPeekBtn = document.getElementById('sidebarPeekBtn');
    const sidebarBackupBtn = document.getElementById('sidebarBackupBtn');
    const sidebarRestoreBtn = document.getElementById('sidebarRestoreBtn');
    const restoreFileInput = document.getElementById('restoreFileInput');
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

    // 查找替换
    const replaceButton = document.getElementById('replaceButton');
    // 手机端分组折叠按钮
    const mobMoreBtn = document.getElementById('mobMoreBtn');
    const replaceModal = document.getElementById('replace-modal');
    const replaceModalClose = document.getElementById('replaceModalClose');
    const replaceFindInput = document.getElementById('replaceFindInput');
    const replaceReplaceInput = document.getElementById('replaceReplaceInput');
    const replaceConfirmBtn = document.getElementById('replaceConfirmBtn');
    const noteArea = document.getElementById('noteArea');
    const notePanel = document.getElementById('note-panel');
    const noteHeader = document.getElementById('note-header');
    const noteResizeHandle = document.querySelector('.note-resize-handle');


    // ---------- 数据模型 ----------
    const STORAGE_KEY = 'xzt';
    let docs = [];
    let currentId = null;
    let undoStacks = {};
    var EXPORT_CONFIG = null;     // 从 config/export-config.json 加载
    var DEFAULT_PROMPTS = [];     // 从 config/prompts.json 加载
    let author = '';
    let slogan = '';
    const MAX_UNDO = 100;
    let isUndoRedoing = false;    // 撤销/排版期间禁止入栈
    let inputUndoTimer = null;    // 编辑器输入防抖入栈

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
    // 读取配置里标记为 default 的默认作者
    function getDefaultAuthor() {
        if (EXPORT_CONFIG && EXPORT_CONFIG.authors) {
            for (var i = 0; i < EXPORT_CONFIG.authors.length; i++) {
                if (EXPORT_CONFIG.authors[i].default) return EXPORT_CONFIG.authors[i].value;
            }
            if (EXPORT_CONFIG.authors.length) return EXPORT_CONFIG.authors[0].value;
        }
        return '';
    }

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

    // ---------- 加载 / 保存数据（统一用 xzt 一个 key） ----------
    function getAppState() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function setAppState(patch) {
        var cur = getAppState();
        Object.assign(cur, patch || {});
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cur)); } catch (e) { }
    }
    // 一次性清理所有历史遗留 key，统一收敛到 xzt
    (function migrateLegacyKeys() {
        try {
            var cur = getAppState();
            var changed = false;
            // 旧作者名
            if (cur.author === undefined || cur.author === '') {
                var legacyAuthor = localStorage.getItem('xzt_author');
                if (legacyAuthor) { cur.author = legacyAuthor.trim(); changed = true; }
            }
            // 备注布局
            if (!cur.noteLayout) {
                var nl = localStorage.getItem('xzt_note_layout');
                if (nl) { cur.noteLayout = JSON.parse(nl); changed = true; }
            }
            // 侧边栏状态
            if (cur.sidebarCollapsed === undefined) {
                var sb = localStorage.getItem('xzt_sidebar_collapsed');
                if (sb !== null && sb !== undefined) { cur.sidebarCollapsed = sb === '1'; changed = true; }
            }
            // 数字加粗状态
            if (cur.numBig === undefined) {
                var nb = localStorage.getItem('numBig');
                if (nb !== null && nb !== undefined) { cur.numBig = true; changed = true; }
            }
            // 作者默认值迁移标记
            if (cur.authorDefaultMigrated === undefined) {
                var dm = localStorage.getItem('xzt_author_default_migrated');
                if (dm === '1') { cur.authorDefaultMigrated = true; changed = true; }
            }
            if (changed) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
            }
            // 删除所有旧 key
            ['xzt_author', 'xzt_note_layout', 'xzt_sidebar_collapsed', 'numBig', 'xzt_author_default_migrated']
                .forEach(function (k) { try { localStorage.removeItem(k); } catch (_) { } });
        } catch (_) { }
    })();
    function loadDocs() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // 检查是否为新格式（包含 docs 和 currentId）
                if (parsed && parsed.docs && Array.isArray(parsed.docs)) {
                    docs = parsed.docs;
                    if (parsed.currentId && docs.some(d => d.id === parsed.currentId)) {
                        currentId = parsed.currentId;
                    } else if (docs.length > 0) {
                        currentId = docs[0].id;
                    } else {
                        const id = generateId();
                        docs = [{ id: id, title: '无标题', content: '' }];
                        currentId = id;
                    }
                    author = (typeof parsed.author === 'string' && parsed.author) ? parsed.author : getDefaultAuthor();
                    slogan = typeof parsed.slogan === 'string' ? parsed.slogan : '';
                    docs.forEach(doc => {
                        if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
                    });
                    saveDocs();
                    return;
                }
            } catch (e) { /* JSON 解析失败，作为旧格式（纯文本）处理 */ }
            const id = generateId();
            const title = getFirstNonEmptyLine(raw);
            docs = [{ id: id, title: title, content: raw }];
            currentId = id;
            author = getDefaultAuthor();
            saveDocs();
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
            return;
        }

        // 没有任何数据，创建默认文档
        if (docs.length === 0) {
            const id = generateId();
            docs = [{ id: id, title: '无标题', content: '' }];
            currentId = id;
            author = getDefaultAuthor();
            saveDocs();
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
        }
    }

    function saveDocs() {
        const existing = getAppState();
        const payload = Object.assign({}, existing, {
            docs: docs,
            currentId: currentId,
            author: author,
            slogan: slogan
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
            noteArea.value = doc.note || '';
            updateReadTime();
            renderLists();
            highlightActive();
            editor.scrollTop = 0;
            ensureUndoBaseline();
            editor.focus();
        }
        saveDocs();
    }

    // ---------- 新建文档 ----------
    function createNewDoc() {
        const id = generateId();
        const newDoc = { id: id, title: '无标题', content: '', note: '' };
        docs.push(newDoc);
        undoStacks[id] = [''];
        currentId = id;
        setEditorContent('');
        noteArea.value = '';
        updateReadTime();
        ensureUndoBaseline();
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
            noteArea.value = doc.note || '';
            updateReadTime();
            if (!undoStacks[currentId]) undoStacks[currentId] = [];
            ensureUndoBaseline();
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
        // 置顶的排最前，其余保持原顺序
        var sorted = docs.slice().sort(function (a, b) {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
        });
        sorted.forEach(doc => {
            const div = document.createElement('div');
            div.className = itemClass;
            if (doc.id === currentId) div.classList.add('active');
            if (doc.pinned) div.classList.add('doc-pinned');
            div.setAttribute('draggable', 'true');
            div.dataset.docId = doc.id;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'doc-title';
            titleSpan.textContent = doc.title;
            div.appendChild(titleSpan);

            // 置顶按钮 📌
            var PIN_SVG = '<svg class="pin-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M812.608 213.312h-597.12a42.624 42.624 0 1 1 0-85.312h597.12a42.624 42.624 0 0 1 0 85.312z m-42.624 682.432a42.752 42.752 0 0 1-30.336-12.352l-225.6-225.664-225.664 225.664a42.752 42.752 0 0 1-72.96-30.272V341.248a42.624 42.624 0 0 1 42.688-42.624h511.808a42.688 42.688 0 0 1 42.688 42.624v511.872a42.624 42.624 0 0 1-42.624 42.624z"/></svg>';
            const pinBtn = document.createElement('button');
            pinBtn.className = 'doc-pin' + (doc.pinned ? ' pinned' : '');
            pinBtn.innerHTML = PIN_SVG;
            pinBtn.title = doc.pinned ? '取消置顶' : '置顶';
            pinBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                togglePinDoc(doc.id);
            });
            div.appendChild(pinBtn);

            const delBtn = document.createElement('button');
            delBtn.className = deleteClass;
            delBtn.innerHTML = '<svg class="del-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M254.398526 804.702412l-0.030699-4.787026C254.367827 801.546535 254.380106 803.13573 254.398526 804.702412zM614.190939 259.036661c-22.116717 0-40.047088 17.910928-40.047088 40.047088l0.37146 502.160911c0 22.097274 17.930371 40.048111 40.047088 40.048111s40.048111-17.950837 40.048111-40.048111l-0.350994-502.160911C654.259516 276.948613 636.328122 259.036661 614.190939 259.036661zM893.234259 140.105968l-318.891887 0.148379-0.178055-41.407062c0-22.13616-17.933441-40.048111-40.067554-40.048111-7.294127 0-14.126742 1.958608-20.017916 5.364171-5.894244-3.405563-12.729929-5.364171-20.031219-5.364171-22.115694 0-40.047088 17.911952-40.047088 40.048111l0.188288 41.463344-230.115981 0.106424c-3.228531-0.839111-6.613628-1.287319-10.104125-1.287319-3.502777 0-6.89913 0.452301-10.136871 1.296529l-73.067132 0.033769c-22.115694 0-40.048111 17.950837-40.048111 40.047088 0 22.13616 17.931395 40.048111 40.048111 40.048111l43.176358-0.020466 0.292666 617.902982 0.059352 0 0 42.551118c0 44.233434 35.862789 80.095199 80.095199 80.095199l40.048111 0 0 0.302899 440.523085-0.25685 0-0.046049 40.048111 0c43.663452 0 79.146595-34.95 80.054267-78.395488l-0.329505-583.369468c0-22.135136-17.930371-40.047088-40.048111-40.047088-22.115694 0-40.047088 17.911952-40.047088 40.047088l0.287549 509.324054c-1.407046 60.314691-18.594497 71.367421-79.993892 71.367421l41.575908 1.022283-454.442096 0.26606 52.398394-1.288343c-62.715367 0-79.305207-11.522428-80.0645-75.308173l0.493234 76.611865-0.543376 0-0.313132-660.818397 236.82273-0.109494c1.173732 0.103354 2.360767 0.166799 3.561106 0.166799 1.215688 0 2.416026-0.063445 3.604084-0.169869l32.639375-0.01535c1.25355 0.118704 2.521426 0.185218 3.805676 0.185218 1.299599 0 2.582825-0.067538 3.851725-0.188288l354.913289-0.163729c22.115694 0 40.050158-17.911952 40.050158-40.047088C933.283394 158.01792 915.349953 140.105968 893.234259 140.105968zM774.928806 815.294654l0.036839 65.715701-0.459464 0L774.928806 815.294654zM413.953452 259.036661c-22.116717 0-40.048111 17.910928-40.048111 40.047088l0.37146 502.160911c0 22.097274 17.931395 40.048111 40.049135 40.048111 22.115694 0 40.047088-17.950837 40.047088-40.048111l-0.37146-502.160911C454.00054 276.948613 436.069145 259.036661 413.953452 259.036661z"/></svg>';
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

            // 拖拽事件
            div.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', doc.id);
                e.dataTransfer.effectAllowed = 'move';
                div.classList.add('doc-dragging');
            });
            div.addEventListener('dragend', function () {
                div.classList.remove('doc-dragging');
                container.querySelectorAll('.doc-drop-over').forEach(function (el) {
                    el.classList.remove('doc-drop-over');
                });
            });
            div.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                div.classList.add('doc-drop-over');
            });
            div.addEventListener('dragleave', function () {
                div.classList.remove('doc-drop-over');
            });
            div.addEventListener('drop', function (e) {
                e.preventDefault();
                div.classList.remove('doc-drop-over');
                var draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId && draggedId !== doc.id) {
                    reorderDocs(draggedId, doc.id);
                }
            });

            container.appendChild(div);
        });
    }

    // 置顶 / 取消置顶
    function togglePinDoc(id) {
        var doc = docs.find(function (d) { return d.id === id; });
        if (!doc) return;
        doc.pinned = !doc.pinned;
        saveDocs();
        renderLists();
    }

    // 把 draggedId 对应的文档移到 targetId 之前
    function reorderDocs(draggedId, targetId) {
        var from = docs.findIndex(function (d) { return d.id === draggedId; });
        var to = docs.findIndex(function (d) { return d.id === targetId; });
        if (from < 0 || to < 0 || from === to) return;
        var item = docs.splice(from, 1)[0];
        docs.splice(to, 0, item);
        saveDocs();
        renderLists();
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
    function saveState(force) {
        if (!force && isUndoRedoing) return;
        const id = currentId;
        if (!id) return;
        if (!undoStacks[id]) undoStacks[id] = [];
        const stack = undoStacks[id];
        const currentHTML = editor.innerHTML;
        if (stack.length > 0 && stack[stack.length - 1] === currentHTML) return;
        stack.push(currentHTML);
        if (stack.length > MAX_UNDO) stack.shift();
    }

    // 确保栈底有基线快照（空文档也要入栈）
    function ensureUndoBaseline() {
        const id = currentId;
        if (!id) return;
        if (!undoStacks[id] || undoStacks[id].length === 0) {
            undoStacks[id] = [editor.innerHTML || ''];
        }
    }

    function undo() {
        const id = currentId;
        if (!id) return;
        const stack = undoStacks[id];
        if (!stack || stack.length <= 1) {
            showAutoCloseAlert('没有可撤销的操作');
            return;
        }
        // 当前状态先出栈
        var current = stack.pop();
        var prev = stack[stack.length - 1];
        // 如果恢复内容与当前一样（栈顶重复），再退一步
        if (prev === current && stack.length > 1) {
            stack.pop();
            prev = stack[stack.length - 1];
        }
        isUndoRedoing = true;
        setEditorContent(prev);
        restoreCaret((editor.innerText || '').length);
        updateReadTime();
        saveCurrentContent();
        isUndoRedoing = false;
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
            cleanMarkdown();
            return;
        }
        if (e.ctrlKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')) {
            e.preventDefault();
            openReplaceModal();
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
        saveState(true);
        var doToggle = !getAppState().numBig;
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
        if (doToggle) setAppState({ numBig: true });
        else setAppState({ numBig: false });
    }

    // ---------- 通用：对文本做转换但保留加粗格式 ----------
    function transformPreserveBold(transformFn) {
        isUndoRedoing = true;
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
            isUndoRedoing = false;
            return;
        }

        setEditorContent(result);
        var newCaret = mapCaretOffsetAcrossTransform(oldText, newText, caretOffset);
        restoreCaret(newCaret);
        updateReadTime();
        saveCurrentContent();
        isUndoRedoing = false;
        // 完成后入栈（按钮操作会先 saveState(force) 保存旧状态，这里再保存新状态）
        saveState();
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
        if (saveHistory) saveState(true);
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
        saveState(true);
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

    // ---------- 查找替换 ----------
    function openReplaceModal() {
        // 把编辑器当前选中的文字带入"查找"输入框
        var sel = window.getSelection();
        if (sel && sel.toString()) {
            var text = sel.toString();
            // 只取编辑器内部的选区内容，避免把侧边栏/备注面板的选中文本带进来
            if (editor.contains(sel.anchorNode) || editor.contains(sel.focusNode)) {
                replaceFindInput.value = text;
            }
        }
        replaceModal.classList.add('show');
        setTimeout(function () {
            if (replaceFindInput.value) {
                // 已带入查找内容，直接 focus 替换框让用户输新内容
                replaceReplaceInput.focus();
            } else {
                replaceFindInput.focus();
            }
        }, 50);
    }

    function closeReplaceModal() {
        replaceModal.classList.remove('show');
    }

    function replaceAll() {
        var findText = replaceFindInput.value;
        var replaceText = replaceReplaceInput.value;
        if (!findText) {
            showAutoCloseAlert('请输入查找内容');
            return;
        }
        saveState(true);
        var savedScrollTop = editor.scrollTop;
        var count = 0;
        transformPreserveBold(function (text) {
            if (!text) return text;
            count = text.split(findText).length - 1;
            if (count === 0) return text;
            return text.split(findText).join(replaceText);
        });
        editor.scrollTop = savedScrollTop;
        if (count > 0) {
            showAutoCloseAlert('已替换 ' + count + ' 处');
            closeReplaceModal();
        } else {
            showAutoCloseAlert('未找到匹配内容');
        }
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

        // 作者名：优先使用下拉框当前值，其次全局 author，最后用配置里的默认作者
        var exportAuthor = (authorInput && authorInput.value && authorInput.value.trim())
            ? authorInput.value.trim()
            : (author || getDefaultAuthor());

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

                    // 根据作者选择对应二维码（罗杜主任使用罗小布的二维码）
                    var qrUrl = null;
                    if (exportAuthor.indexOf('杜 林') !== -1) {
                        qrUrl = DULIN_QR_DATA_URL;
                    } else if (exportAuthor.indexOf('罗小布') !== -1 || exportAuthor.indexOf('罗杜主任') !== -1) {
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
            saveState(true);
            setEditorContent('');
            setAppState({ numBig: false });
            updateReadTime();
            saveCurrentContent();
            showAutoCloseAlert('已清空');
        }
    }

    // ---------- 序号切换 ----------
    function xhText() {
        saveState(true);
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
        // 每次输入防抖 800ms 写入撤销历史，连续输入合并为一次可撤销动作
        if (isUndoRedoing) return;
        ensureUndoBaseline();
        if (inputUndoTimer) clearTimeout(inputUndoTimer);
        inputUndoTimer = setTimeout(function () {
            saveState();
        }, 800);
    });

    // 备注输入：保存到当前文档的 note 字段，不触碰正文
    let noteSaveTimer = null;
    noteArea.addEventListener('input', function () {
        const doc = getCurrentDoc();
        if (!doc) return;
        doc.note = noteArea.value;
        if (noteSaveTimer) clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(saveDocs, 600);
    });

    // ---------- 备注面板：拖拽 + 缩放 + 位置记忆 ----------
    function saveNoteLayout() {
        try {
            var layout = {
                left: notePanel.style.left,
                top: notePanel.style.top,
                right: notePanel.style.right,
                width: notePanel.style.width,
                height: notePanel.style.height
            };
            setAppState({
                noteLayout: {
                    left: notePanel.style.left,
                    top: notePanel.style.top,
                    right: notePanel.style.right,
                    width: notePanel.style.width,
                    height: notePanel.style.height
                }
            });
        } catch (e) { }
    }

    function restoreNoteLayout() {
        try {
            var layout = getAppState().noteLayout;
            if (!layout) return;
            if (layout.width) notePanel.style.width = layout.width;
            if (layout.height) notePanel.style.height = layout.height;
            if (layout.left) {
                notePanel.style.left = layout.left;
                notePanel.style.right = 'auto';
            }
            if (layout.top) notePanel.style.top = layout.top;
            requestAnimationFrame(clampNoteToBounds);
        } catch (e) { }
    }

    // 把备注面板严格限制在父容器（content-row）可见范围内
    // 父容器本身就在 main 区域内（被侧边栏挤开），所以天然避开侧边栏
    function clampNoteToBounds() {
        var parent = notePanel.parentElement;
        if (!parent) return;
        var pw = parent.clientWidth;
        var ph = parent.clientHeight;
        var w = notePanel.offsetWidth;
        var h = notePanel.offsetHeight;
        // 优先使用 left 定位，不用 right
        notePanel.style.right = 'auto';
        var left = parseFloat(notePanel.style.left) || 0;
        var top = parseFloat(notePanel.style.top) || 0;
        // 严格不超出四边界（至少露出 80×30 像素，防止面板完全被拖走找不到）
        left = Math.max(-w + 80, Math.min(left, pw - 80));
        top = Math.max(-h + 30, Math.min(top, ph - 30));
        notePanel.style.left = left + 'px';
        notePanel.style.top = top + 'px';
    }

    // 拖拽（按住标题栏移动）
    (function () {
        var dragging = false;
        var startX = 0, startY = 0;
        var startLeft = 0, startTop = 0;

        noteHeader.addEventListener('mousedown', function (e) {
            if (e.target === noteArea) return;
            dragging = true;
            var rect = notePanel.getBoundingClientRect();
            var parentRect = notePanel.parentElement.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left - parentRect.left;
            startTop = rect.top - parentRect.top;
            notePanel.style.left = startLeft + 'px';
            notePanel.style.top = startTop + 'px';
            notePanel.style.right = 'auto';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var parent = notePanel.parentElement;
            var pw = parent.clientWidth;
            var ph = parent.clientHeight;
            var w = notePanel.offsetWidth;
            var h = notePanel.offsetHeight;
            var newLeft = startLeft + (e.clientX - startX);
            var newTop = startTop + (e.clientY - startY);
            // 严格不超出四边界
            newLeft = Math.max(-w + 80, Math.min(newLeft, pw - 80));
            newTop = Math.max(-h + 30, Math.min(newTop, ph - 30));
            notePanel.style.left = newLeft + 'px';
            notePanel.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', function () {
            if (dragging) {
                dragging = false;
                clampNoteToBounds();
                saveNoteLayout();
            }
        });
    })();

    // 缩放（右下角拖拽）
    (function () {
        var resizing = false;
        var startX = 0, startY = 0;
        var startW = 0, startH = 0;

        noteResizeHandle.addEventListener('mousedown', function (e) {
            resizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = notePanel.offsetWidth;
            startH = notePanel.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', function (e) {
            if (!resizing) return;
            var newW = startW + (e.clientX - startX);
            var newH = startH + (e.clientY - startY);
            var minW = 100, maxW = 600;
            var minH = 90, maxH = notePanel.parentElement.offsetHeight;
            newW = Math.max(minW, Math.min(newW, maxW));
            newH = Math.max(minH, Math.min(newH, maxH));
            notePanel.style.width = newW + 'px';
            notePanel.style.height = newH + 'px';
        });

        document.addEventListener('mouseup', function () {
            if (resizing) {
                resizing = false;
                clampNoteToBounds();
                saveNoteLayout();
            }
        });
    })();

    restoreNoteLayout();
    // 无保存布局时，把 CSS 初始的 right 定位转成 left，便于后续拖拽统一用 left 计算
    if (!getAppState().noteLayout) {
        requestAnimationFrame(function () {
            var parent = notePanel.parentElement;
            var rect = notePanel.getBoundingClientRect();
            var parentRect = parent.getBoundingClientRect();
            notePanel.style.left = (rect.left - parentRect.left) + 'px';
            notePanel.style.top = (rect.top - parentRect.top) + 'px';
            notePanel.style.right = 'auto';
        });
    }
    // 窗口缩放时自动把面板拉回可见范围
    window.addEventListener('resize', function () {
        clampNoteToBounds();
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

    // ---------- 按钮图标替换（用用户给的 SVG 替换文字，省空间）----------
    var BTN_SVGS = {
        scrollTopButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M875.444261 75.197634H148.482597a38.034014 38.034014 0 0 1-38.619153-37.59516A38.034014 38.034014 0 0 1 148.555739 0.007314h726.888522a38.034014 38.034014 0 0 1 38.619153 37.59516 38.034014 38.034014 0 0 1-38.619153 37.59516z m29.988357 459.041293L539.501518 119.375604a36.936879 36.936879 0 0 0-54.856751 0L118.494239 534.238927c-20.114142 22.893551-3.43769 58.148156 27.574661 58.148156h172.762194v356.422597c0 41.471704 34.669467 75.19032 77.238306 75.19032h231.8612c42.568839 0 77.238305-33.718616 77.238306-75.19032V592.460225h172.908479c30.866065 0 47.542518-35.327748 27.355233-58.221298z"/></svg>',
        cleanMarkdown: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M960 64v101.76H606.656V64H960z m0 763.136v101.76H64v-101.76h896z m0-254.4v101.76h-285.504v-101.76H960z m0-254.336v101.76h-285.504v-101.76H960zM168.704 674.496H64v-11.776l216.32-596.608L279.552 64h110.464l-0.768 2.112L606.72 665.6v8.832H500.864l-39.04-107.776h-254.08l-39.04 107.776z m78.08-215.488h176L334.72 216.448l-87.936 242.56z"/></svg>',
        xh: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M448 192h512a64 64 0 0 0 0-128H448a64 64 0 0 0 0 128z m512 256H448a64 64 0 0 0 0 128h512a64 64 0 0 0 0-128z m0 384H448a64 64 0 0 0 0 128h512a64 64 0 0 0 0-128zM128 0H64v256h64zM0 384h128v64H0v192h192V576H64V512h128V320H0z m0 384h128v64H0v64h128v64H0v64h192v-320H0z"/></svg>',
        numBigButton: '<svg class="btn-svg" viewBox="0 0 2133 1024" aria-hidden="true"><path d="M972.133333 687.333333l72.133334 193.6H1190.666667L905.2 131.2h-126.933333L492.666667 880.933333h146.8l68-193.6h264.666666z m-132.666666-366.8l88.8 244.4H751.333333l88.133334-244.4zM1192 724.533333c0 51.066667 16.933333 92.4 50.266667 122.933334 32.8 30.133333 76.933333 45.333333 131.2 45.333333 54.666667 0 100.133333-17.466667 135.733333-52.133333v40.266666h131.066667V534.533333c0-139.333333-70.533333-212.933333-203.866667-212.933333-69.466667 0-131.733333 16.933333-185.2 50.266667l-10 6.266666v142.933334l34.666667-28.4c46.4-37.866667 96.266667-56.4 152.266666-56.4 35.066667 0 74.8 10 80.4 84.133333l-130.8 18.4C1224.266667 560 1192 651.466667 1192 724.533333z m317.333333-94V654.666667c0 36.133333-10.533333 65.2-32.266666 88.8-21.2 23.066667-47.6 34.266667-80.666667 34.266666-22.8 0-40.266667-5.733333-53.466667-17.466666-12.533333-11.2-18.533333-24.933333-18.533333-43.066667 0-21.6 5.6-37.466667 17.066667-48.666667 8.4-8.133333 28-19.2 73.6-25.2l94.266666-12.8z"/></svg>',
        replaceButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M362.688 780.8a38.4 38.4 0 0 1 6.208 76.288l-6.208 0.512H128a38.4 38.4 0 0 1-6.208-76.288L128 780.8h234.688z m0-307.2a38.4 38.4 0 0 1 6.208 76.288l-6.208 0.512H128a38.4 38.4 0 0 1-6.208-76.288L128 473.6h234.688zM896 128a38.4 38.4 0 0 1 6.208 76.288L896 204.8H128a38.4 38.4 0 0 1-6.208-76.288L128 128h768zM650.688 313.6a219.712 219.712 0 0 1 170.88 357.824l123.008 123.904a38.4 38.4 0 0 1-49.216 58.624l-5.248-4.48-126.72-127.552a219.712 219.712 0 1 1-112.768-408.32z m0 76.8a142.912 142.912 0 1 0 0 285.888 142.912 142.912 0 0 0 0-285.888z"/></svg>',
        exportImgButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M989.696 171.52H34.304c-18.944 0-34.304 15.36-34.304 34.304v693.76c0 18.944 15.36 34.304 34.304 34.304h954.88c18.944 0 34.304-15.36 34.304-34.304V205.824c0.512-18.944-14.848-34.304-33.792-34.304zM727.552 353.28c32.768 0 59.904 26.624 59.904 59.904 0 32.768-26.624 59.904-59.904 59.904-32.768 0-59.904-26.624-59.904-59.904 0-33.28 26.624-59.904 59.904-59.904z m144.384 477.184H122.88c-23.552 0-38.912-25.088-27.648-46.08l188.416-359.936c10.24-19.456 36.864-22.528 51.2-6.144l244.224 273.92c11.776 13.312 32.256 14.336 45.056 2.048l73.728-70.656c12.288-11.776 31.744-11.776 44.032 0.512l153.088 153.088c18.944 19.456 5.12 53.248-23.04 53.248z"/></svg>',
        promptToggleButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M571.428571 134.692571c0 18.212571-7.68 34.596571-19.821714 45.860572V257.828571H749.714286c31.524571 0 61.769143 12.946286 84.041143 36.059429 22.308571 23.04 34.816 54.381714 34.816 87.04v410.331429c0 32.621714-12.507429 63.926857-34.816 87.04A116.809143 116.809143 0 0 1 749.714286 914.285714h-475.428572a116.809143 116.809143 0 0 1-84.041143-36.059428 125.366857 125.366857 0 0 1-34.816-87.04v-410.331429c0-32.621714 12.507429-63.926857 34.816-87.04A116.809143 116.809143 0 0 1 274.285714 257.828571h198.107429V180.553143a61.696 61.696 0 0 1-16.347429-25.161143 63.597714 63.597714 0 0 1 8.740572-58.075429c5.997714-8.155429 13.897143-14.628571 22.966857-18.797714a57.636571 57.636571 0 0 1 56.576 4.534857c8.301714 5.558857 15.140571 13.238857 19.894857 22.235429 4.754286 9.033143 7.204571 19.126857 7.204571 29.403428zM36.571429 462.957714h79.250285v246.162286H36.571429V462.994286z m950.857142 0h-79.250285v246.162286H987.428571V462.994286z m-594.285714 184.612572c15.762286 0 30.866286-6.473143 42.020572-18.029715 11.154286-11.52 17.408-27.172571 17.408-43.52 0-16.310857-6.253714-31.963429-17.408-43.52a58.404571 58.404571 0 0 0-42.020572-17.993142c-15.762286 0-30.866286 6.473143-42.057143 17.993142a62.683429 62.683429 0 0 0-17.371428 43.52c0 16.347429 6.253714 32 17.408 43.52 11.154286 11.556571 26.258286 18.029714 42.020571 18.029715z m297.142857-61.549715c0-16.310857-6.253714-31.963429-17.408-43.52a58.404571 58.404571 0 0 0-42.020571-17.993142c-15.762286 0-30.866286 6.473143-42.020572 17.993142a62.683429 62.683429 0 0 0-17.408 43.52c0 16.347429 6.253714 32 17.408 43.52 11.154286 11.556571 26.258286 18.029714 42.020572 18.029715 15.762286 0 30.866286-6.473143 42.020571-18.029715 11.154286-11.52 17.408-27.172571 17.408-43.52z"/></svg>',
        clearButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M229.12 475.52l687.296 183.872-1.408 1.472-1.024 12.864c-2.56 34.048-6.4 62.976-17.92 139.52l-6.528 43.648c-3.84 26.048-6.528 46.976-8.768 66.304-4.224 36.544-23.488 65.28-54.656 81.6-15.424 8.128-32 12.672-45.824 13.44l-4.032 0.192-90.432-24.32a18.88 18.88 0 0 1-12.16-26.688l35.392-71.552-20.352 26.24a515.328 515.328 0 0 1-47.36 50.56 19.008 19.008 0 0 1-18.112 4.672l-75.456-20.16a18.88 18.88 0 0 1-12.16-26.624l35.456-71.552-20.352 26.24a510.336 510.336 0 0 1-47.36 50.56 18.944 18.944 0 0 1-18.112 4.672l-88.448-23.68a18.944 18.944 0 0 1-12.096-26.56l35.392-71.552-20.352 26.24a515.84 515.84 0 0 1-47.36 50.56 18.944 18.944 0 0 1-18.112 4.672l-62.528-16.704a18.944 18.944 0 0 1-12.096-26.688l35.392-71.488-20.352 26.24c-8.32 10.688-20.48 24-36.48 39.936a44.736 44.736 0 0 1-43.136 11.52l-78.08-20.864-23.104-8.704c-29.632-25.536-44.608-61.44-39.36-95.552 5.76-37.12 32.32-67.648 82.112-88.704 34.368-14.656 67.584-74.176 89.664-157.44l3.84-14.464-1.024-1.792z m-42.88-76.16a60.224 60.224 0 0 1 5.056-6.4l123.776-135.424c9.92-10.752 24.832-19.392 41.856-23.936 16.64-4.416 33.984-4.672 48.64-0.768l123.584 33.024 4.096-2.368 55.36-205.824c8.704-32.448 43.968-51.456 78.72-42.24l83.2 22.272c34.752 9.28 55.808 43.392 47.104 75.84l-55.36 205.824 2.368 4.096 118.528 31.68c14.592 3.84 29.568 12.8 41.728 24.96 12.416 12.352 21.12 27.2 24.192 41.472l39.36 179.072a58.688 58.688 0 0 1 1.28 9.856c-0.704 6.592-5.312 10.304-13.696 11.2L194.944 418.048c-10.432-2.944-13.376-9.216-8.768-18.752z"/></svg>',
        archiveButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M878.72 243.84A81.92 81.92 0 0 1 960 326.4v495.146667a82.133333 82.133333 0 0 1-81.28 82.56H145.493333A82.346667 82.346667 0 0 1 64 821.546667v-618.666667a82.133333 82.133333 0 0 1 81.28-82.986667h285.226667c45.013333 0 52.48 28.16 81.493333 82.56l28.16 41.386667z m-341.333333 433.92l122.24-133.12a30.08 30.08 0 0 0 0-42.666667 26.24 26.24 0 0 0-20.053334-9.173333 26.88 26.88 0 0 0-20.053333 9.173333l-78.293333 86.613334V357.546667A30.293333 30.293333 0 0 0 512 327.253333a29.013333 29.013333 0 0 0-28.586667 30.293334v231.466666l-82.133333-86.613333a26.666667 26.666667 0 0 0-40.32 0 30.08 30.08 0 0 0 0 42.666667l126.08 133.12a34.56 34.56 0 0 0 49.92 0zM292.266667 778.666667a30.08 30.08 0 0 0 27.733333 30.293333h384a30.293333 30.293333 0 0 0 0-60.586667H320a29.866667 29.866667 0 0 0-27.733333 30.293334z"/></svg>',
        mobileDocBtn: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M514.048 62.464q93.184 0 175.616 35.328t143.872 96.768 96.768 143.872 35.328 175.616q0 94.208-35.328 176.128t-96.768 143.36-143.872 96.768-175.616 35.328q-94.208 0-176.64-35.328t-143.872-96.768-96.768-143.36-35.328-176.128q0-93.184 35.328-175.616t96.768-143.872 143.872-96.768 176.64-35.328zM772.096 576.512q26.624 0 45.056-18.944t18.432-45.568-18.432-45.056-45.056-18.432l-192.512 0 0-192.512q0-26.624-18.944-45.568t-45.568-18.944-45.056 18.944-18.432 45.568l0 192.512-192.512 0q-26.624 0-45.056 18.432t-18.432 45.056 18.432 45.568 45.056 18.944l192.512 0 0 191.488q0 26.624 18.432 45.568t45.056 18.944 45.568-18.944 18.944-45.568l0-191.488 192.512 0z"/></svg>',
        copyButton: '<svg class="btn-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M678.758927 731.426377a51.930909 51.930909 0 0 0 52.66233-51.930909V51.936029A51.930909 51.930909 0 0 0 678.758927 0.00512H51.930909A51.930909 51.930909 0 0 0 0 51.936029v627.559439a51.930909 51.930909 0 0 0 51.930909 51.930909h626.828018z"/><path d="M971.32743 292.573623H804.563383v454.212601a57.782279 57.782279 0 0 1-57.782279 57.782279H292.568503v167.495468a51.930909 51.930909 0 0 0 52.66233 51.930909h626.828018a51.930909 51.930909 0 0 0 51.930909-51.930909V344.504532a51.930909 51.930909 0 0 0-52.66233-51.930909z"/></svg>'
    };
    // 应用 SVG 到按钮，同时移除 data-mobile 属性避免手机端伪元素和 SVG 重叠
    for (var id in BTN_SVGS) {
        var el = document.getElementById(id);
        if (el) {
            el.innerHTML = BTN_SVGS[id];
            el.removeAttribute('data-mobile');
        }
    }
    // 用户提供的两个完整 SVG
    // SVG #1：侧边栏折叠时显示（三道横线 + 播放箭头）→ 点击展开
    // SVG #2：侧边栏展开时显示（三道横线 + 左箭头）→ 点击收起
    var SVG_SIDEBAR_COLLAPSED = '<svg class="sidebar-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M128 224c0-23.552 19.072-42.688 42.688-42.688h682.624a42.688 42.688 0 1 1 0 85.376H170.688A42.688 42.688 0 0 1 128 224zM469.312 416c0-23.552 19.136-42.688 42.688-42.688h341.312a42.688 42.688 0 1 1 0 85.376H512a42.688 42.688 0 0 1-42.688-42.688zM512 565.312a42.688 42.688 0 1 0 0 85.376h341.312a42.688 42.688 0 0 0 0-85.376H512zM128 800c0-23.552 19.072-42.688 42.688-42.688h682.624a42.688 42.688 0 0 1 0 85.376H170.688A42.688 42.688 0 0 1 128 800z"/><path d="M193.28 369.152A42.688 42.688 0 0 0 128 405.312v213.376a42.688 42.688 0 0 0 65.28 36.16l170.688-106.688a42.688 42.688 0 0 0 0-72.32L193.28 369.152zM260.8 512l-47.488 29.696v-59.392L260.8 512z"/></svg>';
    var SVG_SIDEBAR_EXPANDED = '<svg class="sidebar-svg" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M130.901333 529.493333l149.205334 130.517334a8.533333 8.533333 0 0 0 14.122666-6.4V392.533333a8.533333 8.533333 0 0 0-14.122666-6.4L130.901333 516.608a8.533333 8.533333 0 0 0 0 12.8z"/><path d="M128 213.333333m42.666667 0l682.666666 0q42.666667 0 42.666667 42.666667l0 0q0 42.666667-42.666667 42.666667l-682.666666 0q-42.666667 0-42.666667-42.666667l0 0q0-42.666667 42.666667-42.666667Z"/><path d="M128 725.333333m42.666667 0l682.666666 0q42.666667 0 42.666667 42.666667l0 0q0 42.666667-42.666667 42.666667l-682.666666 0q-42.666667 0-42.666667-42.666667l0 0q0-42.666667 42.666667-42.666667Z"/><path d="M384 469.333333m42.666667 0l426.666666 0q42.666667 0 42.666667 42.666667l0 0q0 42.666667-42.666667 42.666667l-426.666666 0q-42.666667 0-42.666667-42.666667l0 0q0-42.666667 42.666667-42.666667Z"/></svg>';

    function applySidebarCollapsed(collapsed) {
        if (collapsed) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
            sidebarLockBtn.innerHTML = SVG_SIDEBAR_COLLAPSED;
            sidebarLockBtn.title = '展开侧边栏';
        } else {
            sidebar.classList.remove('collapsed');
            document.body.classList.remove('sidebar-collapsed');
            sidebarLockBtn.innerHTML = SVG_SIDEBAR_EXPANDED;
            sidebarLockBtn.title = '收起侧边栏';
        }
        setAppState({ sidebarCollapsed: collapsed });
        setTimeout(function () { clampNoteToBounds(); }, 300);
    }
    // 初始化图标：JS 完全接管两个按钮的 innerHTML
    if (sidebarLockBtn) sidebarLockBtn.innerHTML = SVG_SIDEBAR_EXPANDED;
    if (sidebarPeekBtn) sidebarPeekBtn.innerHTML = SVG_SIDEBAR_COLLAPSED;
    sidebarLockBtn.addEventListener('click', function () {
        applySidebarCollapsed(!sidebar.classList.contains('collapsed'));
    });
    sidebarPeekBtn.addEventListener('click', function () {
        applySidebarCollapsed(false);
    });
    // 恢复上次的锁定状态
    (function () {
        try {
            if (getAppState().sidebarCollapsed) applySidebarCollapsed(true);
        } catch (e) { }
    })();

    // ---------- 数据备份 / 恢复（PC 端侧边栏）----------
    var BACKUP_PATH = 'D:\\BaiduSyncdisk\\WWW\\gitpage\\xzt项目\\数据备份';

    function doExportBackup() {
        var raw = localStorage.getItem(STORAGE_KEY) || '{"docs":[]}';
        var data = null;
        try { data = JSON.parse(raw); } catch (e) { data = { docs: [] }; }
        var pkg = {
            app: '写字台',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: data
        };
        var d = new Date();
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        var fileName = '写字台备份_' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
        var jsonText = JSON.stringify(pkg, null, 2);

        // 先把备份目录路径复制到剪切板，方便用户在弹框地址栏粘贴
        copyToClipboardSafe(BACKUP_PATH);

        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: '备份 JSON', accept: { 'application/json': ['.json'] } }]
            }).then(function (handle) {
                return handle.createWritable().then(function (writable) {
                    return writable.write(jsonText).then(function () { return writable.close(); });
                });
            }).then(function () {
                showAutoCloseAlert('备份完成 ✅');
            }).catch(function (e) {
                if (e && e.name === 'AbortError') return;
                triggerDownload(jsonText, fileName);
                showAutoCloseAlert('已下载，路径已复制到剪贴板');
            });
            return;
        }
        triggerDownload(jsonText, fileName);
        showAutoCloseAlert('已下载，路径已复制到剪贴板');
    }

    function doImportBackup(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var pkg = JSON.parse(e.target.result);
                if (!pkg || !pkg.data || !Array.isArray(pkg.data.docs)) {
                    alert('备份文件格式不正确（缺少 docs 字段）');
                    return;
                }
                var docCount = pkg.data.docs.length;
                var msg = '将覆盖当前所有本地数据，确定恢复此备份？\n\n' +
                    '备份时间：' + (pkg.exportedAt || '未知') + '\n' +
                    '文档数量：' + docCount;
                if (!confirm(msg)) return;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(pkg.data));
                alert('恢复成功，页面即将刷新');
                location.reload();
            } catch (err) {
                alert('备份文件解析失败：' + err.message);
            }
        };
        reader.readAsText(file);
    }

    if (sidebarBackupBtn) sidebarBackupBtn.addEventListener('click', doExportBackup);
    if (sidebarRestoreBtn && restoreFileInput) {
        sidebarRestoreBtn.addEventListener('click', function () {
            copyToClipboardSafe(BACKUP_PATH);
            restoreFileInput.click();
        });
        restoreFileInput.addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (file) doImportBackup(file);
            restoreFileInput.value = '';
        });
    }

    // ---------- 手机端按钮分组折叠（更多）----------
    var buttonContainer = document.querySelector('.button-container');
    function setMobileMore(expand) {
        document.body.classList.toggle('mob-expand-more', expand);
        if (mobMoreBtn) mobMoreBtn.classList.toggle('mob-on', expand);
        // 展开后让展开出来的按钮保持在可见区域
        if (buttonContainer && expand) {
            var first = xhButton || mobMoreBtn;
            buttonContainer.scrollLeft = Math.max(0, first.offsetLeft - 8);
        }
    }
    if (mobMoreBtn) {
        mobMoreBtn.addEventListener('click', function () {
            setMobileMore(!document.body.classList.contains('mob-expand-more'));
        });
    }
    // 点击其它按钮后自动收起，保持按钮栏紧凑
    if (buttonContainer) {
        buttonContainer.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn || btn === mobMoreBtn) return;
            setMobileMore(false);
        });
    }

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
            setAppState({ qrEnabled: qrEnabled });
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

    // 查找替换事件
    replaceButton.addEventListener('click', openReplaceModal);
    replaceModalClose.addEventListener('click', closeReplaceModal);
    replaceConfirmBtn.addEventListener('click', replaceAll);
    replaceModal.addEventListener('click', function (e) {
        if (e.target === replaceModal) closeReplaceModal();
    });
    replaceFindInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); replaceReplaceInput.focus(); }
    });
    replaceReplaceInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); replaceAll(); }
    });

    // ---------- 提示词：数据模型（需在 UI 初始化前执行）----------
    var prompts = [];          // [{id, title, content}]
    var currentPromptId = null;
    function loadPrompts() {
        // 提示词数据只从 JSON 配置文件加载，不在 localStorage 持久化
        prompts = DEFAULT_PROMPTS || [];
        var state = getAppState();
        if (state.currentPromptId !== undefined) currentPromptId = state.currentPromptId;
        var exists = prompts.some(function (p) { return p.id === currentPromptId; });
        if (!exists && prompts.length > 0) {
            currentPromptId = prompts[0].id;
            savePrompts();
        }
    }
    function savePrompts() {
        setAppState({ currentPromptId: currentPromptId });
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

    // ---------- 作者下拉框（loadDocs 后再赋值，确保使用 xzt 字段内的 author）----------
    if (authorInput) {
        authorInput.value = author || getDefaultAuthor();
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
    var qrEnabled = getAppState().qrEnabled !== false;
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
        noteArea.value = doc.note || '';
        updateReadTime();
        renderLists();
        highlightActive();
        if (!undoStacks[currentId]) undoStacks[currentId] = [];
        ensureUndoBaseline();
        editor.focus();
    } else {
        createNewDoc();
    }
});