import { View, Text, Input, Button } from '@tarojs/components'
import { useState } from 'react'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { post } from '../../utils/request'
import { STORAGE_KEYS } from '../../utils/constants'
import SliderVerify from '../../components/SliderVerify'
import './login.scss'

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)

  useLoad(() => {
    console.log('登录页面加载')
    // 检查是否已记住用户名
    try {
      const rememberedUsername = Taro.getStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME)
      if (rememberedUsername) {
        setForm(prev => ({ ...prev, username: rememberedUsername }))
      }
    } catch (error) {
      console.log('获取记住的用户名失败:', error)
    }
  })

  const handleInputChange = (field: keyof LoginForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    if (!form.username.trim()) {
      console.log('请输入用户名')
      return false
    }
    if (!form.password.trim()) {
      console.log('请输入密码')
      return false
    }
    if (form.password.length < 6) {
      console.log('密码至少6位')
      return false
    }
    return true
  }

  // 处理滑块验证成功
  const handleSliderSuccess = (token: string) => {
    console.log('滑块验证成功，令牌:', token)
    setVerifyToken(token)
    console.log('安全验证通过，可以登录')
  }

  // 处理滑块验证失败
  const handleSliderError = (error: string) => {
    console.log('滑块验证失败:', error)
    console.log(error)
  }

  // 重置验证状态
  const resetVerification = () => {
    console.log('重置验证状态')
    setVerifyToken(null)
  }

  const handleLogin = async () => {
    console.log('=== 开始登录流程 ===')

    if (!validateForm()) {
      console.log('❌ 表单验证失败')
      return
    }

    // 检查是否已通过滑块验证
    if (!verifyToken) {
      console.log('❌ 未通过滑块验证')
      console.log('请先完成安全验证')
      return
    }

    console.log('✅ 准备发送登录请求:', {
      username: form.username,
      password: '***',
      verifyToken: verifyToken ? '已获取' : '未获取'
    })

    setLoading(true)
    try {
      console.log('🚀 发送POST请求到 /auth/login')

      // 添加超时和重试机制
      const response = await post('/auth/login', {
        username: form.username,
        password: form.password,
        verifyToken
      })

      console.log('📡 服务器响应:', response)

      if (response?.success && response?.data) {
        console.log('✅ 登录成功，保存用户信息')

        // 保存登录信息
        try {
          Taro.setStorageSync(STORAGE_KEYS.USER_TOKEN, response.data.token)
          Taro.setStorageSync(STORAGE_KEYS.USER_INFO, response.data.user)

          // 保存刷新令牌
          if (response.data.refreshToken) {
            Taro.setStorageSync('refresh_token', response.data.refreshToken)
          }

          // 保存用户名以便下次使用
          Taro.setStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME, form.username)

          console.log('👤 用户信息已保存:', response.data.user)

          // 跳转到首页
          setTimeout(() => {
            console.log('🏠 跳转到首页')
            Taro.switchTab({ url: '/pages/index/index' })
          }, 1000) // 减少延迟时间

        } catch (storageError) {
          console.error('💾 存储失败:', storageError)
          console.log('登录成功但数据保存失败')
        }
      } else {
        console.log('❌ 登录失败，响应数据无效:', response)
        console.log(response?.message || '登录失败，请检查用户名和密码')
        resetVerification()
      }
    } catch (error: any) {
      console.error('💥 登录请求异常:', error)

      // 详细的错误分析
      let errorMessage = '网络错误，请检查网络连接'

      if (error.response) {
        console.log('🌐 HTTP错误详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })

        switch (error.response.status) {
          case 401:
            errorMessage = '用户名或密码错误'
            break
          case 403:
            errorMessage = '账户被禁用'
            break
          case 404:
            errorMessage = '服务不可用，请稍后重试'
            break
          case 500:
            errorMessage = '服务器错误，请稍后重试'
            break
          default:
            errorMessage = error.response.data?.message || `HTTP ${error.response.status} 错误`
        }
      } else if (error.message) {
        console.log('🔌 网络错误:', error.message)
        if (error.message.includes('Network Error')) {
          errorMessage = '无法连接到服务器，请检查网络连接'
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请重试'
        } else {
          errorMessage = error.message
        }
      }

      console.log('错误信息:', errorMessage)

      // 登录失败时重置验证状态
      resetVerification()
    } finally {
      console.log('🏁 登录流程结束')
      setLoading(false)
    }
  }

  const handleRegister = () => {
    console.log('注册功能开发中')
  }

  return (
    <View className='login-page'>
      {/* 背景装饰 */}
      <View className='login-bg'>
        <View className='bg-circle circle-1'></View>
        <View className='bg-circle circle-2'></View>
        <View className='bg-circle circle-3'></View>
      </View>

      {/* 登录容器 */}
      <View className='login-container'>
        {/* Logo和标题 */}
        <View className='login-header'>
          <View className='logo'>
            <Text className='logo-icon'>⚡</Text>
          </View>
          <Text className='app-title'>智能充电</Text>
          <Text className='app-subtitle'>让充电更简单</Text>
        </View>

        {/* 登录表单 */}
        <View className='login-form'>
          <View className='form-card'>
            <View className='input-group'>
              <View className='input-wrapper'>
                <View className='input-icon'>👤</View>
                <Input
                  className='form-input'
                  placeholder='请输入用户名/手机号'
                  placeholderClass='input-placeholder'
                  value={form.username}
                  onInput={(e) => handleInputChange('username', e.detail.value)}
                />
              </View>
            </View>

            <View className='input-group'>
              <View className='input-wrapper'>
                <View className='input-icon'>🔒</View>
                <Input
                  className='form-input'
                  placeholder='请输入密码'
                  placeholderClass='input-placeholder'
                  password={!showPassword}
                  value={form.password}
                  onInput={(e) => handleInputChange('password', e.detail.value)}
                />
                <View
                  className='password-toggle'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </View>
              </View>
            </View>

            {/* 安全验证模块 */}
            <View className='security-verify-section'>
              <View className='verify-title'>
                <Text className='verify-title-text'>安全验证</Text>
                <Text className='verify-desc'>请拖动滑块完成验证</Text>
              </View>

              <View className='slider-verify-container'>
                <SliderVerify
                  onSuccess={handleSliderSuccess}
                  onError={handleSliderError}
                  width={248}
                  height={42}
                />
              </View>

              {/* 验证状态提示 */}
              {verifyToken && (
                <View className='verify-status'>
                  <Text className='verify-success-text'>✓ 安全验证已通过</Text>
                </View>
              )}
            </View>

            <Button
              className={`login-btn ${loading ? 'loading' : ''} ${!verifyToken ? 'disabled' : ''}`}
              onClick={handleLogin}
              disabled={loading || !verifyToken}
            >
              {loading ? '登录中...' : verifyToken ? '登录' : '请先完成验证'}
            </Button>

            {/* 重新验证按钮 */}
            {verifyToken && (
              <View className='reverify-container'>
                <Text
                  className='reverify-btn'
                  onClick={resetVerification}
                >
                  重新验证
                </Text>
              </View>
            )}

            {/* 测试按钮 */}
            <View className='test-container'>
              <Text
                className='test-btn'
                onClick={() => {
                  console.log('🧪 测试网络连接')
                  console.log('测试功能正常！')
                }}
              >
                测试功能
              </Text>

              <Text
                className='test-btn ml-md'
                onClick={async () => {
                  console.log('🌐 测试网络连接...')
                  console.log('正在测试网络连接...')

                  try {
                    const response = await post('/auth/slider-verify', {
                      slideDistance: 100,
                      puzzleOffset: 100,
                      accuracy: 5,
                      duration: 1000,
                      verifyPath: [0, 50, 100],
                      trackData: []
                    })
                    console.log('✅ 网络连接正常:', response)
                    console.log('网络连接正常')
                  } catch (error) {
                    console.error('❌ 网络连接失败:', error)
                    console.log('网络连接失败，请检查后端服务')
                  }
                }}
              >
                测试网络
              </Text>
            </View>
          </View>
        </View>

        {/* 底部链接 */}
        <View className='login-footer'>
          <Text className='register-text'>
            还没有账号？
            <Text className='register-link' onClick={handleRegister}>
              立即注册
            </Text>
          </Text>
        </View>
      </View>
    </View>
  )
}