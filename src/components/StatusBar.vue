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
        <span class="cell" v-if="tab">{{ languageLabel }}</span>
        <span class="cell">{{ zoomPercent }}%</span>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { useEditorStore } from '@/stores/editor';

const { t } = useI18n();
const store = useEditorStore();
const tab = computed(() => store.activeTab);
const eolLabel = computed(() => {
    if (!tab.value) return '';
    return { crlf: 'CRLF', lf: 'LF', cr: 'CR' }[tab.value.eol] || 'LF';
});
const zoomPercent = computed(() => Math.round((store.zoomFactor || 1) * 100));
// 语言：优先取编辑器上报的实际语言（含手动切换），未上报时按文件名即时推断
const languageLabel = computed(() => {
    if (!tab.value) return '';
    if (tab.value.language !== undefined) return tab.value.language || t('status.plainText');
    const desc = LanguageDescription.matchFilename(languages, tab.value.name || '');
    return desc ? desc.name : t('status.plainText');
});
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
