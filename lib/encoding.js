/**
 * cb-editbox/lib/encoding.js — 编码探测与编解码
 *
 * 探测顺序：BOM 优先（utf-8 / utf-16le / utf-16be），否则 chardet 采样探测。
 * 编码名统一小写并经 iconv-lite.encodingExists 校验，不支持的回退 utf-8。
 */
const iconv = require('iconv-lite');
const chardet = require('chardet');

const SAMPLE_LEN = 64 * 1024;

const BOM_UTF8 = Buffer.from([0xEF, 0xBB, 0xBF]);
const BOM_UTF16LE = Buffer.from([0xFF, 0xFE]);
const BOM_UTF16BE = Buffer.from([0xFE, 0xFF]);

function encodingSupported(name) {
    return Boolean(name) && iconv.encodingExists(String(name).toLowerCase());
}

/**
 * 探测 Buffer 的编码
 * @returns {{ encoding: string, hasBom: boolean }}
 */
function detectEncoding(buf) {
    if (buf.length >= 3 && buf.subarray(0, 3).equals(BOM_UTF8)) {
        return { encoding: 'utf-8', hasBom: true };
    }
    if (buf.length >= 2 && buf.subarray(0, 2).equals(BOM_UTF16LE)) {
        return { encoding: 'utf-16le', hasBom: true };
    }
    if (buf.length >= 2 && buf.subarray(0, 2).equals(BOM_UTF16BE)) {
        return { encoding: 'utf-16be', hasBom: true };
    }
    const sample = buf.subarray(0, Math.min(buf.length, SAMPLE_LEN));
    let guessed = '';
    try {
        guessed = chardet.detect(sample) || '';
    } catch (e) {
        guessed = '';
    }
    const lowered = String(guessed).toLowerCase();
    const mapped = lowered === 'ascii' ? 'utf-8' : lowered;
    if (encodingSupported(mapped)) {
        return { encoding: mapped, hasBom: false };
    }
    return { encoding: 'utf-8', hasBom: false };
}

function decode(buf, encoding) {
    return iconv.decode(buf, encoding);
}

/**
 * 编码并检测有损：encode 后回读与原文不一致即视为当前编码无法完整表达
 * @returns {{ buffer: Buffer, lossy: boolean }}
 */
function encodeWithLossyCheck(text, encoding) {
    const buffer = iconv.encode(text, encoding);
    const roundTrip = iconv.decode(buffer, encoding);
    return { buffer, lossy: roundTrip !== text };
}

function bomBuffer(encoding, hasBom) {
    if (!hasBom) return null;
    if (encoding === 'utf-8') return BOM_UTF8;
    if (encoding === 'utf-16le') return BOM_UTF16LE;
    if (encoding === 'utf-16be') return BOM_UTF16BE;
    return null;
}

module.exports = { detectEncoding, decode, encodeWithLossyCheck, bomBuffer, encodingSupported };
