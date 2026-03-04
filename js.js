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
    // const quan = document.getElementById('quan');
    // 获取当前URL
    var currentUrl = window.location.href;

    // 定义一个函数来计算包含中文、英文字母和数字的字数
    function countWords(text) {
        // 使用正则表达式匹配中文字符、英文字母和数字
        var wordRegex = /[\u4e00-\u9fa5a-zA-Z0-9]+/g;
        var matches = text.match(wordRegex);
        // 将匹配到的字符数组转换为字符串，并计算长度
        return matches ? matches.join('').length : 0;
    }

    // 更新字数显示的函数
    function updateReadTime() {
        var text = editor.value; // 获取文本框中的文本
        var wordCount = countWords(text); // 计算字数
        var readTime = madeReadTime(wordCount)//计算阅读
        read.textContent = "全文 " + wordCount + " 字 预计 " + readTime + " 分钟"; // 更新字数显示
    }


    //置顶按钮
    function scrollTop() {
        editor.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth' // 平滑滚动效果
        });
    }

    // 从localStorage加载文本
    function loadText() {
        const text = localStorage.getItem(currentUrl);
        if (text) {
            editor.value = text;
        } else {
            localStorage.removeItem(currentUrl);

        }
    }
    loadText(); // 页面加载时执行
    // 页面加载完成后立即更新字数
    updateReadTime();
    editor.scrollBy = 0;

    // 保存文本到localStorage
    function saveText() {
        const text = editor.value;
        localStorage.setItem(currentUrl, text);
    }
    //快捷键
    function handleKeyDown(event) {
        // 快捷键 alt + 1 调用 排版 方法
        if (event.altKey && event.key === '1') {
            event.preventDefault(); // 阻止默认的保存行为
            reformatText(); // 调用重新排版文本的方法
        }
        //alt+2 置顶
        if (event.altKey && event.key === '2') {
            event.preventDefault(); // 阻止默认的保存行为
            scrollTop(); // 置顶
        }
        //alt+3 字体
        if (event.altKey && event.key === '3') {
            event.preventDefault(); // 阻止默认的保存行为
            numBig(); // 字体
        }
        //alt+C
        if (event.altKey && event.key.toLowerCase() === 'c') {
            event.preventDefault(); // 阻止默认的保存行为
            copy(); //复制
        }

        //ctrl+sb保存
        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault(); // 阻止默认的保存行为
            reformatText();
        }

    }
    document.addEventListener('keydown', handleKeyDown);



    function madeReadTime(wordCount) {
        // 执行除法并四舍五入保留1位小数
        const result = wordCount / 350;
        // toFixed(1)返回字符串，用Number转换为数值类型
        return Number(result.toFixed(1));
    }
    //加花边字
    function addFancyBorders() {
        // 这里是一些示例的花边字符，你可以根据需要添加更多
        // const fancyChars = ['໌້', 'ᮨ', '⋆', '☼', '⚝', '⚚', '⚙', '⚛', '⚜', '☽', '☾', '໌້', 'ᮨ', '⋆', '⁰', 'ʚ', 'ོ', 'ɞ'];


        const fancyChars = ['໌້', ' ຼ'];
        let text = editor.value;
        // 将文本分割成单个字符数组
        const characters = text.split('');
        const decoratedText = characters.map(char => char); // 创建一个可修改的副本

        // 正则表达式匹配标点符号
        const punctuationRegex = /[.,、\/#!$%\^&\*;:{}=\-_`~()]/g;
        // 正则表达式匹配空行
        const newlineRegex = /\n/g;
        // 正则表达式匹配数字
        const digitRegex = /\d/g;

        // 找出所有标点符号、空行和数字的位置
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

        // 随机插入花边字符
        for (let i = 0; i < decoratedText.length; i++) {

            // 检查当前位置是否是标点符号、空行或数字
            if (indexesToSkip.includes(i)) {
                continue;
            }
            // 随机选择一个花边字符
            const randomChar = fancyChars[Math.floor(Math.random() * fancyChars.length)];

            const random_number = Math.floor(Math.random() * 9);
            if (i % random_number === 0 && Math.random() > 0.9) { // 这里0.7是随机添加花边字符的概率，数字越大花边越少
                decoratedText[i] += randomChar;
            }

        }

        // 将字符数组重新组合成字符串
        editor.value = decoratedText.join('');
    }

    //替换保险的险字
    // 定义一个函数来切换替换
    // function toggleReplace() {
    //     let text = editor.value;
    //     const clickCount = localStorage.getItem('clickCount');
    //     if (clickCount) {
    //         text = text.replace(/β佥/g, '险');
    //         text = text.replace(/β日/g, '阳');
    //         text = text.replace(/者β/g, '都');
    //         localStorage.removeItem('clickCount');

    //     } else {
    //         text = text.replace(/险/g, 'β佥');
    //         text = text.replace(/阳/g, 'β日');
    //         text = text.replace(/都/g, '者β');
    //         localStorage.setItem('clickCount', 1);
    //     }

    //     editor.value = text;
    // }
    //数字加粗-来回切换
    function numBig() {
        let text = editor.value;
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

        editor.value = text;
    }

    // 重新排版文本
    function reformatText() {
        let text = editor.value;
        if (text) {
            // 把英文的,:改为正文的，：
            text = text.replace(/,/g, '，').replace(/:/g, '：');
            // 在中文和英文/数字之间插入空格
            text = text.replace(/([\u4e00-\u9fa5])([A-Za-z0-9])/g, '$1 $2');
            text = text.replace(/([A-Za-z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
            //引号替换「」
            text = text.replace(/“/g, '「').replace(/”/g, '」');
            // 在数字和中文/英文之间插入空格
            text = text.replace(/([\u4e00-\u9fa5])(\d)/g, '$1 $2');
            text = text.replace(/(\d)([A-Za-z\u4e00-\u9fa5])/g, '$1 $2');
            //序号替换为顿号,有问题，数字3.2万这种会替换成3、2万
            //text = text.replace(/(\d+)\./g, '$1、').replace(/(\d+)、\s+/g, '$1、')
            //百分号后面空格问题
            text = text.replace(/%([\u4e00-\u9fa5])/g, '% $1');
            text = text.replace(/%\s+(?=[，,])/g, '%');
            //去掉语音开始和结束字段
            text = text.replace(new RegExp('\\[语音开始\\]', 'g'), '');
            text = text.replace(new RegExp('\\[语音结束\\]', 'g'), '');
            //去掉文字开头的空行
            text = text.replace(/^\s+/, '');
            //去掉多余空行
            text = text.replace(/(\n\s*){2,}/g, '\n\n');
            //去掉最后一行的空行
            text = removeTrailingEmptyLines(text)
            editor.value = text;
            //获取标题
            // getTitle();
            saveText();
            showAutoCloseAlert("已美化保存")
        } else {
            localStorage.removeItem(currentUrl);
        }

    }
    //复制文本
    async function copy(type) {
        await navigator.clipboard.writeText(editor.value);
        if (type !== "linkCbz") {
            showAutoCloseAlert("复制成功")

        }
    }
    //删除最后一行的空行
    function removeTrailingEmptyLines(text) {
        // 将文本按行分割
        var lines = text.split('\n');

        // 找到最后一个非空行
        var lastNonEmptyLineIndex = lines.reduce((index, line, idx) => {
            return line.trim() ? idx : index;
        }, -1);

        // 如果所有行都是空的，返回空字符串
        if (lastNonEmptyLineIndex === -1) {
            return '';
        }

        // 重新组合文本，不包括最后一个非空行之后的所有行
        return lines.slice(0, lastNonEmptyLineIndex + 1).join('\n');
    }
    //清除markdown
    function cleanMarkdown() {
        let text = editor.value;

        // 去除加粗标识 **
        text = text.replace(/\*\*/g, '');

        // 将连续的多个#替换为一个空行
        text = text.replace(/#+/g, '\n\n');

        // 将有序列表 1. 转换为 1、并添加空行
        text = text.replace(/(\d+)\.\s*(.+)/g, '\n$1、$2\n\n');

        // 规范无序列表格式并添加空行
        text = text.replace(/^[\s\uFEFF\xA0]*-/gm, '-') // 先规范格式
            .replace(/^(-.*)/gm, '$1\n');        // 在-行后添加空行

        //去掉多余空行
        text = text.replace(/(\n\s*){2,}/g, '\n\n');
        //去掉最后一行的空行
        text = removeTrailingEmptyLines(text)

        // 将处理后的文本重新赋值给编辑器
        editor.value = text;
        reformatText();
        scrollTop();

    }



    //获取标题
    function getTitle() {
        var text = editor.value;
        var truncatedText = '';
        var charCount = 0;

        for (var i = 0; i < text.length; i++) {
            var code = text.charCodeAt(i);
            // 检查是否是汉字，汉字的Unicode编码范围大致在\u4e00到\u9fa5之间
            if (code >= 0x4e00 && code <= 0x9fa5) {
                charCount++;
                if (charCount > 24) break;
            }
            truncatedText += text[i];
        }

        // 检查是否包含换行符，并在第一个换行符之前截断
        var firstLineBreakIndex = truncatedText.indexOf('\n');
        if (firstLineBreakIndex !== -1) {
            truncatedText = truncatedText.substring(0, firstLineBreakIndex);
        }

        title.innerText = truncatedText;
    }
    //跳转到写作猫检查错别字
    function linkCbz() {
        copy('linkCbz');
    window.open('https://xiezuocat.com/pro/8689953271362609152', '_blank');
    }

    //清空
    function clear() {

        if (confirm('确定要清空吗？')) {
            // 用户点击"确定"，执行删除
            editor.value = '';
            localStorage.removeItem(currentUrl);
            location.reload(true);
        } else {
            // 用户点击"取消"，自动忽略，不执行任何操作
            return
        }


    }

    //全屏
    /**
    * 全屏切换功能函数
    * 点击事件触发，模拟F11全屏效果
    */
    // function quanPin() {
    //     // 获取文档元素
    //     const docElement = document.documentElement;

    //     // 检查浏览器是否支持全屏API
    //     const requestFullscreen = docElement.requestFullscreen ||
    //         docElement.mozRequestFullScreen ||
    //         docElement.webkitRequestFullscreen ||
    //         docElement.msRequestFullscreen;

    //     const exitFullscreen = document.exitFullscreen ||
    //         document.mozCancelFullScreen ||
    //         document.webkitExitFullscreen ||
    //         document.msExitFullscreen;

    //     // 检查当前是否处于全屏状态
    //     const isFullscreen = document.fullscreenElement ||
    //         document.mozFullScreenElement ||
    //         document.webkitFullscreenElement ||
    //         document.msFullscreenElement;

    //     try {
    //         if (!isFullscreen) {
    //             // 如果不是全屏状态，则进入全屏
    //             if (requestFullscreen) {
    //                 requestFullscreen.call(docElement);
    //             } else {
    //                 alert('您的浏览器不支持全屏功能');
    //             }
    //         } else {
    //             // 如果已经是全屏状态，则退出全屏
    //             if (exitFullscreen) {
    //                 exitFullscreen.call(document);
    //             }
    //         }
    //     } catch (error) {
    //         console.error('全屏操作失败:', error);
    //         alert('全屏操作失败，请重试');
    //     }
    // }

    // 使用示例：将函数绑定到按钮点击事件
    // document.getElementById('fullscreenBtn').addEventListener('click', quanPin);

    // 为页面中所有带有fullscreen-btn类的元素绑定点击事件
    // document.addEventListener('DOMContentLoaded', function () {
    //     const fullscreenButtons = document.querySelectorAll('.fullscreen-btn');
    //     fullscreenButtons.forEach(button => {
    //         button.addEventListener('click', quanPin);
    //     });
    // });
    //点击字数，隐藏标题
    // function displayTitle() {
    //     reformatText();
    //     var element = document.getElementById('title');
    //     if (element.textContent != "标题") {
    //         element.textContent = "标题";
    //     }
    // }
    // 自定义自动消失的提示框
    function showAutoCloseAlert(message) {
        const alert = document.createElement('div');
        // 磨砂玻璃效果核心样式
        alert.style.position = 'fixed';
        // alert.style.top = '50%';
        alert.style.bottom = '0.1%';
        alert.style.left = '50%';
        alert.style.transform = 'translate(-50%, -50%)';
        alert.style.padding = '20px 30px';
        alert.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; // 半透明白色
        alert.style.backdropFilter = 'blur(10px)'; // 磨砂模糊效果
        alert.style.border = '1px solid rgba(200, 200, 200, 0.5)'; // 半透明边框
        alert.style.borderRadius = '8px';
        alert.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)'; // 柔和阴影
        alert.style.zIndex = '9999';
        alert.style.color = 'black'; // 黑色文字
        alert.style.fontSize = '16px';

        alert.textContent = message;
        document.body.appendChild(alert);

        // 1秒后自动消失
        setTimeout(() => {
            alert.remove();
        }, 800);
    }
    // 为保存按钮添加点击事件监听器
    /*     saveButton.addEventListener('click', saveText); */
    // 为置顶按钮添加点击事件监听器
    scrollTopButton.addEventListener('click', scrollTop);

    // 为重新排版按钮添加点击事件监听器
    // document.getElementById('reformatButton').addEventListener('click', reformatText);

    // 为替换保险按钮添加点击事件监听器
    // toggleButton.addEventListener('click', toggleReplace);

    // 加花边
    // flowerButton.addEventListener('click', addFancyBorders);
    // 为数字加粗添加点击事件监听器
    numBigButton.addEventListener('click', numBig);
    //复制
    copyButton.addEventListener('click', copy);
    //清空
    clearButton.addEventListener('click', clear);
    //点击字数，隐藏标题
    // wordCountDisplay.addEventListener('click', displayTitle);
    //点击字数排版
    beautify.addEventListener('click', reformatText);
    //点击全屏
    // quan.addEventListener('click', quanPin);
    //清除markdown
    cleanMarkdownButton.addEventListener('click', cleanMarkdown);

    // 监听文本框的输入事件，实时更新字数
    editor.addEventListener('input', updateReadTime);
    cbzButton.addEventListener('click', linkCbz);

    //清空del
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            clear();
        }
    });

});
