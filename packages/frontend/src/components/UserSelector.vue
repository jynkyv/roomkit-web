<template>
  <div class="user-selector">
    <div class="header">
      <h3>{{ t('Online Users') }}</h3>
      <button @click="refreshUsers" :disabled="!isWebSocketConnected">
        {{ t('Refresh') }}
      </button>
    </div>

    <div v-if="!isWebSocketConnected" class="connection-warning">
      {{ t('WebSocket not connected') }}
    </div>

    <div v-else class="user-list">
      <div 
        v-for="user in filteredUsers" 
        :key="user.id"
        class="user-item"
      >
        <div class="user-info">
          <span class="user-name">{{ user.name }}</span>
          <span class="user-id">({{ user.id }})</span>
        </div>
        <div class="user-status">
          <span :class="['status-dot', { online: user.isOnline }]"></span>
          {{ user.isOnline ? t('Online') : t('Offline') }}
        </div>
      </div>
    </div>

    <div v-if="filteredUsers.length === 0" class="no-users">
      {{ t('No users online') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../locales';
import { translationWebSocketService, type TranslationUser } from '../services/translationWebSocket';

// Props
interface Props {
  fromLang?: string;
  toLang?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fromLang: 'zh-CHS',
  toLang: 'ja'
});

// Emits
const emit = defineEmits<{
  'translation-started': [userId: string, userName: string];
  'translation-stopped': [userId: string];
}>();

// 国际化
const { t } = useI18n();

// 响应式数据
const users = ref<TranslationUser[]>([]);
const isWebSocketConnected = ref(false);

// 计算属性
const filteredUsers = computed(() => {
  return users.value.filter(user => user.id !== translationWebSocketService.getCurrentUserId());
});

// 方法
const refreshUsers = () => {
  if (translationWebSocketService.isWebSocketConnected()) {
    translationWebSocketService.requestUserList();
  }
};

// WebSocket事件处理
const handleUserListUpdated = (userList: TranslationUser[]) => {
  users.value = userList.filter(user => user.id !== translationWebSocketService.getCurrentUserId());
};

const handleUserAdded = (user: TranslationUser) => {
  if (user.id !== translationWebSocketService.getCurrentUserId()) {
    users.value.push(user);
  }
};

const handleUserRemoved = (userId: string) => {
  users.value = users.value.filter(user => user.id !== userId);
};

// 初始化
const init = () => {
  isWebSocketConnected.value = translationWebSocketService.isWebSocketConnected();
  
  if (isWebSocketConnected.value) {
    translationWebSocketService.requestUserList();
  }
  
  // 注册事件监听器
  translationWebSocketService.on('user_list_updated', handleUserListUpdated);
  translationWebSocketService.on('user_added', handleUserAdded);
  translationWebSocketService.on('user_removed', handleUserRemoved);
};

// 组件挂载
onMounted(() => {
  init();
});

// 组件卸载
onUnmounted(() => {
  translationWebSocketService.off('user_list_updated', handleUserListUpdated);
  translationWebSocketService.off('user_added', handleUserAdded);
  translationWebSocketService.off('user_removed', handleUserRemoved);
});
</script>

<style scoped>
.user-selector {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h3 {
  margin: 0;
  color: #333;
}

.header button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: background 0.3s;
}

.header button:hover:not(:disabled) {
  background: #f5f5f5;
}

.header button:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.connection-warning {
  padding: 15px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
  text-align: center;
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  margin-bottom: 5px;
  background: #f8f9fa;
  border-radius: 4px;
  transition: background 0.3s;
}

.user-item:hover {
  background: #e9ecef;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: bold;
  color: #333;
}

.user-id {
  font-size: 12px;
  color: #666;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #666;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc3545;
}

.status-dot.online {
  background: #28a745;
}

.no-users {
  text-align: center;
  color: #666;
  padding: 20px;
}
</style> 
