<template>
    <div ref="hostEl" class="cm-host" :style="fontStyle"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { indentWithTab, undo, redo, selectAll } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { openSearchPanel } from '@codemirror/search';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEditorStore } from '@/stores/editor';

const props = defineProps({
    tab: { type: Object, required: true }
});

const store = useEditorStore();
const hostEl = ref(null);
let view = null;
const languageComp = new Compartment();
const wrapComp = new Compartment();
const lineNumComp = new Compartment();
const themeComp = new Compartment();

const cursorSave = { line: 1, col: 1, scrollTop: 0 };

// 字体通过 CSS 变量驱动（由父级/全局设置更新）
const fontFamily = ref('Consolas, "Courier New", monospace');
const fontSize = ref('15px');
const fontStyle = computed(() => ({
    '--editor-font-family': fontFamily.value,
    '--editor-font-size': fontSize.value
}));

function loadLanguage(view2, filename) {
    const desc = LanguageDescription.matchFilename(languages, filename || '');
    if (!desc) {
        view2.dispatch({ effects: languageComp.reconfigure([]) });
        return;
    }
    desc.load().then((support) => {
        if (view2 && !view2.destroyed) {
            view2.dispatch({ effects: languageComp.reconfigure(support) });
        }
    }).catch(() => {
        if (view2 && !view2.destroyed) {
            view2.dispatch({ effects: languageComp.reconfigure([]) });
        }
    });
}

// 按语言名称手动切换（菜单 → 语言）
function setLanguage(name) {
    if (!view || view.destroyed) return;
    const desc = languages.find(l => l.name === name);
    if (!desc) {
        view.dispatch({ effects: languageComp.reconfigure([]) });
        return;
    }
    desc.load().then((support) => {
        if (view && !view.destroyed) {
            view.dispatch({ effects: languageComp.reconfigure(support) });
        }
    });
}

onMounted(async () => {
    // 读取视图/字体/主题设置
    let wordWrap = true, lineNumbers = true, dark = false;
    try {
        const s = await window.editbox.settingsGetAll();
        if (s.wordWrap === false) wordWrap = false;
        if (s.lineNumbers === false) lineNumbers = false;
        if (s.editorFontFamily) fontFamily.value = s.editorFontFamily;
        if (s.editorFontSize) fontSize.value = s.editorFontSize;
        dark = s.theme === 'dark'
            || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { /* 用默认值 */ }

    const state = EditorState.create({
        doc: props.tab.content,
        extensions: [
            basicSetup,
            keymap.of([indentWithTab]),
            languageComp.of([]),
            wrapComp.of(wordWrap ? EditorView.lineWrapping : []),
            lineNumComp.of(lineNumbers ? [] : EditorView.theme({ '.cm-gutters': { display: 'none !important' } })),
            themeComp.of(dark ? oneDark : []),
            EditorView.updateListener.of((update) => {
                if (!update.docChanged && !update.selectionSet && !update.geometryChanged) return;
                const line = update.state.doc.lineAt(update.state.selection.main.head);
                cursorSave.line = line.number;
                cursorSave.col = update.state.selection.main.head - line.from + 1;
                if (update.geometryChanged) {
                    cursorSave.scrollTop = update.view.scrollDOM.scrollTop;
                }
                if (update.docChanged) {
                    store.markDirty(props.tab.id, {
                        content: update.state.doc.toString(),
                        cursorLine: cursorSave.line,
                        cursorCol: cursorSave.col,
                        scrollTop: cursorSave.scrollTop
                    });
                } else {
                    store.updateCursor(props.tab.id, cursorSave.line, cursorSave.col);
                }
            })
        ]
    });
    view = new EditorView({ state, parent: hostEl.value });
    view.scrollDOM.addEventListener('scroll', () => {
        store.updateScroll(props.tab.id, view.scrollDOM.scrollTop);
    });
    loadLanguage(view, props.tab.name);
    // 恢复光标与滚动位置
    try {
        const lineInfo = view.state.doc.line(props.tab.cursorLine || 1);
        const pos = Math.min(lineInfo.from + (props.tab.cursorCol ? props.tab.cursorCol - 1 : 0), lineInfo.to);
        view.dispatch({ selection: { anchor: pos } });
    } catch (e) { /* 越界则保持默认 */ }
    if (props.tab.scrollTop) {
        requestAnimationFrame(() => {
            view.scrollDOM.scrollTop = props.tab.scrollTop;
        });
    }
    // 新建/打开/恢复后，若本编辑器处于激活状态则自动聚焦
    // （onMounted 为 async，父级 nextTick 调 focusEditor 时 view 可能尚未创建）
    if (store.activeId === props.tab.id) {
        requestAnimationFrame(() => {
            if (view && !view.destroyed) view.focus();
        });
    }
});

// 外部内容替换（重载 / 会话恢复备份）
watch(() => props.tab.docRev, () => {
    if (!view || view.destroyed) return;
    const current = view.state.doc.toString();
    if (current === props.tab.content) return;
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: props.tab.content }
    });
});

