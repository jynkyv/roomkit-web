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
          'translating': isUserBeingTranslated(user.id),
          'viewing': isCurrentUserViewing(user.id),
          'active-session': isUserBeingTranslated(user.id) || isCurrentUserViewing(user.id)
        }"
        @click="selectUser(user.id)"
      >
        <div class="user-info">
          <div class="user-avatar" :class="{ 'active': isUserBeingTranslated(user.id) || isCurrentUserViewing(user.id) }">
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
          <div class="user-details">
            <div class="user-name">{{ user.name }}</div>
            <div class="user-status">
              <span class="status-dot" :class="{ online: user.isOnline }"></span>
              {{ user.isOnline ? t('Online') : t('Offline') }}
            </div>
            <!-- 翻译状态显示 -->
            <div v-if="user.translationStatus && user.translationStatus.isActive" class="translation-status">
              <div class="status-indicator">
                <span class="translation-icon">●</span>
                <span class="status-text">{{ t('Translating') }}: {{ getLangDisplay(user.translationStatus.fromLang) }} → {{ getLangDisplay(user.translationStatus.toLang) }}</span>
                <span v-if="isCurrentUserInitiator(user.id)" class="initiator-badge">{{ t('You initiated') }}</span>
              </div>
              <!-- 查看者信息 -->
              <div v-if="user.translationStatus.viewers && user.translationStatus.viewers.length > 0" class="viewers-info">
                <span class="viewers-icon">●</span>
                <span class="viewers-count">{{ user.translationStatus.viewers.length }} {{ t('Viewing') }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="user-actions">
          <!-- 用户未被翻译时显示开始翻译按钮 -->
          <button 
            v-if="!isUserBeingTranslated(user.id)"
            @click.stop="startTranslation(user.id)"
            class="btn-translate"
            :disabled="!user.isOnline"
          >
            {{ t('Start translation') }}
          </button>
          
          <!-- 用户正在被翻译，且当前用户是发起者时显示停止翻译按钮 -->
          <button 
            v-else-if="isCurrentUserInitiator(user.id)"
            @click.stop="stopTranslation(user.id)"
            class="btn-stop"
          >
            {{ t('Stop translation') }}
          </button>
          
          <!-- 用户正在被翻译，且当前用户不是发起者时显示查看翻译按钮 -->
          <button 
            v-else-if="!isCurrentUserViewing(user.id)"
            @click.stop="joinTranslationView(user.id)"
            class="btn-view-translation"
            :disabled="!user.isOnline"
          >
            {{ t('View translation') }}
          </button>
          
          <!-- 当前用户正在查看翻译时显示停止查看按钮 -->
          <button 
            v-else
            @click.stop="leaveTranslationView(user.id)"
            class="btn-stop-viewing"
          >
            {{ t('Stop viewing') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { translationWebSocketService, type TranslationUser } from '../services/translationWebSocket';
import { useI18n } from '../locales';

// Props
interface Props {
  showSelector: boolean;
  fromLang?: string;
  toLang?: string;
  activeTranslationSessions?: Map<string, any>;
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

// 记录当前用户正在查看的所有 userId
const viewingUserIds = computed(() =>
  users.value
    .filter(user => isCurrentUserViewing(user.id))
    .map(user => user.id)
);

// 监听 showSelector 变为 false 时自动 leave
watch(
  () => props.showSelector,
  (val) => {
    if (!val) {
      viewingUserIds.value.forEach(uid => leaveTranslationView(uid));
    }
  }
);

// 获取用户列表
const refreshUsers = () => {
  isLoading.value = true;
  console.log('开始刷新用户列表...');
  
  // 检查WebSocket连接状态
  if (!translationWebSocketService.isWebSocketConnected()) {
    console.log('WebSocket未连接，等待连接...');
    // 延迟重试
    setTimeout(() => {
      if (translationWebSocketService.isWebSocketConnected()) {
        translationWebSocketService.refreshUserList();
      } else {
        console.error('WebSocket连接失败，无法刷新用户列表');
        isLoading.value = false;
      }
    }, 1000);
    return;
  }
  
  // 调用WebSocket服务的刷新方法
  translationWebSocketService.refreshUserList();
  
  // 延迟一下再设置loading为false，给服务器一些响应时间
  setTimeout(() => {
    isLoading.value = false;
    console.log('刷新用户列表完成');
  }, 2000); // 增加到2秒，给更多响应时间
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

// 检查用户是否正在被翻译
const isUserBeingTranslated = (userId: string): boolean => {
  const result = translationWebSocketService.isUserBeingTranslated(userId);
  const user = users.value.find(u => u.id === userId);
  console.log(`检查用户 ${user?.name || userId} 翻译状态:`, {
    userId,
    result,
    userTranslationStatus: user?.translationStatus,
    serviceStatus: translationWebSocketService.getUserTranslationStatus(userId)
  });
  return result;
};

// 检查当前用户是否是翻译发起者
const isCurrentUserInitiator = (userId: string): boolean => {
  return translationWebSocketService.isCurrentUserInitiator(userId);
};

// 检查当前用户是否正在查看该用户的翻译
const isCurrentUserViewing = (userId: string): boolean => {
  const user = users.value.find(u => u.id === userId);
  if (!user || !user.translationStatus) return false;
  
  // 检查当前用户是否在查看者列表中
  const currentUserId = translationWebSocketService.getCurrentUserId();
  
  // 如果当前用户是发起者，也算作查看者
  if (user.translationStatus.initiatorUserId === currentUserId) {
    return true;
  }
  
  // 检查是否在查看者列表中
  if (user.translationStatus.viewers && Array.isArray(user.translationStatus.viewers)) {
    const isViewing = user.translationStatus.viewers.includes(currentUserId);
    console.log(`用户 ${user.name} 查看状态检查:`, {
      currentUserId,
      viewers: user.translationStatus.viewers,
      isViewing
    });
    return isViewing;
  }
  
  return false;
};

// 获取语言显示名称
const getLangDisplay = (langCode: string): string => {
  const langMap: Record<string, string> = {
    'zh-CHS': t('Chinese'),
    'ja': t('Japanese'),
  };
  return langMap[langCode] || langCode;
};

// 开始翻译（发送指令给目标用户）
const startTranslation = (userId: string) => {
  const user = users.value.find(u => u.id === userId);
  if (user && user.isOnline) {
    // 发送开始翻译会话指令
    console.log('UserSelector startTranslation 参数:', {
      userId,
      fromLang: props.fromLang,
      toLang: props.toLang
    });
    translationWebSocketService.startTranslationSession(
      userId,
      props.fromLang || 'zh-CHS',
      props.toLang || 'ja'
    );
    activeTranslations.value.add(userId);
    emit('translation-started', userId, user.name);
  }
};

// 停止翻译（只有发起者可以停止）
const stopTranslation = (userId: string) => {
  const user = users.value.find(u => u.id === userId);
  if (user && user.translationStatus) {
    translationWebSocketService.stopTranslationSession(user.translationStatus.sessionId);
    activeTranslations.value.delete(userId);
    emit('translation-stopped', userId);
  }
};

// 监听翻译状态更新
const handleTranslationStatusUpdated = (statusMap: Record<string, any>) => {
  console.log('翻译状态更新:', statusMap);
  
  // 更新用户列表中的翻译状态
  users.value.forEach(user => {
    const status = statusMap[user.id];
    if (status) {
      user.translationStatus = status;
      console.log(`用户 ${user.name} 翻译状态已更新:`, status);
    } else {
      delete user.translationStatus;
    }
  });
  
  // 强制更新组件
  users.value = [...users.value];
};

// 添加一个标记来跟踪本地状态更新
const localViewerUpdates = ref(new Set<string>());

// 加入翻译查看
const joinTranslationView = (userId: string) => {
  const user = users.value.find(u => u.id === userId);
  if (user && user.translationStatus) {
    const currentUserId = translationWebSocketService.getCurrentUserId();
    
    // 检查是否已经在查看者列表中
    if (user.translationStatus.viewers && user.translationStatus.viewers.includes(currentUserId)) {
      console.log('用户已经在查看者列表中');
      return;
    }
    
    // 立即更新本地状态，提供即时反馈
    if (user.translationStatus.viewers) {
      user.translationStatus.viewers.push(currentUserId);
    } else {
      user.translationStatus.viewers = [currentUserId];
    }
    
    // 强制更新组件
    users.value = [...users.value];
    
    console.log('本地状态已更新，查看者列表:', user.translationStatus.viewers);
    
    // 延迟发送服务器请求，避免状态冲突
    setTimeout(() => {
      if (user.translationStatus) {
        translationWebSocketService.joinTranslationView(user.translationStatus.sessionId);
        console.log(`用户 ${currentUserId} 加入查看用户 ${user.name} 的翻译`);
      }
    }, 100);
  }
};

// 离开翻译查看
const leaveTranslationView = (userId: string) => {
  const user = users.value.find(u => u.id === userId);
  if (user && user.translationStatus) {
    const currentUserId = translationWebSocketService.getCurrentUserId();
    
    // 检查是否不在查看者列表中
    if (!user.translationStatus.viewers || !user.translationStatus.viewers.includes(currentUserId)) {
      console.log('用户不在查看者列表中');
      return;
    }
    
    // 立即更新本地状态，提供即时反馈
    user.translationStatus.viewers = user.translationStatus.viewers.filter(id => id !== currentUserId);
    
    // 强制更新组件
    users.value = [...users.value];
    
    console.log('本地状态已更新，查看者列表:', user.translationStatus.viewers);
    
    // 延迟发送服务器请求，避免状态冲突
    setTimeout(() => {
      if (user.translationStatus) {
        translationWebSocketService.leaveTranslationView(user.translationStatus.sessionId);
        console.log(`用户 ${currentUserId} 离开查看用户 ${user.name} 的翻译`);
        
        // 触发翻译停止事件，关闭翻译历史
        emit('translation-stopped', userId);
      }
    }, 100);
  }
};

// 监听WebSocket事件
const handleUserListUpdated = (userList: TranslationUser[]) => {
  console.log('用户列表更新:', userList);
  users.value = userList.filter(user => user.id !== translationWebSocketService.getCurrentUserId());
  
  // 更新翻译状态
  userList.forEach(user => {
    if (user.translationStatus) {
      console.log(`用户 ${user.name} 翻译状态:`, user.translationStatus);
    }
  });
  
  // 用户列表更新后，重置loading状态
  isLoading.value = false;
  console.log('用户列表更新完成，重置loading状态');
};

const handleUserAdded = (user: TranslationUser) => {
  if (user.id !== translationWebSocketService.getCurrentUserId()) {
    users.value.push(user);
    if (user.translationStatus) {
      console.log(`新用户 ${user.name} 翻译状态:`, user.translationStatus);
    }
  }
};

const handleUserRemoved = (userId: string) => {
  users.value = users.value.filter(user => user.id !== userId);
  activeTranslations.value.delete(userId);
};

// 修改生命周期
onMounted(() => {
  // 注册事件监听器
  translationWebSocketService.on('user_list_updated', handleUserListUpdated);
  translationWebSocketService.on('user_added', handleUserAdded);
  translationWebSocketService.on('user_removed', handleUserRemoved);
  translationWebSocketService.on('translation_status_updated', handleTranslationStatusUpdated);
  
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
  viewingUserIds.value.forEach(uid => leaveTranslationView(uid));
  // 移除事件监听器
  translationWebSocketService.off('user_list_updated', handleUserListUpdated);
  translationWebSocketService.off('user_added', handleUserAdded);
  translationWebSocketService.off('user_removed', handleUserRemoved);
  translationWebSocketService.off('translation_status_updated', handleTranslationStatusUpdated);
});
</script>

<style scoped>
.user-selector {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 20px;
  max-width: 440px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  /* 添加额外的内边距来防止hover动画溢出 */
  padding-top: 24px;
  padding-bottom: 24px;
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
  /* 添加内边距防止hover动画溢出 */
  padding: 4px 0;
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
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  /* 添加margin来为hover动画留出空间 */
  margin: 0 2px 8px 2px;
}

.user-item:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* 确保hover时不会超出容器 */
  z-index: 1;
}

.user-item.selected {
  border-color: #007bff;
  background: #f0f8ff;
}

.user-item.translating {
  border-color: #28a745;
  background: linear-gradient(135deg, #f0fff4 0%, #e8f5e8 100%);
  box-shadow: 0 2px 12px rgba(40, 167, 69, 0.15);
}

.user-item.viewing {
  border-color: #ffc107;
  background: linear-gradient(135deg, #fffbf0 0%, #fff8e1 100%);
  box-shadow: 0 2px 12px rgba(255, 193, 7, 0.15);
}

.user-item.active-session {
  position: relative;
}

.user-item.active-session::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #28a745, #20c997);
  animation: activeGlow 2s ease-in-out infinite;
}

@keyframes activeGlow {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
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
  position: relative;
  transition: all 0.3s ease;
}

.user-avatar.active {
  background: linear-gradient(135deg, #28a745, #20c997);
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.2);
  animation: avatarPulse 2s ease-in-out infinite;
}

@keyframes avatarPulse {
  0%, 100% { 
    box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.2);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 0 6px rgba(40, 167, 69, 0.1);
    transform: scale(1.05);
  }
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  transition: all 0.3s ease;
}

.status-dot.online {
  background: #28a745;
  box-shadow: 0 0 4px rgba(40, 167, 69, 0.4);
}

.translation-status {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #28a745;
  font-weight: 500;
  background: rgba(40, 167, 69, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid rgba(40, 167, 69, 0.2);
}

.translation-icon {
  font-size: 8px;
  color: #28a745;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text {
  flex: 1;
}

.initiator-badge {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: #fff;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}

.viewers-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #6c757d;
  background: rgba(108, 117, 125, 0.1);
  padding: 2px 6px;
  border-radius: 8px;
  margin-top: 2px;
}

.viewers-icon {
  font-size: 6px;
  color: #6c757d;
}

.viewers-count {
  font-weight: 500;
}

.user-actions {
  display: flex;
  gap: 8px;
}

.btn-translate,
.btn-stop,
.btn-view-translation,
.btn-stop-viewing {
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.btn-translate {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: #fff;
  box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
}

.btn-translate:hover:not(:disabled) {
  background: linear-gradient(135deg, #218838, #1e7e34);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4);
}

.btn-translate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-stop {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: #fff;
  box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
}

.btn-stop:hover {
  background: linear-gradient(135deg, #c82333, #bd2130);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.btn-view-translation {
  background: linear-gradient(135deg, #ffc107, #e0a800);
  color: #212529;
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

.btn-view-translation:hover:not(:disabled) {
  background: linear-gradient(135deg, #e0a800, #d39e00);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

.btn-view-translation:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-stop-viewing {
  background: linear-gradient(135deg, #6c757d, #5a6268);
  color: #fff;
  box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
}

.btn-stop-viewing:hover {
  background: linear-gradient(135deg, #5a6268, #495057);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
}

/* 按钮点击效果 */
.btn-translate:active,
.btn-stop:active,
.btn-view-translation:active,
.btn-stop-viewing:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
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
  
  .translation-status {
    width: 100%;
  }
  
  .status-indicator {
    flex-wrap: wrap;
  }
}
</style> 
