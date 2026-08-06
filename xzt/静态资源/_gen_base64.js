const fs = require('fs');

const DIR = 'd:/BaiduSyncdisk/WWW/gitpage/xzt项目/feat/静态资源';

// 读取徽章图片
const badgeB64 = 'data:image/png;base64,' + fs.readFileSync(DIR + '/徽章.png').toString('base64');

// 读取两个二维码
const dulinB64 = 'data:image/png;base64,' + fs.readFileSync(DIR + '/杜林二维码.png').toString('base64');
const lxbB64 = 'data:image/png;base64,' + fs.readFileSync(DIR + '/罗小布二维码.png').toString('base64');

// 生成 img_base64.js
const content = `// 所有图片 base64 数据，单独存放便于维护
var BADGE_DATA_URL = '${badgeB64}';
var DULIN_QR_DATA_URL = '${dulinB64}';
var LUOXIAOBU_QR_DATA_URL = '${lxbB64}';
`;

fs.writeFileSync('d:/BaiduSyncdisk/WWW/gitpage/xzt项目/feat/img_base64.js', content);
console.log('img_base64.js created, size=' + content.length);
