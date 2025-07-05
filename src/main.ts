import { createApp } from 'vue';
import App from '@/App.vue';
import { createPinia } from 'pinia';
import router from './router/index';
import i18n from './locales';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(i18n);
app.use(pinia);

// 初始化认证状态
const authStore = useAuthStore();
authStore.initAuth();
authStore.setupAuthListener();

app.mount('#app');
