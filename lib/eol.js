/**
 * cb-editbox/lib/eol.js — EOL 统计、主导判定、归一与转换
 *
 * 三种换行：crlf(\r\n) / lf(\n) / cr(\r)。
 * 计数规则：\r\n 整体计 crlf；未跟 \n 的 \r 计 cr；未跟 \r 的 \n 计 lf。
 */

const EOL_CHARS = { crlf: '\r\n', lf: '\n', cr: '\r' };

/**
 * 统计文本中的换行分布
 * @returns {{ counts: {crlf:number, lf:number, cr:number}, dominant: string|null, mixed: boolean }}
 *          无任何换行时 dominant 为 null
 */
function analyzeEol(text) {
    const counts = { crlf: 0, lf: 0, cr: 0 };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '\r') {
            if (text[i + 1] === '\n') { counts.crlf++; i++; }
            else { counts.cr++; }
        } else if (ch === '\n') {
            counts.lf++;
        }
    }
    let dominant = null;
    let max = 0;
    const kinds = ['crlf', 'lf', 'cr'];
    for (const kind of kinds) {
        if (counts[kind] > max) { max = counts[kind]; dominant = kind; }
    }
    const used = kinds.filter(k => counts[k] > 0).length;
    return { counts, dominant, mixed: used > 1 };
}

/** 将任意换行统一为目标风格（先归一为 \n 再映射） */
function convertEol(text, target) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (target === 'lf') return normalized;
    const seq = EOL_CHARS[target];
    return normalized.replace(/\n/g, seq);
}

/** 归一为 \n（供编辑器内部使用） */
function normalizeLf(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = { analyzeEol, convertEol, normalizeLf, EOL_CHARS };
