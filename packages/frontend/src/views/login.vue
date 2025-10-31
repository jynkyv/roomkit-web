<template>
  <div class="login-container">
    <!-- 语言切换按钮 -->
    <div class="language-switcher">
      <button 
        @click="switchLanguage" 
        class="lang-btn"
      >
        {{ currentLanguage === 'zh-CN' ? '日本語' : '中文' }}
      </button>
    </div>

    <div class="login-card">
      <div class="login-header">
        <h1>{{ t('Enter Your Name') }}</h1>
        <p>{{ t('Please enter your name to continue') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="userName">{{ t('Your Name') }}</label>
          <input
            id="userName"
            v-model="userName"
            type="text"
            :placeholder="t('Please enter your name')"
            required
            :disabled="loading"
            maxlength="50"
            autofocus
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button 
          type="submit" 
          class="login-btn"
          :disabled="loading || !userName || !userName.trim()"
        >
          {{ loading ? t('Entering...') : t('Enter') }}
        </button>

      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from '../locales/index'
import i18n from '../locales/index'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { t } = useI18n()

const userName = ref('')

const loading = computed(() => authStore.loading)
const error = computed(() => authStore.error)

// 当前语言
const currentLanguage = computed(() => i18n.global.locale.value)

// 切换语言 - 与内部语言切换逻辑保持一致
const switchLanguage = () => {
  const newLang = currentLanguage.value === 'zh-CN' ? 'ja-JP' : 'zh-CN'
  i18n.global.locale.value = newLang
  localStorage.setItem('tuiRoom-language', newLang)
}

const pendingRoomId = ref<string | null>(null)

onMounted(() => {
  // 检查URL参数
  const url = new URL(window.location.href)
  const roomId = url.searchParams.get('roomId')
  if (roomId) {
    pendingRoomId.value = roomId
    localStorage.setItem('pendingRoomId', roomId)
  }
})

const handleLogin = async () => {
  const success = await authStore.login(userName.value)
  if (success) {
    // 优先跳转到redirect参数
    const redirect = route.query.redirect as string
    if (redirect) {
      window.location.href = redirect
      return
    }
    // 其次跳转到roomId
    const cachedRoomId = localStorage.getItem('pendingRoomId')
    if (cachedRoomId) {
      localStorage.removeItem('pendingRoomId')
      router.push(`/room?roomId=${encodeURIComponent(cachedRoomId)}`)
    } else {
      router.push('/home')
    }
  }
}

</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 20px;
  position: relative;
}

.language-switcher {
  position: absolute;
  top: 20px;
  right: 20px;
}

.lang-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 60px;
}

.lang-btn:hover {
  background: #f1f5f9;
  color: #475569;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.lang-btn:active {
  transform: translateY(0);
}

.login-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 48px;
  width: 100%;
  max-width: 420px;
  border: 1px solid #e2e8f0;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  color: #1e293b;
  margin-bottom: 8px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.login-header p {
  color: #64748b;
  font-size: 16px;
  font-weight: 400;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  letter-spacing: 0.025em;
}

.form-group input {
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;
  background: white;
  color: #1f2937;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input:disabled {
  background-color: #f9fafb;
  color: #9ca3af;
  cursor: not-allowed;
}

.form-group input::placeholder {
  color: #9ca3af;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #fecaca;
  font-weight: 500;
}

.login-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.025em;
}

.login-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.login-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
}


@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
    margin: 16px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
  
  .language-switcher {
    top: 16px;
    right: 16px;
  }
  
  .lang-btn {
    padding: 6px 12px;
    font-size: 12px;
    min-width: 50px;
  }
}
</style>
