<template>
    <div class="tabbar-wrap">
        <el-tabs
            :model-value="store.activeId"
            type="card"
            closable
            class="edit-tabs"
            @tab-change="(id) => { store.activeId = Number(id); store.persistSession(); }"
            @tab-remove="(id) => store.closeTab(Number(id))"
        >
            <el-tab-pane v-for="tab in store.tabs" :key="tab.id" :name="String(tab.id)">
                <template #label>
                    <span class="tab-label" :title="tab.path || tab.name"
                          @contextmenu.prevent="openMenu($event, tab)">
                        <span v-if="tab.dirty" class="dirty-dot">● </span>{{ tab.name }}
                    </span>
                </template>
            </el-tab-pane>
        </el-tabs>

        <div v-if="menu.visible" class="ctx-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
            <div class="ctx-item" @click="act('reload')">{{ $t('ctx.reload') }}</div>
            <div class="ctx-item" @click="act('reveal')">{{ $t('ctx.revealInFolder') }}</div>
            <div class="ctx-sep"></div>
            <div class="ctx-item" @click="act('close')">{{ $t('ctx.closeTab') }}</div>
            <div class="ctx-item" @click="act('closeOthers')">{{ $t('ctx.closeOthers') }}</div>
            <div class="ctx-item" @click="act('closeAll')">{{ $t('ctx.closeAll') }}</div>
        </div>
    </div>
</template>

<script setup>
import { reactive, onMounted, onBeforeUnmount } from 'vue';
import { useEditorStore } from '@/stores/editor';

const store = useEditorStore();
const menu = reactive({ visible: false, x: 0, y: 0, tabId: null });

function openMenu(e, tab) {
    menu.x = e.clientX;
    menu.y = e.clientY;
    menu.tabId = tab.id;
    menu.visible = true;
}

function closeMenu() {
    menu.visible = false;
}

async function act(kind) {
    closeMenu();
    const id = menu.tabId;
    if (kind === 'reload') await store.reloadTab(id);
    if (kind === 'reveal') {
        const tab = store.tabs.find(t => t.id === id);
        if (tab && tab.path) window.editbox.revealFile(tab.path);
    }
    if (kind === 'close') await store.closeTab(id);
    if (kind === 'closeOthers') await store.closeOthers(id);
    if (kind === 'closeAll') await store.confirmClose({ fromRequestClose: false });
}

onMounted(() => document.addEventListener('click', closeMenu));
onBeforeUnmount(() => document.removeEventListener('click', closeMenu));
</script>

<style scoped>
.tabbar-wrap {
    position: relative;
    flex: none;
}
.edit-tabs :deep(.el-tabs__header) {
    margin: 0;
    border-bottom: 1px solid var(--el-border-color);
    background: var(--el-fill-color-dark);
}
.edit-tabs :deep(.el-tabs__nav) {
    border: none;
}
.edit-tabs :deep(.el-tabs__item) {
    height: 34px;
    line-height: 34px;
    font-family: var(--tab-font-family, inherit);
    font-size: var(--tab-font-size, 13px);
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-light);
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    margin-right: 2px;
    color: var(--el-text-color-secondary);
    position: relative;
    transition: background 0.12s, color 0.12s;
}
.edit-tabs :deep(.el-tabs__item:hover) {
    color: var(--el-text-color-primary);
}
/* 选中标签：更亮背景、加粗，顶部主题色带（NotepadNext 风格） */
.edit-tabs :deep(.el-tabs__item.is-active) {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-weight: 600;
    border-color: var(--el-border-color);
    border-bottom-color: var(--el-bg-color);
}
.edit-tabs :deep(.el-tabs__item.is-active::before) {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--el-color-primary);
    border-radius: 4px 4px 0 0;
}
/* 编辑区由 editor-area 承载，隐藏 el-tabs 空面板 */
.edit-tabs :deep(.el-tabs__content) {
    display: none;
}
.dirty-dot {
    color: var(--el-color-warning);
}
.ctx-menu {
    position: fixed;
    z-index: 3000;
    min-width: 180px;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
}
.ctx-item {
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
}
.ctx-item:hover {
    background: var(--el-fill-color);
}
.ctx-sep {
    height: 1px;
    margin: 4px 0;
    background: var(--el-border-color-lighter);
}
</style>
