document.addEventListener('DOMContentLoaded', function () {
    // const title = document.getElementById('title');
    const editor = document.getElementById('editor');

    // const saveButton = document.getElementById('saveButton');
    // const flowerButton = document.getElementById('flowerButton');
    const scrollTopButton = document.getElementById('scrollTopButton');
    const cleanMarkdownButton = document.getElementById('cleanMarkdown');
    // const toggleButton = document.getElementById('toggleButton');
    const numBigButton = document.getElementById('numBigButton');
    const copyButton = document.getElementById('copyButton');
    const cbzButton = document.getElementById('cbzButton');
    const clearButton = document.getElementById('clearButton');
    // const beautifyDisplay = document.getElementById('beautify');
    const read = document.getElementById('read');
    const xhButton = document.getElementById('xh');
    // const quan = document.getElementById('quan');
    // 获取当前URL
    var currentUrl = window.location.href;

    // ---------- 撤销历史 ----------
    var undoStack = [];
    const MAX_UNDO = 50;

    function saveState() {
        // 保存当前编辑器的内容到历史
        undoStack.push(editor.value);
        if (undoStack.length > MAX_UNDO) {
            undoStack.shift();
        }
    }

    // ---------- 字数统计 ----------
    function countWords(text) {
        var wordRegex = /[\u4e00-\u9fa5a-zA-Z0-9]+/g;
        var matches = text.match(wordRegex);
        return matches ? matches.join('').length : 0;
    }

    function updateReadTime() {
        var text = editor.value;
        var wordCount = countWords(text);
        var readTime = madeReadTime(wordCount);
        read.textContent = "全文 " + wordCount + " 字 预计 " + readTime + " 分钟";
    }

    function madeReadTime(wordCount) {
        const result = wordCount / 350;
        return Number(result.toFixed(1));
    }

    //置顶
    function scrollTop() {
        editor.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
    }

    // 加载文本
    function loadText() {
        const text = localStorage.getItem(currentUrl);
        if (text) {
            editor.value = text;
        } else {
            localStorage.removeItem(currentUrl);
        }
    }
    loadText();
    updateReadTime();
    editor.scrollBy = 0;

    function saveText() {
        const text = editor.value;
        localStorage.setItem(currentUrl, text);
    }

    // 快捷键
    function handleKeyDown(event) {
        // Ctrl+Z 撤销（仅当编辑器获得焦点且历史非空）
        if (event.ctrlKey && event.key === 'z' && document.activeElement === editor) {
            if (undoStack.length > 0) {
                event.preventDefault();
                const prevText = undoStack.pop();
                editor.value = prevText;
                updateReadTime();
                saveText();
                showAutoCloseAlert("已撤销");
            }
            // 若无历史，则不阻止默认，交给浏览器原生撤销
            return;
        }

        if (event.altKey && event.key === '1') {
            event.preventDefault();
            scrollTop();
        }
        if (event.altKey && event.key === '4') {
            event.preventDefault();
            numBig();
        }
        if (event.altKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            copy();
        }
        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            reformatText();
        }
    }
    document.addEventListener('keydown', handleKeyDown);

    // 花边字
    function addFancyBorders() {
        saveState(); // 保存操作前状态
        let text = editor.value;
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urlPlaceholders = [];
        text = text.replace(urlRegex, function(match) {
            urlPlaceholders.push(match);
            return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
        });

        const fancyChars = ['໌້', ' ຼ'];
        const characters = text.split('');
        const decoratedText = characters.map(char => char);
        const punctuationRegex = /[.,、\/#!$%\^&\*;:{}=\-_`~()]/g;
        const newlineRegex = /\n/g;
        const digitRegex = /\d/g;
        let match;
        const indexesToSkip = [];
        while ((match = punctuationRegex.exec(text)) !== null) {
            indexesToSkip.push(match.index);
        }
        while ((match = newlineRegex.exec(text)) !== null) {
            indexesToSkip.push(match.index);
        }
        while ((match = digitRegex.exec(text)) !== null) {
            indexesToSkip.push(match.index);
        }

        for (let i = 0; i < decoratedText.length; i++) {
            if (indexesToSkip.includes(i)) continue;
            const randomChar = fancyChars[Math.floor(Math.random() * fancyChars.length)];
            const random_number = Math.floor(Math.random() * 9);
            if (i % random_number === 0 && Math.random() > 0.9) {
                decoratedText[i] += randomChar;
            }
        }

        text = decoratedText.join('');
        text = text.replace(/[\uE000-\uE7FF]/g, function(ch) {
            const idx = ch.charCodeAt(0) - 0xE000;
            return urlPlaceholders[idx] || ch;
        });
        editor.value = text;
        updateReadTime();
        saveText();
    }

    // 数字加粗
    function numBig() {
        saveState();
        let text = editor.value;
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
                switch (char) {
                    case '𝗔': return 'A';
                    case '𝗕': return 'B';
                    case '𝗖': return 'C';
                    case '𝗗': return 'D';
                    case '𝗘': return 'E';
                    case '𝗙': return 'F';
                    case '𝗚': return 'G';
                    case '𝗛': return 'H';
                    case '𝗜': return 'I';
                    case '𝗝': return 'J';
                    case '𝗞': return 'K';
                    case '𝗟': return 'L';
                    case '𝗠': return 'M';
                    case '𝗡': return 'N';
                    case '𝗢': return 'O';
                    case '𝗣': return 'P';
                    case '𝗤': return 'Q';
                    case '𝗥': return 'R';
                    case '𝗦': return 'S';
                    case '𝗧': return 'T';
                    case '𝗨': return 'U';
                    case '𝗩': return 'V';
                    case '𝗪': return 'W';
                    case '𝗫': return 'X';
                    case '𝗬': return 'Y';
                    case '𝗭': return 'Z';
                    default: return char;
                }
            });
            localStorage.removeItem('numBig');
        } else {
            text = text.split('').map(char => {
                switch (char) {
                    case '0': return '𝟬';
                    case '1': return '𝟭';
                    case '2': return '𝟮';
                    case '3': return '𝟯';
                    case '4': return '𝟰';
                    case '5': return '𝟱';
                    case '6': return '𝟲';
                    case '7': return '𝟳';
                    case '8': return '𝟴';
                    case '9': return '𝟵';
                    case 'a': return '𝗮';
                    case 'b': return '𝗯';
                    case 'c': return '𝗰';
                    case 'd': return '𝗱';
                    case 'e': return '𝗲';
                    case 'f': return '𝗳';
                    case 'g': return '𝗴';
                    case 'h': return '𝗵';
                    case 'i': return '𝗶';
                    case 'j': return '𝗷';
                    case 'k': return '𝗸';
                    case 'l': return '𝗹';
                    case 'm': return '𝗺';
                    case 'n': return '𝗻';
                    case 'o': return '𝗼';
                    case 'p': return '𝗽';
                    case 'q': return '𝗾';
                    case 'r': return '𝗿';
                    case 's': return '𝘀';
                    case 't': return '𝘁';
                    case 'u': return '𝘂';
                    case 'v': return '𝘃';
                    case 'w': return '𝘄';
                    case 'x': return '𝘅';
                    case 'y': return '𝘆';
                    case 'z': return '𝘇';
                    case 'A': return '𝗔';
                    case 'B': return '𝗕';
                    case 'C': return '𝗖';
                    case 'D': return '𝗗';
                    case 'E': return '𝗘';
                    case 'F': return '𝗙';
                    case 'G': return '𝗚';
                    case 'H': return '𝗛';
                    case 'I': return '𝗜';
                    case 'J': return '𝗝';
                    case 'K': return '𝗞';
                    case 'L': return '𝗟';
                    case 'M': return '𝗠';
                    case 'N': return '𝗡';
                    case 'O': return '𝗢';
                    case 'P': return '𝗣';
                    case 'Q': return '𝗤';
                    case 'R': return '𝗥';
                    case 'S': return '𝗦';
                    case 'T': return '𝗧';
                    case 'U': return '𝗨';
                    case 'V': return '𝗩';
                    case 'W': return '𝗪';
                    case 'X': return '𝗫';
                    case 'Y': return '𝗬';
                    case 'Z': return '𝗭';
                    default: return char;
                }
            }).join('');
            localStorage.setItem('numBig', 1);
        }

        text = text.replace(/[\uE000-\uE7FF]/g, function(ch) {
            const idx = ch.charCodeAt(0) - 0xE000;
            return urlPlaceholders[idx] || ch;
        });
        editor.value = text;
        updateReadTime();
        saveText();
    }

    // 排版（支持是否保存历史）
    function reformatText(saveHistory = true) {
        if (saveHistory) saveState();
        try {
            let text = editor.value;
            if (text) {
                const urlRegex = /https?:\/\/[^\s]+/g;
                const urlPlaceholders = [];
                text = text.replace(urlRegex, function(match) {
                    urlPlaceholders.push(match);
                    return String.fromCharCode(0xE000 + urlPlaceholders.length - 1);
                });

                text = text.replace(/,/g, '，').replace(/:/g, '：');
                text = text.replace(/(\d+%?)-(\d+%?)/g, '$1~$2');
                text = text.replace(/。[ \t]*$/gm, '');
                text = text.replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, '$1 $2');
                text = text.replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
                text = text.replace(/([\u4e00-\u9fa5])(\d)/g, '$1 $2');
                text = text.replace(/(\d)([\u4e00-\u9fa5])/g, '$1 $2');
                text = text.replace(/(\d)([A-Za-z])/g, '$1 $2');
                text = text.replace(/([A-Za-z])(\d)/g, '$1 $2');
                text = text.replace(/“/g, '「').replace(/”/g, '」');
                text = text.replace(/"([^"]+)"/g, '「$1」');
                text = text.replace(/%([\u4e00-\u9fa5])/g, '% $1');
                text = text.replace(/%\s+(?=[，,])/g, '%');
                text = text.replace(new RegExp('\\[语音开始\\]', 'g'), '');
                text = text.replace(new RegExp('\\[语音结束\\]', 'g'), '');
                text = text.replace(/^\s+/, '');
                text = text.replace(/(\n\s*){2,}/g, '\n\n');
                text = removeTrailingEmptyLines(text);

                text = text.replace(/[\uE000-\uE7FF]/g, function(ch) {
                    const idx = ch.charCodeAt(0) - 0xE000;
                    return urlPlaceholders[idx] || ch;
                });

                editor.value = text;
                updateReadTime();
                saveText();
                showAutoCloseAlert("已美化保存");
            } else {
                localStorage.removeItem(currentUrl);
            }
        } catch (e) {
            console.error('排版出错:', e);
            showAutoCloseAlert('排版出错，请检查控制台');
        }
    }

    // 复制
    async function copy(type) {
        try {
            await navigator.clipboard.writeText(editor.value);
            if (type !== "linkCbz") {
                showAutoCloseAlert("复制成功");
            }
        } catch (e) {
            const textArea = document.createElement('textarea');
            textArea.value = editor.value;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            if (type !== "linkCbz") {
                showAutoCloseAlert("复制成功（降级方式）");
            }
        }
    }

    function removeTrailingEmptyLines(text) {
        var lines = text.split('\n');
        var lastNonEmptyLineIndex = lines.reduce((index, line, idx) => {
            return line.trim() ? idx : index;
        }, -1);
        if (lastNonEmptyLineIndex === -1) {
            return '';
        }
        return lines.slice(0, lastNonEmptyLineIndex + 1).join('\n');
    }

    // 清除Markdown
    function cleanMarkdown() {
        saveState(); // 整体操作保存一次
        let text = editor.value;
        text = text.replace(/\*\*/g, '');
        text = text.replace(/#+/g, '\n\n');
        text = text.replace(/(\d+)\.\s+(.+)/g, '\n$1、$2\n\n');
        text = text.replace(/^[\s\uFEFF\xA0]*-/gm, '-')
            .replace(/^(-.*)/gm, '$1\n');
        text = text.replace(/(\n\s*){2,}/g, '\n\n');
        text = removeTrailingEmptyLines(text);
        editor.value = text;
        // 调用排版但不保存历史（因为我们已经保存过）
        reformatText(false);
        scrollTop();
    }

    // 跳转写作猫
    function linkCbz() {
        copy('linkCbz');
        window.open('https://xiezuocat.com/pro/8689953271362609152', '_blank');
    }

    // 清空
    function clear() {
        if (confirm('确定要清空吗？')) {
            saveState();
            editor.value = '';
            localStorage.removeItem(currentUrl);
            updateReadTime();
            location.reload(true);
        }
    }

    // 序号切换
    function xhText() {
        saveState();
        let text = editor.value;
        const hasThreeDigitFormat = /\b\d{3}、/g.test(text);
        if (hasThreeDigitFormat) {
            text = text.replace(/\b(\d{3})、/g, (match, num) => {
                return `${parseInt(num, 10)}、`;
            });
        } else {
            text = text.replace(/\b(\d{1,2})、/g, (match, num) => {
                return `${parseInt(num, 10).toString().padStart(3, '0')}、`;
            });
        }
        editor.value = text;
        updateReadTime();
        saveText();
    }

    // 自定义提示
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
        setTimeout(() => {
            alert.remove();
        }, 800);
    }

    // ---------- 事件绑定 ----------
    scrollTopButton.addEventListener('click', scrollTop);
    numBigButton.addEventListener('click', numBig);
    copyButton.addEventListener('click', copy);
    clearButton.addEventListener('click', clear);
    xhButton.addEventListener('click', xhText);
    cleanMarkdownButton.addEventListener('click', cleanMarkdown);
    editor.addEventListener('input', updateReadTime);
    cbzButton.addEventListener('click', linkCbz);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            clear();
        }
    });
});