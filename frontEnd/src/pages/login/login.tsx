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
  rememberMe: boolean
}

export default function Login() {
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: '',
    rememberMe: false
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)
  const [showSliderVerify, setShowSliderVerify] = useState(false)

  useLoad(() => {
    console.log('登录页面加载')
    // 检查是否已记住用户名
    try {
      const rememberedUsername = Taro.getStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME) as string
      if (rememberedUsername) {
        setForm(prev => ({ ...prev, username: rememberedUsername, rememberMe: true }))
      }
    } catch (error) {
      console.log('获取记住的用户名失败:', error)
    }
  })

  const handleInputChange = (field: keyof LoginForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    if (!form.username.trim()) {
      Taro.showToast({ title: '请输入用户名', icon: 'none' })
      return false
    }
    if (!form.password.trim()) {
      Taro.showToast({ title: '请输入密码', icon: 'none' })
      return false
    }
    if (form.password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' })
      return false
    }
    return true
  }

  // 处理滑块验证成功
  const handleSliderSuccess = (token: string) => {
    setVerifyToken(token)
    setShowSliderVerify(false)
    Taro.showToast({ title: '验证成功，可以登录', icon: 'success' })
  }

  // 处理滑块验证失败
  const handleSliderError = (error: string) => {
    Taro.showToast({ title: error, icon: 'none' })
  }

  const handleLogin = async () => {
    if (!validateForm()) return

    // 检查是否已通过滑块验证
    if (!verifyToken) {
      setShowSliderVerify(true)
      Taro.showToast({ title: '请先完成滑块验证', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const response = await post('/auth/login', {
        username: form.username,
        password: form.password,
        verifyToken // 附带验证令牌
      })

      if (response.success && response.data) {
        // 保存登录信息
        Taro.setStorageSync(STORAGE_KEYS.USER_TOKEN, response.data.token)
        Taro.setStorageSync(STORAGE_KEYS.USER_INFO, response.data.user)

        // 记住用户名
        if (form.rememberMe) {
          Taro.setStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME, form.username)
        } else {
          Taro.removeStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME)
        }

        Taro.showToast({ title: '登录成功', icon: 'success' })

        // 跳转到首页
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/index/index' })
        }, 1500)
      }
    } catch (error) {
      console.error('登录失败:', error)
      // 登录失败时重置验证状态
      setVerifyToken(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = () => {
    Taro.showToast({ title: '注册功能开发中', icon: 'none' })
  }

  const handleForgotPassword = () => {
    Taro.showToast({ title: '忘记密码功能开发中', icon: 'none' })
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

            {/* 滑块验证 */}
            {showSliderVerify && (
              <View className='slider-verify-container'>
                <SliderVerify
                  onSuccess={handleSliderSuccess}
                  onError={handleSliderError}
                  height={42}
                />
              </View>
            )}

            {/* 验证状态提示 */}
            {verifyToken && (
              <View className='verify-status'>
                <Text className='verify-success-text'>✓ 安全验证已通过</Text>
              </View>
            )}

            <View className='form-options'>
              <View
                className={`checkbox-wrapper ${form.rememberMe ? 'checked' : ''}`}
                onClick={() => handleInputChange('rememberMe', !form.rememberMe)}
              >
                <View className='checkbox'>
                  {form.rememberMe && <Text className='checkbox-icon'>✓</Text>}
                </View>
                <Text className='checkbox-label'>记住用户名</Text>
              </View>

              <Text className='forgot-password' onClick={handleForgotPassword}>
                忘记密码？
              </Text>
            </View>

            <Button
              className={`login-btn ${loading ? 'loading' : ''} ${!verifyToken ? 'disabled' : ''}`}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>

            {/* 重新验证按钮 */}
            {verifyToken && !showSliderVerify && (
              <View className='reverify-container'>
                <Text
                  className='reverify-btn'
                  onClick={() => {
                    setVerifyToken(null)
                    setShowSliderVerify(true)
                  }}
                >
                  重新验证
                </Text>
              </View>
            )}
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