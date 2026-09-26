import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const mode = localStorage.getItem('editbox-locale-mode') || 'system';
const startLocale = mode === 'system'
    ? (navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US')
    : mode;

const i18n = createI18n({
    legacy: false,
    locale: startLocale,
    fallbackLocale: 'en-US',
    messages: {
        'zh-CN': zhCN,
        'en-US': enUS
    }
});

export default i18n;
