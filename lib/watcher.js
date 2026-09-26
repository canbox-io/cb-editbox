/**
 * cb-editbox/lib/watcher.js — 文件外部修改监视
 *
 * 以"目录级 fs.watch + 文件 stat 基线比对"实现：
 *   - 目录级监听对 inode 替换（编辑器原子写、git checkout）稳定；
 *   - 基线 = 主进程最后一次写盘或 openFile 时记录的 {mtimeMs, size}；
 *   - stat 与基线一致 → 自身写入或无关事件，忽略；不一致 → 外部修改，
 *     更新基线并回调通知。
 */
const fs = require('fs');
const path = require('path');

// dir → { watcher, refCount }
const _dirWatchers = new Map();
// filePath → { mtimeMs, size, onExternal }
const _baselines = new Map();

function ensureDirWatcher(dir) {
    let entry = _dirWatchers.get(dir);
    if (entry) {
        entry.refCount++;
        return;
    }
    const watcher = fs.watch(dir, { persistent: false }, () => {
        handleDirEvent(dir);
    });
    _dirWatchers.set(dir, { watcher, refCount: 1 });
}

function releaseDirWatcher(dir) {
    const entry = _dirWatchers.get(dir);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
        try { entry.watcher.close(); } catch (e) { /* 已关闭则忽略 */ }
        _dirWatchers.delete(dir);
    }
}

function handleDirEvent(dir) {
    for (const [filePath, baseline] of _baselines) {
        if (path.dirname(filePath) !== dir) continue;
        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch (e) {
            continue; // 文件暂时不可 stat（被删除/重命名中），由下次事件重试
        }
        if (stat.mtimeMs === baseline.mtimeMs && stat.size === baseline.size) continue;
        baseline.mtimeMs = stat.mtimeMs;
        baseline.size = stat.size;
        try {
            baseline.onExternal(filePath, { mtimeMs: stat.mtimeMs, size: stat.size });
        } catch (e) { /* 回调异常不中断 watcher */ }
    }
}

/**
 * 登记监视一个文件
 * @param {string} filePath 绝对路径
 * @param {{mtimeMs:number, size:number}} baseline 初始基线
 * @param {(filePath:string, stat:{mtimeMs:number,size:number})=>void} onExternal 外部修改回调
 */
function watchFile(filePath, baseline, onExternal) {
    _baselines.set(filePath, { mtimeMs: baseline.mtimeMs, size: baseline.size, onExternal });
    ensureDirWatcher(path.dirname(filePath));
}

/** 主进程写盘成功后调用：把基线刷新为新 stat，避免自身写入被当成外部修改 */
function updateBaseline(filePath, stat) {
    const baseline = _baselines.get(filePath);
    if (baseline) {
        baseline.mtimeMs = stat.mtimeMs;
        baseline.size = stat.size;
    }
}

function unwatchFile(filePath) {
    if (!_baselines.has(filePath)) return;
    _baselines.delete(filePath);
    releaseDirWatcher(path.dirname(filePath));
}

module.exports = { watchFile, unwatchFile, updateBaseline };
