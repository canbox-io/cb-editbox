import { createRouter, createWebHashHistory } from 'vue-router';
import EditorView from '@/views/EditorView.vue';
import SettingsView from '@/views/SettingsView.vue';

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', name: 'Editor', component: EditorView },
        { path: '/settings', name: 'Settings', component: SettingsView }
    ]
});

export default router;
