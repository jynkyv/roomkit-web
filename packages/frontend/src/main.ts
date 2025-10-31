import { createApp } from 'vue';
import App from '@/App.vue';
import { createPinia } from 'pinia';
import router from './router/index';
import i18n from './locales';
import { useAuthStore } from './stores/auth';
import { translationWebSocketService } from './services/translationWebSocket';

// 全局错误处理
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('WebSocket')) {
    console.error('全局WebSocket错误:', event);
    console.error('错误详情:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  }
});

// 全局未捕获的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('WebSocket')) {
    console.error('全局未处理的WebSocket Promise拒绝:', event.reason);
  }
});

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(i18n);
app.use(pinia);

// 初始化认证状态
const authStore = useAuthStore();
authStore.initAuth();
authStore.setupConferenceLogoutListener();

app.mount('#app');
