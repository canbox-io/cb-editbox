<template>
    <div class="status-bar">
        <span class="cell" v-if="tab">
            {{ $t('status.line') }} {{ tab.cursorLine }}, {{ $t('status.col') }} {{ tab.cursorCol }}
        </span>
        <span class="cell" v-if="tab">
            {{ tab.encoding.toUpperCase() }}<template v-if="tab.hasBom"> BOM</template>
        </span>
        <el-dropdown v-if="tab" trigger="click" @command="cmd => store.setTabEol(tab.id, cmd)">
            <span class="cell clickable">
                {{ eolLabel }}<template v-if="tab.mixed"> ({{ $t('status.mixed') }})</template>
                <el-icon class="caret"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
                <el-dropdown-menu>
                    <el-dropdown-item command="crlf">CRLF — Windows</el-dropdown-item>
                    <el-dropdown-item command="lf">LF — Unix</el-dropdown-item>
                    <el-dropdown-item command="cr">CR — Classic Mac</el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
        <span class="cell" v-if="tab && tab.dirty">{{ $t('status.unsaved') }}</span>
        <span class="spacer"></span>
        <span class="cell">{{ zoomPercent }}%</span>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
import { useEditorStore } from '@/stores/editor';

const store = useEditorStore();
const tab = computed(() => store.activeTab);
const eolLabel = computed(() => {
    if (!tab.value) return '';
    return { crlf: 'CRLF', lf: 'LF', cr: 'CR' }[tab.value.eol] || 'LF';
});
const zoomPercent = computed(() => Math.round((window.editbox.zoomFactor() || 1) * 100));
</script>

<style scoped>
.status-bar {
    flex: none;
    min-height: 26px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 12px;
    font-family: var(--status-font-family, inherit);
    font-size: var(--status-font-size, 13px);
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-top: 1px solid var(--el-border-color);
    user-select: none;
}
.cell {
    white-space: nowrap;
}
.clickable {
    cursor: pointer;
}
.caret {
    margin-left: 2px;
    vertical-align: middle;
}
.spacer {
    flex: 1;
}
</style>
