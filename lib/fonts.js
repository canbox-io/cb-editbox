/**
 * lib/fonts.js — 系统字体枚举
 *
 * 跨平台获取已安装字体族列表：
 *   Linux   → fontconfig `fc-list : family`
 *   Windows → 注册表 HKLM\...\Fonts（解析显示名，去样式后缀）
 *   macOS   → /System/Library/Fonts、/Library/Fonts、~/Library/Fonts
 * 结果与一份常见字体清单合并，保证跨平台常用字体始终可选。
 *
 * 字体不内置：操作系统已自带大量字体，随包附带会让安装包膨胀数百 MB；
 * 用户可在设置中手动输入任意字体名（allow-create）。
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// 各平台常见/广泛可用的字体（即使枚举失败也出现在列表中）
const COMMON_FONTS = [
    'Arial', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas',
    'Constantia', 'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console',
    'Microsoft YaHei', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
    'Verdana', 'Courier',
    'Noto Sans', 'Noto Serif', 'Noto Sans Mono', 'Source Code Pro', 'Fira Code',
    'JetBrains Mono', 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono',
    'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
    'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei',
    'Ubuntu', 'Ubuntu Mono', 'Cantarell',
    'PingFang SC', 'Menlo', 'Monaco', 'SF Mono'
];

function listLinuxFonts() {
    return new Promise((resolve) => {
        execFile('fc-list', [':', 'family'], { timeout: 5000 }, (err, stdout) => {
            if (err) return resolve([]);
            const names = new Set();
            stdout.split('\n').forEach((line) => {
                line.split(',').forEach((part) => {
                    const name = part.trim();
                    if (name) names.add(name);
                });
            });
            resolve([...names]);
        });
    });
}

function listWindowsFonts() {
    return new Promise((resolve) => {
        const regExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe');
        execFile(regExe, ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'], { timeout: 5000 }, (err, stdout) => {
            if (err) return resolve([]);
            const names = new Set();
            const styleSuffix = /\s+(Bold|Italic|Regular|Light|Medium|Black|Thin|SemiBold|ExtraBold|Oblique|BoldItalic|Heavy|Hairline)$/i;
            stdout.split('\n').forEach((line) => {
                const m = line.match(/^\s+(.+?)\s+REG_SZ/);
                if (!m) return;
                const name = m[1]
                    .replace(/\s*\((TrueType|OpenType)\)$/i, '')
                    .replace(styleSuffix, '')
                    .trim();
                if (name) names.add(name);
            });
            resolve([...names]);
        });
    });
}

function listMacFonts() {
    const dirs = [
        '/System/Library/Fonts',
        '/Library/Fonts',
        path.join(process.env.HOME || '', 'Library/Fonts')
    ];
    const names = new Set();
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir)) {
            if (/\.(ttf|otf|ttc)$/i.test(file)) {
                names.add(file.replace(/\.(ttf|otf|ttc)$/i, '').replace(/-+/g, ' '));
            }
        }
    }
    return [...names];
}

/**
 * 获取系统全部字体族（已去重、按字母排序，常用字体合并在内）
 * @returns {Promise<string[]>}
 */
async function listFonts() {
    let platformFonts = [];
    if (process.platform === 'linux') {
        platformFonts = await listLinuxFonts();
    } else if (process.platform === 'win32') {
        platformFonts = await listWindowsFonts();
    } else if (process.platform === 'darwin') {
        platformFonts = listMacFonts();
    }
    const merged = new Set(platformFonts);
    COMMON_FONTS.forEach((f) => merged.add(f));
    return [...merged].sort((a, b) => a.localeCompare(b));
}

module.exports = { listFonts };
