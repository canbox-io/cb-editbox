<template>
    <div ref="hostEl" class="cm-host" :style="fontStyle"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { EditorView, ViewPlugin, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { indentWithTab, undo, redo, selectAll } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { openSearchPanel, search, searchPanelOpen } from '@codemirror/search';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEditorStore } from '@/stores/editor';

const props = defineProps({
    tab: { type: Object, required: true }
});

const { t } = useI18n();

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

// 面板按钮已图标化、开关已符号化，此处补上悬浮提示
function decorateSearchPanel(view2) {
    const panel = view2.dom.querySelector('.cm-panel.cm-search');
    if (!panel) return;
    const titles = {
        'button[name="next"]': t('act.findNext'),
        'button[name="prev"]': t('act.findPrev'),
        'button[name="select"]': t('act.selectAllMatches'),
        'button[name="replace"]': t('act.replaceOne'),
        'button[name="replaceAll"]': t('act.replaceAll'),
        'button[name="close"]': t('act.closeFindPanel'),
        'label:has(input[name="case"])': t('act.matchCase'),
        'label:has(input[name="word"])': t('act.wholeWord'),
        'label:has(input[name="re"])': t('act.useRegexp')
    };
    for (const selector of Object.keys(titles)) {
        const el = panel.querySelector(selector);
        if (el && el.title !== titles[selector]) el.title = titles[selector];
    }
}

const searchPanelDecorator = ViewPlugin.fromClass(class {
    constructor(view2) { decorateSearchPanel(view2); }
    update(update) {
        if (searchPanelOpen(update.state)) decorateSearchPanel(update.view);
    }
});

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
            // 查找/替换面板固定在编辑器顶部（默认在底部）
            search({ top: true }),
            searchPanelDecorator,
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
/* 查找/替换面板：参照 VSCode —— 两行排布，从替换输入框起换行，按钮全部图标化 */
.cm-host :deep(.cm-panel.cm-search) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 8px 38px 8px 10px;
    font-size: var(--editor-font-size, 15px);
}
.cm-host :deep(.cm-panel.cm-search input.cm-textfield) {
    width: 220px;
    height: 26px;
    margin: 0;
    padding: 0 8px;
    font-size: 100%;
    border-radius: 4px;
}
/* CodeMirror 用 <br> 分隔查找行与替换行，但 flex 容器里 <br> 不撑宽、不换行，
   故隐藏它，改用面板自身的 ::before 作为撑满一行的换行块 */
.cm-host :deep(.cm-panel.cm-search br) {
    display: none;
}
.cm-host :deep(.cm-panel.cm-search)::before {
    content: '';
    order: 7;
    flex: 0 0 100%;
    height: 0;
}
/* 开关（区分大小写 / 全字匹配 / 正则）：隐藏复选框与内置文字，改用符号，选中时加底色 */
.cm-host :deep(.cm-panel.cm-search label) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 26px;
    margin: 0;
    font-size: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
}
.cm-host :deep(.cm-panel.cm-search label input[type='checkbox']) {
    display: none;
}
.cm-host :deep(.cm-panel.cm-search label)::before {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 14px;
    line-height: 1;
}
.cm-host :deep(.cm-panel.cm-search label:has(input[name='case']))::before { content: 'Aa'; }
.cm-host :deep(.cm-panel.cm-search label:has(input[name='word']))::before { content: 'ab'; }
.cm-host :deep(.cm-panel.cm-search label:has(input[name='re']))::before { content: '.*'; }
.cm-host :deep(.cm-panel.cm-search label:hover) {
    background-color: rgba(127, 127, 127, 0.2);
}
.cm-host :deep(.cm-panel.cm-search label:has(input:checked)) {
    background-color: rgba(127, 127, 127, 0.35);
}
/* 按钮：隐藏内置文字，改用 SVG 图标（蒙版取 currentColor，自动适配明暗主题） */
.cm-host :deep(.cm-panel.cm-search button.cm-button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin: 0;
    padding: 0;
    font-size: 0;
    color: inherit;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.cm-host :deep(.cm-panel.cm-search button.cm-button)::before {
    content: '';
    width: 16px;
    height: 16px;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: 16px 16px;
    -webkit-mask-image: var(--search-panel-icon);
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: 16px 16px;
    mask-image: var(--search-panel-icon);
}
.cm-host :deep(.cm-panel.cm-search button.cm-button:hover) {
    background-color: rgba(127, 127, 127, 0.2);
}
.cm-host :deep(.cm-panel.cm-search button[name='next']) {
    --search-panel-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6.5l4 4 4-4'/%3E%3C/svg%3E");
}
.cm-host :deep(.cm-panel.cm-search button[name='prev']) {
    --search-panel-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9.5l4-4 4 4'/%3E%3C/svg%3E");
}
.cm-host :deep(.cm-panel.cm-search button[name='select']) {
    --search-panel-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2.5' y='2.5' width='11' height='11' rx='2'/%3E%3Cpath d='M5.4 8.2l1.9 1.9 3.5-4.2'/%3E%3C/svg%3E");
}
.cm-host :deep(.cm-panel.cm-search button[name='replace']) {
    --search-panel-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.2 4.6v6.8'/%3E%3Cpath d='M6.4 8h6.5'/%3E%3Cpath d='M10 5.1L12.9 8 10 10.9'/%3E%3C/svg%3E");
}
.cm-host :deep(.cm-panel.cm-search button[name='replaceAll']) {
    --search-panel-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5.5h6.2'/%3E%3Cpath d='M6.8 3.1L9.2 5.5 6.8 7.9'/%3E%3Cpath d='M3 10.5h6.2'/%3E%3Cpath d='M6.8 8.1L9.2 10.5 6.8 12.9'/%3E%3C/svg%3E");
}
/* 关闭按钮：右上角，与查找行居中对齐 */
.cm-host :deep(.cm-panel.cm-search [name='close']) {
    top: 9px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    font-size: 15px;
    line-height: 1;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
.cm-host :deep(.cm-panel.cm-search [name='close']:hover) {
    background-color: rgba(127, 127, 127, 0.2);
}
/* 排列顺序参照 VSCode：输入框 → 开关 → 选中全部匹配 → 上一个/下一个靠右 → 换行 → 替换 */
.cm-host :deep(.cm-panel.cm-search input[name='search']) { order: 0; }
.cm-host :deep(.cm-panel.cm-search label:has(input[name='case'])) { order: 1; }
.cm-host :deep(.cm-panel.cm-search label:has(input[name='word'])) { order: 2; }
.cm-host :deep(.cm-panel.cm-search label:has(input[name='re'])) { order: 3; }
.cm-host :deep(.cm-panel.cm-search button[name='select']) { order: 4; }
.cm-host :deep(.cm-panel.cm-search button[name='next']) { order: 5; margin-left: auto; }
.cm-host :deep(.cm-panel.cm-search button[name='prev']) { order: 6; }
.cm-host :deep(.cm-panel.cm-search input[name='replace']) { order: 8; }
.cm-host :deep(.cm-panel.cm-search button[name='replace']) { order: 9; }
.cm-host :deep(.cm-panel.cm-search button[name='replaceAll']) { order: 10; }
</style>
