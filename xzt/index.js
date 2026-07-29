document.addEventListener('DOMContentLoaded', function () {
    // ---------- DOM 元素 ----------
    const editor = document.getElementById('editor');
    const readDisplay = document.getElementById('read');
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
    const cbzButton = document.getElementById('cbzButton');
    const archiveButton = document.getElementById('archiveButton');

    // ---------- 数据存储（固定键名） ----------
    const STORAGE_KEY = 'xzt';

    // ---------- 数据模型 ----------
    let docs = [];
    let currentId = null;
    let undoStacks = {};
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

    // ---------- 编辑器内容读写（纯文本，但渲染支持链接） ----------
    function getEditorContent() {
        return editor.innerText;
    }

    function setEditorContent(text) {
        // 将 URL 转为链接
        const withLinks = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        // 将换行转为 <br> 以渲染
        editor.innerHTML = withLinks.replace(/\n/g, '<br>');
    }

    // ---------- 加载 / 保存数据 ----------
    function loadDocs() {
        const raw = localStorage.getItem(STORAGE_KEY);
        // console.log('读取到原始数据:', raw);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // console.log('解析后的数据:', parsed);
                // 检查是否为新格式（包含 docs 和 currentId）
                if (parsed.docs && Array.isArray(parsed.docs)) {
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
                        saveDocs();
                    }
                    // 初始化撤销栈
                    docs.forEach(doc => {
                        if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
                    });
                    // console.log('成功加载新格式数据，docs:', docs, 'currentId:', currentId);
                    return;
                }
            } catch (e) {
                console.warn('JSON解析失败，尝试作为旧数据:', e);
            }
            // 如果数据不是 JSON 或解析失败，作为旧格式（纯文本）处理
            const id = generateId();
            const title = getFirstNonEmptyLine(raw);
            docs = [{ id: id, title: title, content: raw }];
            currentId = id;
            saveDocs(); // 转换为新格式保存
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
            // console.log('迁移旧数据，docs:', docs);
            return;
        }

        // 没有任何数据，创建默认文档
        if (docs.length === 0) {
            const id = generateId();
            docs = [{ id: id, title: '无标题', content: '' }];
            currentId = id;
            saveDocs();
            docs.forEach(doc => {
                if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
            });
            // console.log('创建默认文档');
        }
    }

    function saveDocs() {
        const data = JSON.stringify({ docs, currentId });
        localStorage.setItem(STORAGE_KEY, data);
        // console.log('保存数据:', data);
    }

    function getCurrentDoc() {
        return docs.find(d => d.id === currentId);
    }

    // ---------- 保存当前文档内容 ----------
    function saveCurrentContent() {
        const doc = getCurrentDoc();
        if (!doc) return;
        const content = getEditorContent();
        if (doc.content !== content) {
            doc.content = content;
            const newTitle = getFirstNonEmptyLine(content);
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
        readDisplay.textContent = '全文 ' + wordCount + ' 字 预计 ' + readTime + ' 分钟';
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
        const currentContent = getEditorContent();
        if (stack.length > 0 && stack[stack.length - 1] === currentContent) return;
        stack.push(currentContent);
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
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            reformatText();
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
        let text = getEditorContent();
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urlPlaceholders = [];
        text = text.replace(urlRegex, function(match) {
            urlPlaceholders.push(match);
            return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
        });

        const numBig = localStorage.getItem('numBig');
        if (numBig) {
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
                    '𝗔':'A','𝗕':'B','𝗖':'C','𝗗':'D','𝗘':'E','𝗙':'F','𝗚':'G','𝗛':'H',
                    '𝗜':'I','𝗝':'J','𝗞':'K','𝗟':'L','𝗠':'M','𝗡':'N','𝗢':'O','𝗣':'P',
                    '𝗤':'Q','𝗥':'R','𝗦':'S','𝗧':'T','𝗨':'U','𝗩':'V','𝗪':'W','𝗫':'X',
                    '𝗬':'Y','𝗭':'Z'
                };
                return map[char] || char;
            });
            localStorage.removeItem('numBig');
        } else {
            text = text.split('').map(char => {
                const boldMap = {
                    '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵',
                    'a':'𝗮','b':'𝗯','c':'𝗰','d':'𝗱','e':'𝗲','f':'𝗳','g':'𝗴','h':'𝗵','i':'𝗶','j':'𝗷',
                    'k':'𝗸','l':'𝗹','m':'𝗺','n':'𝗻','o':'𝗼','p':'𝗽','q':'𝗾','r':'𝗿','s':'𝘀','t':'𝘁',
                    'u':'𝘂','v':'𝘃','w':'𝘄','x':'𝘅','y':'𝘆','z':'𝘇',
                    'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝',
                    'K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧',
                    'U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭'
                };
                return boldMap[char] || char;
            }).join('');
            localStorage.setItem('numBig', 1);
        }

        text = text.replace(/[\uE000-\uE7FF]/g, function(ch) {
            const idx = ch.charCodeAt(0) - 0xE000;
            return urlPlaceholders[idx] || ch;
        });
        setEditorContent(text);
        updateReadTime();
        saveCurrentContent();
    }

    // ---------- 排版 ----------
    function reformatText(saveHistory = true) {
        if (saveHistory) saveState();
        try {
            let text = getEditorContent();
            if (!text) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            const urlRegex = /https?:\/\/[^\s]+/g;
            const urlPlaceholders = [];
            text = text.replace(urlRegex, function(match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });

            text = text.replace(/@[A-Za-z][A-Za-z\u4e00-\u9fa5]*|@[\u4e00-\u9fa5]+[A-Za-z]+/g, function(match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });
            text = text.replace(/[A-Za-z0-9]+/g, function(match) {
                if (/[A-Za-z]/.test(match) && /\d/.test(match)) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                }
                return match;
            });
            text = text.replace(/[A-Za-z]+[\u4e00-\u9fa5]+[A-Za-z]+/g, function(match) {
                var engParts = match.match(/[A-Za-z]+/g);
                var hasUppercase = engParts.some(function(p) { return p[0] >= 'A' && p[0] <= 'Z'; });
                if (hasUppercase) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                }
                return match;
            });
            text = text.replace(/[\u4e00-\u9fa5]{2,}[A-Z][a-z]+/g, function(match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });

            text = text.replace(/,/g, '，').replace(/:/g, '：');
            text = text.replace(/(\d+%?)-(\d+%?)/g, '$1~$2');
            text = text.replace(/。[ \t]*$/gm, '');
            text = text.replace(/([\u4e00-\u9fa5])([A-Za-z]+)/g, '$1 $2');
            text = text.replace(/([A-Za-z]+)([\u4e00-\u9fa5]+)/g, function(match, eng, chi) {
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

            text = text.replace(/[\uE000-\uE7FF]/g, function(ch) {
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

            setEditorContent(text);
            updateReadTime();
            saveCurrentContent();
            showAutoCloseAlert('已美化保存');
        } catch (e) {
            console.error('排版出错:', e);
            showAutoCloseAlert('排版出错，请检查控制台');
        }
    }

    // ---------- 复制 ----------
    async function copy(type) {
        try {
            await navigator.clipboard.writeText(getEditorContent());
            if (type !== 'linkCbz') showAutoCloseAlert('复制成功');
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = getEditorContent();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            if (type !== 'linkCbz') showAutoCloseAlert('复制成功（降级方式）');
        }
    }

    // ---------- 清除 Markdown ----------
    function cleanMarkdown() {
        saveState();
        const isMobile = window.innerWidth <= 768;
        const savedScrollTop = isMobile ? editor.scrollTop : 0;
        let text = getEditorContent();
        text = text.replace(/\*\*/g, '');
        text = text.replace(/#+/g, '\n\n');
        text = text.replace(/(\d+)\.\s+(.+)/g, '\n$1、$2\n\n');
        text = text.replace(/^[\s\uFEFF\xA0]*-/gm, '-')
            .replace(/^(-.*)/gm, '$1\n');
        text = text.replace(/(\n\s*){2,}/g, '\n\n');
        text = text.replace(/\n+$/, '');
        setEditorContent(text);
        reformatText(false);
        if (isMobile) {
            editor.scrollTop = savedScrollTop;
        } else {
            scrollTop();
        }
    }

    // ---------- 跳转写作猫 ----------
    function linkCbz() {
        copy('linkCbz');
        window.open('https://xiezuocat.com/pro/8689953271362609152', '_blank');
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
                console.warn('showSaveFilePicker 失败，降级为下载:', e);
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
        let text = getEditorContent();
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
        setEditorContent(newLines.join('\n'));
        updateReadTime();
        saveCurrentContent();
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
    cbzButton.addEventListener('click', linkCbz);
    archiveButton.addEventListener('click', archiveDoc);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Delete' && document.activeElement !== editor) {
            clear();
        }
    });

    // ---------- 初始化 ----------
    loadDocs();
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