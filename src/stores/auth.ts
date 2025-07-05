import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { conference, RoomEvent } from '@tencentcloud/roomkit-web-vue3'
import LibGenerateTestUserSig from '@/config/lib-generate-test-usersig-es.min'

// 创建 Supabase 客户端
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

// 腾讯云配置
const SDKAPPID = 1600095185
const SDKSECRETKEY = '1cb3faaed3543947fa61450a179db1de95b3469d27555e305aace5eb5a7f5e8b'
const EXPIRETIME = 604800

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!user.value)

  // 生成腾讯云会议用户信息
  const generateTencentCloudUserInfo = (authUser: User) => {
    try {
      const generator = new LibGenerateTestUserSig(SDKAPPID, SDKSECRETKEY, EXPIRETIME)
      const userSig = generator.genTestUserSig(authUser.id)
      
      return {
        sdkAppId: String(SDKAPPID),
        userId: authUser.id,
        userSig,
        userName: authUser.name || authUser.email,
        avatarUrl: authUser.avatar_url || '',
      }
    } catch (err) {
      console.error('生成腾讯云会议用户信息失败:', err)
      throw new Error('生成腾讯云会议用户信息失败')
    }
  }
  // 初始化认证状态
  const initAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user.value = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          avatar_url: session.user.user_metadata?.avatar_url
        }
      }
    } catch (err) {
      console.error('初始化认证状态失败:', err)
    }
  }

  // 登录
  const login = async (email: string, password: string) => {
    loading.value = true
    error.value = null
    
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        error.value = authError.message
        return false
      }

      if (data.user) {
        user.value = {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.name,
          avatar_url: data.user.user_metadata?.avatar_url
        }
        return true
      }
      
      return false
    } catch (err) {
      error.value = '登录失败，请重试'
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出
  const logout = async () => {
    try {
      await supabase.auth.signOut()
      user.value = null
      error.value = null
    } catch (err) {
      console.error('登出失败:', err)
    }
  }

  // 监听认证状态变化
  const setupAuthListener = () => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        user.value = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name,
          avatar_url: session.user.user_metadata?.avatar_url
        }
      } else if (event === 'SIGNED_OUT') {
        user.value = null
      }
    })
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
    setupAuthListener,
    setupConferenceLogoutListener
  }
}) 
