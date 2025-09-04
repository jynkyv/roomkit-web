// 网络诊断工具
export class NetworkDiagnostics {
  private static supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  // 测试基本网络连接
  static async testBasicConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('https://httpbin.org/get', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      })
      return response.ok
    } catch (error) {
      console.error('基本网络连接测试失败:', error)
      return false
    }
  }

  // 测试 Supabase 连接
  static async testSupabaseConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      console.log('Supabase 健康检查响应:', response.status, response.statusText)
      return response.ok || response.status === 401 // 401 也是正常的，表示服务可达
    } catch (error) {
      console.error('Supabase 连接测试失败:', error)
      return false
    }
  }

  // 测试 CORS 配置
  static async testCORS(): Promise<boolean> {
    try {
      const response = await fetch(`${this.supabaseUrl}/auth/v1/token`, {
        method: 'OPTIONS',
        mode: 'cors',
        cache: 'no-cache'
      })
      console.log('CORS 预检请求响应:', response.status, response.statusText)
      return response.ok
    } catch (error) {
      console.error('CORS 测试失败:', error)
      return false
    }
  }

  // 运行完整诊断
  static async runFullDiagnostics(): Promise<{
    basicConnectivity: boolean
    supabaseConnectivity: boolean
    cors: boolean
    overall: boolean
  }> {
    console.log('开始网络诊断...')
    
    const basicConnectivity = await this.testBasicConnectivity()
    const supabaseConnectivity = await this.testSupabaseConnectivity()
    const cors = await this.testCORS()
    
    const overall = basicConnectivity && supabaseConnectivity && cors
    
    const result = {
      basicConnectivity,
      supabaseConnectivity,
      cors,
      overall
    }
    
    console.log('网络诊断结果:', result)
    
    if (!overall) {
      console.warn('网络诊断发现问题:')
      if (!basicConnectivity) console.warn('- 基本网络连接失败')
      if (!supabaseConnectivity) console.warn('- Supabase 服务不可达')
      if (!cors) console.warn('- CORS 配置可能有问题')
    }
    
    return result
  }

  // 获取网络状态信息
  static getNetworkInfo(): {
    userAgent: string
    online: boolean
    connection?: any
  } {
    const info = {
      userAgent: navigator.userAgent,
      online: navigator.onLine
    }

    // 检查网络连接 API（如果可用）
    if ('connection' in navigator) {
      (info as any).connection = (navigator as any).connection
    }

    return info
  }
}
