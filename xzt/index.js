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

    // ---------- 数据存储 ----------
    const STORAGE_KEY = 'xzt_docs';
    const OLD_KEY = 'xzt';

    // ---------- 数据模型 ----------
    let docs = [];
    let currentId = null;
    // 撤销历史：每个文档独立
    let undoStacks = {}; // { docId: [ ... ] }
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

    // ---------- 加载 / 保存数据 ----------
    function loadDocs() {
        let data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                docs = parsed.docs || [];
                currentId = parsed.currentId || null;
            } catch (e) {
                docs = [];
                currentId = null;
            }
        } else {
            // 尝试迁移旧数据
            const old = localStorage.getItem(OLD_KEY);
            if (old) {
                const id = generateId();
                docs = [{
                    id: id,
                    title: getFirstNonEmptyLine(old),
                    content: old
                }];
                currentId = id;
                // 删除旧键
                localStorage.removeItem(OLD_KEY);
                saveDocs();
            } else {
                // 没有任何数据，创建默认文档
                const id = generateId();
                docs = [{
                    id: id,
                    title: '无标题',
                    content: ''
                }];
                currentId = id;
                saveDocs();
            }
        }
        // 确保 currentId 有效
        if (!docs.some(d => d.id === currentId)) {
            if (docs.length) currentId = docs[0].id;
            else {
                // 极端情况，新建
                const id = generateId();
                docs.push({ id, title: '无标题', content: '' });
                currentId = id;
                saveDocs();
            }
        }
        // 初始化撤销栈
        docs.forEach(doc => {
            if (!undoStacks[doc.id]) undoStacks[doc.id] = [];
        });
    }

    function saveDocs() {
        const data = JSON.stringify({ docs, currentId });
        localStorage.setItem(STORAGE_KEY, data);
    }

    function getCurrentDoc() {
        return docs.find(d => d.id === currentId);
    }

    // ---------- 保存当前文档内容 ----------
    function saveCurrentContent() {
        const doc = getCurrentDoc();
        if (!doc) return;
        const content = editor.value;
        if (doc.content !== content) {
            doc.content = content;
            // 更新标题
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
        // 保存当前文档内容
        saveCurrentContent();
        // 保存当前撤销栈
        if (currentId) {
            undoStacks[currentId] = undoStacks[currentId] || [];
        }
        // 切换到新文档
        currentId = id;
        const doc = getCurrentDoc();
        if (doc) {
            editor.value = doc.content;
            // 恢复该文档的撤销栈
            if (!undoStacks[id]) undoStacks[id] = [];
            updateReadTime();
            renderLists();
            // 更新高亮
            highlightActive();
            // 滚动到顶部
            editor.scrollTop = 0;
            editor.focus();
        }
        // 保存当前状态
        saveDocs();
    }

    // ---------- 新建文档 ----------
    function createNewDoc() {
        const id = generateId();
        const newDoc = {
            id: id,
            title: '无标题',
            content: ''
        };
        docs.push(newDoc);
        undoStacks[id] = [];
        // 切换到新文档
        currentId = id;
        editor.value = '';
        updateReadTime();
        saveDocs();
        renderLists();
        highlightActive();
        editor.focus();
        // 关闭手机浮层
        closeMobileDrawer();
    }

    // ---------- 删除文档 ----------
    function deleteDoc(id) {
        if (docs.length <= 1) {
            showAutoCloseAlert('至少保留一个文档');
            return;
        }
        if (!confirm('确定删除此文档吗？')) return;
        // 从数组中移除
        const idx = docs.findIndex(d => d.id === id);
        if (idx === -1) return;
        docs.splice(idx, 1);
        // 删除撤销栈
        delete undoStacks[id];
        // 如果删除的是当前文档，切换到第一个
        if (currentId === id) {
            currentId = docs[0].id;
            const doc = docs[0];
            editor.value = doc.content;
            updateReadTime();
            // 切换到目标撤销栈
            if (!undoStacks[currentId]) undoStacks[currentId] = [];
        }
        saveDocs();
        renderLists();
        highlightActive();
        // 关闭浮层
        closeMobileDrawer();
    }

    // ---------- 渲染列表（PC和手机） ----------
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
                // 手机端切换后关闭浮层
                closeMobileDrawer();
            });

            container.appendChild(div);
        });
    }

    function highlightActive() {
        // 高亮更新通过重新渲染完成
        // 但为了性能，可以只更新类，但简单重新渲染
        renderLists();
    }

    // ---------- 浮层控制 ----------
    function openMobileDrawer() {
        mobileOverlay.classList.add('show');
        renderLists(); // 确保内容最新
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
        const result = wordCount / 350;
        return Number(result.toFixed(1));
    }

    function updateReadTime() {
        const text = editor.value;
        const wordCount = countWords(text);
        const readTime = madeReadTime(wordCount);
        readDisplay.textContent = '全文 ' + wordCount + ' 字 预计 ' + readTime + ' 分钟';
    }

    // ---------- 置顶 ----------
    function scrollTop() {
        editor.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }

    // ---------- 撤销历史操作 ----------
    function saveState() {
        const id = currentId;
        if (!id) return;
        if (!undoStacks[id]) undoStacks[id] = [];
        const stack = undoStacks[id];
        // 如果内容与栈顶相同，不重复添加
        const currentContent = editor.value;
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
        editor.value = prev;
        updateReadTime();
        // 保存当前内容
        saveCurrentContent();
        showAutoCloseAlert('已撤销');
    }

    // 快捷键 Ctrl+Z
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.key === 'z' && document.activeElement === editor) {
            e.preventDefault();
            undo();
        }
    });

    // 其他快捷键（Alt+1, Alt+4, Alt+C, Ctrl+S）
    document.addEventListener('keydown', function (e) {
        if (e.altKey && e.key === '1') {
            e.preventDefault();
            scrollTop();
        }
        if (e.altKey && e.key === '4') {
            e.preventDefault();
            numBig();
        }
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            copy();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            reformatText();
        }
    });

    // ---------- 数字加粗（字体滤镜） ----------
    function numBig() {
        saveState();
        let text = editor.value;
        // URL保护（略，沿用之前逻辑）
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
        editor.value = text;
        updateReadTime();
        saveCurrentContent();
    }

    // ---------- 排版 ----------
    function reformatText(saveHistory = true) {
        if (saveHistory) saveState();
        try {
            let text = editor.value;
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

            // 保护 @ 开头的昵称
            // 情况1: @英文开头，后跟英文/中文（如 @TomXu在减肥）- 到非字母非中文字符自然截断
            // 情况2: @中文+英文（如 @小明Pro）- 英文后不跟中文，避免吃掉后续中文
            text = text.replace(/@[A-Za-z][A-Za-z\u4e00-\u9fa5]*|@[\u4e00-\u9fa5]+[A-Za-z]+/g, function(match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });

            // 保护字母数字混合词（如 p2p, B2C, 3D, 4K, iPhone13）
            text = text.replace(/[A-Za-z0-9]+/g, function(match) {
                if (/[A-Za-z]/.test(match) && /\d/.test(match)) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                }
                return match;
            });

            // 保护复合名称：英文+中文+英文，且至少一个英文以大写开头（如 Rock新体验馆lab）
            text = text.replace(/[A-Za-z]+[\u4e00-\u9fa5]+[A-Za-z]+/g, function(match) {
                var engParts = match.match(/[A-Za-z]+/g);
                var hasUppercase = engParts.some(function(p) {
                    return p[0] >= 'A' && p[0] <= 'Z';
                });
                if (hasUppercase) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                }
                return match;
            });

            // 保护 中文(至少2字)+大写英文（如 张三Koji, 刘晓伟Pro）- 1字中文不保护（如 用Python）
            text = text.replace(/[\u4e00-\u9fa5]{2,}[A-Z][a-zA-Z]*/g, function(match) {
                urlPlaceholders.push(match);
                return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
            });

            text = text.replace(/,/g, '，').replace(/:/g, '：');
            text = text.replace(/(\d+%?)-(\d+%?)/g, '$1~$2');
            text = text.replace(/。[ \t]*$/gm, '');
            // 中文-英文（所有）：加空格（被保护的不走这里）
            text = text.replace(/([\u4e00-\u9fa5])([A-Za-z]+)/g, '$1 $2');
            // 英文-中文：全小写英文加空格；大写开头不加空格（保护 Pro版, Koji张三 等昵称/术语）
            text = text.replace(/([A-Za-z]+)([\u4e00-\u9fa5]+)/g, function(match, eng, chi) {
                if (eng[0] >= 'A' && eng[0] <= 'Z') return match;
                return eng + ' ' + chi;
            });

            // 中文-数字：加空格
            text = text.replace(/([\u4e00-\u9fa5])(\d)/g, '$1 $2');
            text = text.replace(/(\d)([\u4e00-\u9fa5])/g, '$1 $2');

            // 注意：不再在数字和字母之间加空格（p2p, B2C, 3D 等保持完整）
            text = text.replace(/“/g, '「').replace(/”/g, '」');
            text = text.replace(/"([^"]+)"/g, '「$1」');
            text = text.replace(/%([\u4e00-\u9fa5])/g, '% $1');
            text = text.replace(/%\s+(?=[，,])/g, '%');
            text = text.replace(new RegExp('\\[语音开始\\]', 'g'), '');
            text = text.replace(new RegExp('\\[语音结束\\]', 'g'), '');
            text = text.replace(/^\s+/, '');
            text = text.replace(/(\n\s*){2,}/g, '\n\n');
            text = removeTrailingEmptyLines(text);

            // 占位符与周围中文/数字/小写英文之间加空格
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

            editor.value = text;
            updateReadTime();
            saveCurrentContent();
            showAutoCloseAlert('已美化保存');
        } catch (e) {
            console.error('排版出错:', e);
            showAutoCloseAlert('排版出错，请检查控制台');
        }
    }

    function removeTrailingEmptyLines(text) {
        const lines = text.split('\n');
        let last = lines.length - 1;
        while (last >= 0 && lines[last].trim() === '') last--;
        return lines.slice(0, last + 1).join('\n');
    }

    // ---------- 复制 ----------
    async function copy(type) {
        try {
            await navigator.clipboard.writeText(editor.value);
            if (type !== 'linkCbz') showAutoCloseAlert('复制成功');
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = editor.value;
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
        let text = editor.value;
        text = text.replace(/\*\*/g, '');
        text = text.replace(/#+/g, '\n\n');
        text = text.replace(/(\d+)\.\s+(.+)/g, '\n$1、$2\n\n');
        text = text.replace(/^[\s\uFEFF\xA0]*-/gm, '-')
            .replace(/^(-.*)/gm, '$1\n');
        text = text.replace(/(\n\s*){2,}/g, '\n\n');
        text = removeTrailingEmptyLines(text);
        editor.value = text;
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

    // ---------- 工具：清理文件名 ----------
    function sanitizeFileName(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    // ---------- 工具：复制文本到剪贴板（不阻塞，不抛错） ----------
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

    // ---------- 工具：触发文件下载 ----------
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

    // ---------- 归档 ----------
    function archiveDoc() {
        const text = editor.value;
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

        // 优先使用 File System Access API（Chrome/Edge），弹出保存对话框
        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'Markdown',
                    accept: { 'text/markdown': ['.md'] }
                }]
            }).then(function (handle) {
                return handle.createWritable().then(function (writable) {
                    return writable.write(text).then(function () {
                        return writable.close();
                    });
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

        // 不支持 showSaveFilePicker，直接下载
        triggerDownload(text, fileName);
        copyToClipboardSafe(archivePath);
        showAutoCloseAlert('已下载，路径已复制到剪贴板');
    }

    // ---------- 清空 ----------
    function clear() {
        if (confirm('确定要清空当前文档吗？')) {
            saveState();
            editor.value = '';
            localStorage.removeItem('numBig');
            updateReadTime();
            saveCurrentContent();
            showAutoCloseAlert('已清空');
        }
    }

    // ---------- 序号切换 ----------
    function xhText() {
        saveState();
        let text = editor.value;
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
        editor.value = newLines.join('\n');
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

    // ---------- 事件绑定 ----------
    // 编辑器输入事件：保存当前文档内容，更新字数，更新标题（在saveCurrentContent中已包含标题更新）
    editor.addEventListener('input', function () {
        updateReadTime();
        saveCurrentContent(); // 会更新标题并重绘列表
    });

    // 新建文档
    newDocBtn.addEventListener('click', createNewDoc);
    mobileNewDocBtn.addEventListener('click', createNewDoc);

    // 手机端文档按钮
    mobileDocBtn.addEventListener('click', openMobileDrawer);
    mobileDrawerClose.addEventListener('click', closeMobileDrawer);
    mobileOverlay.addEventListener('click', function (e) {
        if (e.target === mobileOverlay) closeMobileDrawer();
    });

    // 其他按钮
    scrollTopButton.addEventListener('click', scrollTop);
    numBigButton.addEventListener('click', numBig);
    copyButton.addEventListener('click', copy);
    clearButton.addEventListener('click', clear);
    xhButton.addEventListener('click', xhText);
    cleanMarkdownButton.addEventListener('click', cleanMarkdown);
    cbzButton.addEventListener('click', linkCbz);
    archiveButton.addEventListener('click', archiveDoc);

    // Delete 键清空（仅当编辑器未聚焦时）
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Delete' && document.activeElement !== editor) {
            clear();
        }
    });

    // ---------- 初始化 ----------
    loadDocs();
    const doc = getCurrentDoc();
    if (doc) {
        editor.value = doc.content;
        updateReadTime();
        renderLists();
        highlightActive();
        // 初始化撤销栈
        if (!undoStacks[currentId]) undoStacks[currentId] = [];
        editor.focus();
    } else {
        // 理论上不会发生
        createNewDoc();
    }
});
