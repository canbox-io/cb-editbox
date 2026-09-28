import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.use(ElementPlus);
app.mount('#app');

// ====== 缩放快捷键（Ctrl+滚轮；Ctrl+=/-/0 在主进程 before-input-event 处理） ======
let currentZoom = 1.0;
window.editbox.zoomGet().then((factor) => {
    currentZoom = factor || 1;
}).catch(() => {});

async function adjustZoom(delta) {
    let next = Math.max(0.5, Math.min(2.0, currentZoom + delta));
    next = Math.round(next * 10) / 10;
    if (next !== currentZoom) {
        currentZoom = next;
        await window.editbox.zoomSet(currentZoom);
    }
}

document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        adjustZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }
}, { passive: false });

// Ctrl+PageUp/PageDown 切换上一个/下一个标签页；
// Ctrl+Shift+PageUp/PageDown 将当前标签页前移/后移一位
// （其余快捷键由原生菜单 accelerator 接管）
document.addEventListener('keydown', async (e) => {
    if (!e.ctrlKey) return;
    if (e.code !== 'PageUp' && e.code !== 'PageDown') return;
    e.preventDefault();
    const { useEditorStore } = await import('@/stores/editor');
    const store = useEditorStore();
    const dir = e.code === 'PageDown' ? 1 : -1;
    if (e.shiftKey) {
        if (store.activeId !== null) store.moveTab(store.activeId, dir);
    } else {
        switchTab(store, dir);
    }
});

function switchTab(store, dir) {
    if (store.tabs.length === 0) return;
    const idx = store.tabs.findIndex(t => t.id === store.activeId);
    const next = (idx + dir + store.tabs.length) % store.tabs.length;
    store.activeId = store.tabs[next].id;
    store.persistSession();
}
