import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { conference, RoomEvent } from '@tencentcloud/roomkit-web-vue3'
// @ts-ignore
import LibGenerateTestUserSig from '@/config/lib-generate-test-usersig-es.min'

// 腾讯云配置
const SDKAPPID = Number((import.meta.env as any).VITE_TENCENT_SDK_APP_ID)
const SDKSECRETKEY = (import.meta.env as any).VITE_TENCENT_SDK_SECRET_KEY as string
const EXPIRETIME = 604800

export interface User {
  id: string
  name: string
  avatarUrl?: string
}

// 生成唯一用户ID（用于WebSocket和其他服务）
function generateUserId(): string {
  // 生成唯一ID：时间戳(13位) + 随机数(5位) + 浏览器指纹(4位)
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  // 使用简单的浏览器指纹（基于userAgent和屏幕分辨率）
  const fingerprint = (navigator.userAgent + screen.width + screen.height)
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString(16)
    .slice(-4)
  
  return `user_${timestamp}_${random}_${fingerprint}`
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!user.value)

  // 生成腾讯云会议用户信息
  const generateTencentCloudUserInfo = (authUser: User) => {
    try {
      if (SDKAPPID === Number(0) || SDKSECRETKEY === String('')) {
        throw new Error('请配置腾讯云SDK密钥')
      }

      const generator = new LibGenerateTestUserSig(SDKAPPID, SDKSECRETKEY, EXPIRETIME)
      const userSig = generator.genTestUserSig(authUser.id)
      
      return {
        sdkAppId: String(SDKAPPID),
        userId: authUser.id,
        userSig,
        userName: authUser.name,
        avatarUrl: authUser.avatarUrl || '',
      }
    } catch (err) {
      console.error('生成腾讯云会议用户信息失败:', err)
      throw new Error('生成腾讯云会议用户信息失败')
    }
  }

  // 初始化认证状态（从localStorage恢复）
  const initAuth = async () => {
    try {
      const savedUser = localStorage.getItem('roomkit-user')
      if (savedUser) {
        user.value = JSON.parse(savedUser)
      }
    } catch (err) {
      console.error('初始化认证状态失败:', err)
      localStorage.removeItem('roomkit-user')
    }
  }

  // 登录（只需要用户名）
  // 注意：会自动生成唯一用户ID（用于WebSocket、腾讯云会议等）
  const login = async (userName: string) => {
    loading.value = true
    error.value = null
    
    try {
      if (!userName || userName.trim() === '') {
        error.value = '请输入您的名称'
        return false
      }

      // 生成唯一用户ID（用于WebSocket连接、腾讯云会议等服务）
      const userId = generateUserId()
      
      // 创建用户对象
      const newUser: User = {
        id: userId,  // 随机生成的唯一ID，格式: user_时间戳_随机数_浏览器指纹
        name: userName.trim(),  // 用户输入的显示名称
        avatarUrl: '',
      }

      // 保存到store和localStorage
      user.value = newUser
      localStorage.setItem('roomkit-user', JSON.stringify(newUser))

      console.log('用户登录成功:', {
        userId: newUser.id,
        userName: newUser.name,
        note: '用户ID将用于WebSocket连接和腾讯云会议'
      })
      return true
      
    } catch (err) {
      console.error('登录错误:', err)
      error.value = '登录失败，请重试'
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出
  const logout = async () => {
    try {
      // 登出腾讯云会议
      await conference.logout()
      
      // 清除用户信息
      user.value = null
      localStorage.removeItem('roomkit-user')
      error.value = null
    } catch (err) {
      console.error('登出失败:', err)
    }
  }

  // 监听腾讯云会议登出事件
  const setupConferenceLogoutListener = () => {
    conference.on(RoomEvent.USER_LOGOUT, async () => {
      // 当腾讯云会议触发登出时，同时登出我们的认证系统
      await logout()
    })
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    generateTencentCloudUserInfo,
    initAuth,
    login,
    logout,
    setupConferenceLogoutListener,
  }
})
