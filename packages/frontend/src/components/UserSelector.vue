<template>
  <div class="user-selector">
    <div class="selector-header">
      <h3>{{ t('Select user to translate') }}</h3>
      <button class="refresh-btn" @click="refreshUsers" :disabled="isLoading">
        {{ isLoading ? t('Refreshing...') : t('Refresh') }}
      </button>
    </div>

    <div class="user-list">
      <div v-if="users.length === 0" class="no-users">
        <p>{{ t('No online users') }}</p>
        <p class="no-users-tip">{{ t('No users tip') }}</p>
      </div>
      
      <div 
        v-for="user in users" 
        :key="user.id"
        class="user-item"
        :class="{ 
          'selected': selectedUserId === user.id,
          'translating': activeTranslations.has(user.id)
        }"
        @click="selectUser(user.id)"
      >
        <div class="user-info">
          <div class="user-avatar">
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user.name }}</div>
            <div class="user-status">
              <span class="status-dot" :class="{ online: user.isOnline }"></span>
              {{ user.isOnline ? t('Online') : t('Offline') }}
            </div>
          </div>
        </div>
        
        <div class="user-actions">
          <button 
            v-if="!activeTranslations.has(user.id)"
            @click.stop="startTranslation(user.id)"
            class="btn-translate"
            :disabled="!user.isOnline"
          >
            {{ t('Start translation') }}
          </button>
          <button 
            v-else
            @click.stop="stopTranslation(user.id)"
            class="btn-stop"
          >
            {{ t('Stop translation') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { translationWebSocketService, type TranslationUser } from '../services/translationWebSocket';
import { useI18n } from '../locales';

// Props
interface Props {
  showSelector: boolean;
  fromLang?: string;
  toLang?: string;
  activeTranslationSessions?: Map<string, any>; // 新增
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:showSelector': [value: boolean];
  'translation-started': [userId: string, userName: string];
  'translation-stopped': [userId: string];
}>();

// 国际化
const { t } = useI18n();

// 响应式数据
const users = ref<TranslationUser[]>([]);
const selectedUserId = ref<string>('');
const activeTranslations = ref<Set<string>>(new Set());
const isLoading = ref(false);

// 获取用户列表
const refreshUsers = () => {
  isLoading.value = true;
  console.log('开始刷新用户列表...');
  
  // 调用WebSocket服务的刷新方法
  translationWebSocketService.refreshUserList();
  
  // 延迟一下再设置loading为false，给服务器一些响应时间
  setTimeout(() => {
    isLoading.value = false;
    console.log('刷新用户列表完成');
  }, 1000);
};

// 选择用户
const selectUser = (userId: string) => {
  selectedUserId.value = userId;
};

// 获取选中用户名称
const getSelectedUserName = (): string => {
  const user = users.value.find(u => u.id === selectedUserId.value);
  return user ? user.name : '';
};

// 开始翻译（发送指令给目标用户）
const startTranslation = (userId: string) => {
  const user = users.value.find(u => u.id === userId);
  if (user && user.isOnline) {
    // 发送开始翻译指令给目标用户，带上当前的语言设置
    console.log('UserSelector startTranslation 参数:', {
      userId,
      fromLang: props.fromLang,
      toLang: props.toLang
    });
    translationWebSocketService.startTranslation(
      userId,
      props.fromLang || 'zh-CHS',
      props.toLang || 'en'
    );
    activeTranslations.value.add(userId);
    emit('translation-started', userId, user.name);
  }
};

// 停止翻译（发送指令给目标用户）
const stopTranslation = (userId: string) => {
  translationWebSocketService.stopTranslation(userId);
  activeTranslations.value.delete(userId);
  emit('translation-stopped', userId);
};

// 监听WebSocket事件
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
  activeTranslations.value.delete(userId);
};

// 添加一个方法来同步活跃翻译状态
const syncActiveTranslations = () => {
  // 从父组件获取当前活跃的翻译会话
  // 这里需要通过props或者事件来获取
  console.log('同步UserSelector中的活跃翻译状态');
};

// 修改生命周期
onMounted(() => {
  // 注册事件监听器
  translationWebSocketService.on('user_list_updated', handleUserListUpdated);
  translationWebSocketService.on('user_added', handleUserAdded);
  translationWebSocketService.on('user_removed', handleUserRemoved);
  
  // 初始化用户列表
  refreshUsers();
  
  // 同步活跃翻译状态
  if (props.activeTranslationSessions) {
    for (const [sessionId, session] of props.activeTranslationSessions.entries()) {
      if (session.isInitiator) {
        activeTranslations.value.add(session.targetUserId);
      }
    }
  }
});

onUnmounted(() => {
  // 移除事件监听器
  translationWebSocketService.off('user_list_updated', handleUserListUpdated);
  translationWebSocketService.off('user_added', handleUserAdded);
  translationWebSocketService.off('user_removed', handleUserRemoved);
});
</script>

<style scoped>
.user-selector {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 20px;
  max-width: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e9ecef;
}

.selector-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.refresh-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #e9ecef;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-list {
  max-height: 300px;
  overflow-y: auto;
}

.no-users {
  text-align: center;
  padding: 20px;
  color: #6c757d;
}

.no-users-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #868e96;
  line-height: 1.4;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-item:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.user-item.selected {
  border-color: #007bff;
  background: #f0f8ff;
}

.user-item.translating {
  border-color: #28a745;
  background: #f0fff4;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #007bff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6c757d;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #dc3545;
}

.status-dot.online {
  background: #28a745;
}

.user-actions {
  display: flex;
  gap: 8px;
}

.btn-translate,
.btn-stop {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-translate {
  background: #28a745;
  color: #fff;
}

.btn-translate:hover:not(:disabled) {
  background: #218838;
}

.btn-translate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-stop {
  background: #dc3545;
  color: #fff;
}

.btn-stop:hover {
  background: #c82333;
}

@media (max-width: 768px) {
  .user-selector {
    max-width: 100%;
    margin: 10px;
  }
  
  .user-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .user-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style> 
