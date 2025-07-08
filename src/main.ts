import { createApp } from 'vue';
import App from '@/App.vue';
import { createPinia } from 'pinia';
import router from './router/index';
import i18n from './locales';
import { useAuthStore } from './stores/auth';
import { translationWebSocketService } from './services/translationWebSocket';

const app = createApp(App);
const pinia = createPinia();

app.use(router);
app.use(i18n);
app.use(pinia);

// 初始化认证状态
const authStore = useAuthStore();
authStore.initAuth();
authStore.setupAuthListener();

// 初始化WebSocket连接
const initWebSocket = async () => {
  try {
    // 生成随机用户ID和名称（实际应用中应该从用户系统获取）
    const userId = `user_${Math.random().toString(36).substr(2, 9)}`;
    const userName = `用户${Math.floor(Math.random() * 1000)}`;
    
    await translationWebSocketService.connect(userId, userName);
    console.log('WebSocket连接初始化成功');
  } catch (error) {
    console.error('WebSocket连接初始化失败:', error);
  }
};

// 启动WebSocket连接
initWebSocket();

app.mount('#app');