// 文件名变化（另存为）→ 重配语言
watch(() => props.tab.name, (name) => {
    if (view && !view.destroyed) loadLanguage(view, name);
});

// 暴露给菜单栏/设置窗口的命令
function focusEditor() {
    if (view && !view.destroyed) view.focus();
}
function setWordWrap(on) {
    if (!view || view.destroyed) return;
    view.dispatch({ effects: wrapComp.reconfigure(on ? EditorView.lineWrapping : []) });
}
function setLineNumbers(on) {
    if (!view || view.destroyed) return;
    view.dispatch({ effects: lineNumComp.reconfigure(on ? [] : EditorView.theme({ '.cm-gutters': { display: 'none !important' } })) });
}
function setEditorFont(family, size) {
    if (family) fontFamily.value = family;
    if (size) fontSize.value = size;
}
function setAppTheme(dark) {
    if (!view || view.destroyed) return;
    view.dispatch({ effects: themeComp.reconfigure(dark ? oneDark : []) });
}
function undoCmd() {
    if (view && !view.destroyed) { view.focus(); undo(view); }
}
function redoCmd() {
    if (view && !view.destroyed) { view.focus(); redo(view); }
}
function selectAllCmd() {
    if (view && !view.destroyed) { view.focus(); selectAll(view); }
}
function openFind() {
    if (view && !view.destroyed) { view.focus(); openSearchPanel(view); }
}
function openReplace() {
    if (view && !view.destroyed) {
        view.focus();
        openSearchPanel(view);
        requestAnimationFrame(() => {
            const panel = view.dom.querySelector('.cm-panel-search');
            if (!panel) return;
            const btns = Array.from(panel.querySelectorAll('button'));
            const toggle = btns.find(b => !b.classList.contains('cm-button')) || btns[btns.length - 1];
            if (toggle) {
                toggle.click();
                if (!panel.querySelector('.cm-replace')) {
                    for (const b of btns) {
                        if (b === toggle) continue;
                        b.click();
                        if (panel.querySelector('.cm-replace')) break;
                    }
                }
            }
        });
    }
}
function cutCmd() {
    if (view && !view.destroyed) { view.focus(); document.execCommand('cut'); }
}
function copyCmd() {
    if (view && !view.destroyed) { view.focus(); document.execCommand('copy'); }
}
function pasteCmd() {
    if (view && !view.destroyed) { view.focus(); document.execCommand('paste'); }
}

defineExpose({
    focusEditor, setLanguage, setWordWrap, setLineNumbers, setEditorFont, setAppTheme,
    undoCmd, redoCmd, selectAllCmd, openFind, openReplace, cutCmd, copyCmd, pasteCmd
});

onBeforeUnmount(() => {
    if (view) view.destroy();
    view = null;
});
</script>

<style scoped>
.cm-host {
    height: 100%;
    overflow: hidden;
}
.cm-host :deep(.cm-editor) {
    height: 100%;
}
.cm-host :deep(.cm-scroller) {
    font-family: var(--editor-font-family, Consolas, 'Courier New', monospace);
    font-size: var(--editor-font-size, 15px);
    line-height: 1.6;
}
</style>
