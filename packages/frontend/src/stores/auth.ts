import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { conference, RoomEvent } from '@tencentcloud/roomkit-web-vue3'
// @ts-ignore
import LibGenerateTestUserSig from '@/config/lib-generate-test-usersig-es.min'

// 创建 Supabase 客户端
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 调试信息
console.log('Supabase 配置:', {
  url: supabaseUrl ? '已配置' : '未配置',
  key: supabaseKey ? '已配置' : '未配置',
  urlValue: supabaseUrl
})

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

// 腾讯云配置
const SDKAPPID = Number(import.meta.env.VITE_TENCENT_SDK_APP_ID)
const SDKSECRETKEY = import.meta.env.VITE_TENCENT_SDK_SECRET_KEY
const EXPIRETIME = 604800

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => !!user.value)

  // 测试 Supabase 连接
  const testSupabaseConnection = async () => {
    try {
      console.log('测试 Supabase 连接...')
      // 使用更简单的健康检查
      const { data, error } = await supabase.auth.getSession()
      if (error && error.message.includes('Failed to fetch')) {
        console.error('Supabase 连接测试失败 - 网络错误:', error)
        return false
      }
      console.log('Supabase 连接测试成功')
      return true
    } catch (err) {
      console.error('Supabase 连接测试异常:', err)
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        console.error('网络连接失败，可能是 CORS 或网络问题')
        return false
      }
      // 其他错误可能是正常的（比如没有会话）
      return true
    }
  }

  // 带重试的登录函数
  const loginWithRetry = async (email: string, password: string, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`登录尝试 ${attempt}/${maxRetries}`)
        
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (authError) {
          console.error('登录错误:', authError)
          if (attempt === maxRetries) {
            error.value = authError.message
            return false
          }
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          continue
        }

        if (data.user) {
          user.value = {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name,
            avatar_url: data.user.user_metadata?.avatar_url
          }
          console.log('登录成功')
          return true
        }
        
        return false
      } catch (err) {
        console.error(`登录尝试 ${attempt} 失败:`, err)
        if (attempt === maxRetries) {
          if (err instanceof Error) {
            if (err.message.includes('Failed to fetch')) {
              error.value = '网络连接失败，请检查网络连接或 Supabase 配置'
            } else {
              error.value = err.message
            }
          } else {
            error.value = '登录失败，请重试'
          }
          return false
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
    return false
  }

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
      // 检查环境变量是否配置
      if (!supabaseUrl || !supabaseKey) {
        error.value = 'Supabase 配置缺失，请检查环境变量'
        return false
      }

      // 先测试连接
      const connectionOk = await testSupabaseConnection()
      if (!connectionOk) {
        error.value = '无法连接到 Supabase 服务，请检查网络连接'
        return false
      }

      // 使用重试机制登录
      const success = await loginWithRetry(email, password)
      return success
      
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
    setupConferenceLogoutListener,
    testSupabaseConnection,
    loginWithRetry
  }
}) 
