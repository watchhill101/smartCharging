import { View, Text, Input, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { useLoad } from '@tarojs/taro'
import {
  getStorageSync as taroGetStorageSync,
  setStorageSync as taroSetStorageSync,
  navigateTo as taroNavigateTo,
  showToast as taroShowToast,
  switchTab
} from '@tarojs/taro'
import { post } from '../../utils/request'
import { STORAGE_KEYS } from '../../utils/constants'
import { tokenManager } from '../../utils/tokenManager'
import { env } from '../../utils/platform'
import SliderVerify from '../../components/SliderVerify'
import FaceLoginOptimized from '../../components/FaceLogin/FaceLoginOptimized'
import './login.scss'
import { TIME_CONSTANTS, Z_INDEX_CONSTANTS } from '../../utils/constants'
import React from 'react'

interface LoginForm {
  username: string
  verifyCode: string
}

export default function Login() {
  const [form, setForm] = useState<LoginForm>({
    username: '',
    verifyCode: ''
  })
  const [loading, setLoading] = useState(false)
  const [verifyToken, setVerifyToken] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null)
  const [receivedCode, setReceivedCode] = useState<string | null>(null)
  const [loginMode, setLoginMode] = useState<'code' | 'face'>('code')
  const [showFaceLogin, setShowFaceLogin] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [faceLoginSuccess, setFaceLoginSuccess] = useState(false)
  const [isH5Environment, setIsH5Environment] = useState(false)
  const [supportsFaceLogin, setSupportsFaceLogin] = useState(false)

  useLoad(() => {
    // 检查是否已记住用户名
    try {
      const rememberedUsername = taroGetStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME)
      if (rememberedUsername) {
        setForm(prev => ({ ...prev, username: rememberedUsername }))
      }
    } catch (error) {
      console.error('获取记住的用户名失败:', error)
    }
  })

  // 检查环境支持
  useEffect(() => {
    const checkEnvironment = () => {
      setIsH5Environment(env.isH5)
      
      // 检查是否支持人脸登录
      if (env.isH5) {
        // H5环境下检查摄像头支持
        setSupportsFaceLogin(
          !!(navigator?.mediaDevices?.getUserMedia) &&
          (location.protocol === 'https:' || 
           location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1')
        )
      } else {
        // 小程序环境暂不支持人脸登录
        setSupportsFaceLogin(false)
      }
    }

    checkEnvironment()
  }, [])

  // 清理定时器的函数
  const clearCountdownTimer = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      setCountdownTimer(null)
    }
  }

  // 开始倒计时的函数
  const startCountdown = () => {
    // 先清理之前的定时器
    clearCountdownTimer()

    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setCountdownTimer(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    setCountdownTimer(timer)
  }

  // 获取验证码
  const handleGetVerifyCode = async () => {
    if (!form.username.trim()) {
      console.log('请先输入手机号')
      return
    }
    if (!validatePhone(form.username)) {
      console.log('请输入正确的手机号格式')
      return
    }

    // 如果正在倒计时，直接返回
    if (countdown > 0) {
      console.log('请等待倒计时结束')
      return
    }

    setCodeLoading(true)
    try {
      console.log('🔄 正在发送验证码请求...')
        const response = await post('/auth/send-verify-code', {
        phone: form.username
      })

      if (response.success) {
        console.log('✅ 验证码发送成功')
        // 开始倒计时
        startCountdown()

        // 处理验证码发送成功
        if (response.data && response.data.code) {
          // 开发环境显示验证码
          setReceivedCode(response.data.code)
          console.log('💡 开发环境验证码:', response.data.code)
          console.log('💡 提示：点击顶部验证码可自动填入')
          
          // 10秒后自动隐藏验证码显示
          setTimeout(() => {
            setReceivedCode(null)
          }, 10000)
        } else if (response.data && response.data.hint) {
          // 仅显示提示信息
          console.log('💡 开发环境提示:', response.data.hint)
        }
        console.log('📱 验证码已发送到您的手机，请查收短信')
      } else {
        console.log('❌ 验证码发送失败:', response.message)
      }
    } catch (error) {
      console.error('❌ 验证码发送失败:', error)
      console.log('验证码发送失败，请稍后重试')

      // 显示具体的错误信息
      taroShowToast({
        title: '验证码发送失败，请稍后重试',
        icon: 'error',
        duration: TIME_CONSTANTS.TWO_SECONDS
      })
    } finally {
      setCodeLoading(false)
    }
  }

  // 组件卸载时清理定时器
  React.useEffect(() => {
    return () => {
      clearCountdownTimer()
    }
  }, [countdownTimer])

  const handleInputChange = (field: keyof LoginForm, value: string) => {
    if (field === 'username') {
      handlePhoneInput(value)
    } else {
      setForm(prev => ({ ...prev, [field]: value }))
    }
  }

  const validatePhone = (phone: string) => {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '')
    
    // 检查长度
    if (cleanPhone.length !== 11) {
      return false
    }
    
    // 检查格式：1开头，第二位是3-9
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(cleanPhone)
  }

  // 处理手机号输入，添加实时格式化
  const handlePhoneInput = (value: string) => {
    // 只保留数字
    const cleanValue = value.replace(/\D/g, '')
    // 限制长度为11位
    const limitedValue = cleanValue.slice(0, 11)
    
    setForm(prev => ({ ...prev, username: limitedValue }))
    
    // 实时校验提示
    if (limitedValue.length > 0 && limitedValue.length < 11) {
      console.log('手机号长度不足，请输入11位手机号')
    } else if (limitedValue.length === 11 && !limitedValue.startsWith('1')) {
      console.log('手机号必须以1开头')
    } else if (limitedValue.length === 11 && !/^1[3-9]/.test(limitedValue)) {
      console.log('手机号第二位必须是3-9')
    }
  }

  const validateForm = () => {
    if (!form.username.trim()) {
      console.log('请输入手机号')
      return false
    }
    if (!validatePhone(form.username)) {
      console.log('请输入正确的手机号格式')
      return false
    }
    if (!form.verifyCode.trim()) {
      console.log('请输入验证码')
      return false
    }
    if (form.verifyCode.length !== 6) {
      console.log('验证码为6位数字')
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

    // 防止重复提交
    if (loading) {
      console.log('⚠️ 登录请求进行中，忽略重复点击')
      return
    }

    if (!validateForm()) {
      console.log('❌ 表单验证失败')
      return
    }

    // 检查是否已通过滑块验证（开发环境可跳过）
    if (!verifyToken && process.env.NODE_ENV !== 'development') {
      console.log('❌ 未通过滑块验证')
      console.log('请先完成安全验证')
      return
    }
    
    if (process.env.NODE_ENV === 'development' && !verifyToken) {
      console.log('🔓 开发环境：跳过滑块验证')
    }

    console.log('✅ 准备发送登录请求:', {
      username: form.username,
      verifyCode: '***',
      verifyToken: verifyToken ? '已获取' : '未获取',
      timestamp: new Date().toISOString()
    })

    setLoading(true)

    try {
      console.log('📡 发送登录请求...', new Date().toISOString())
      const response = await post('/auth/login-with-code', {
        phone: form.username,
        verifyCode: form.verifyCode,
        verifyToken
      })

      console.log('📦 收到登录响应:', response)

      if (response.success && response.data) {
        console.log('🎉 登录成功！')

        // 保存登录信息
        try {
          // 使用Token管理器保存Token信息
          if (response.data.token) {
            tokenManager.saveTokens({
              token: response.data.token,
              refreshToken: response.data.refreshToken || '',
              expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
            });
            console.log('✅ Token已保存');
          }
          
          if (response.data.user) {
            taroSetStorageSync(STORAGE_KEYS.USER_INFO, response.data.user)
            console.log('✅ 用户信息已保存')
          }

          // 记住用户名
          taroSetStorageSync(STORAGE_KEYS.REMEMBERED_USERNAME, form.username)

          console.log('👤 用户信息已保存:', response.data.user)
        } catch (storageError) {
          console.error('💾 保存用户信息失败:', storageError)
        }

        console.log('✅ 登录成功，准备跳转')
        console.log('登录成功')

        setTimeout(() => {
          console.log('🏠 跳转到首页')
          taroNavigateTo({ url: '/pages/index/index' })
        }, TIME_CONSTANTS.ONE_SECOND)

      } else {
        console.log('❌ 登录失败:', response.message || '未知错误')
        console.log(response.message || '登录失败，请检查验证码')
      }
    } catch (error: any) {
      console.error('❌ 登录请求失败:', error)
      
      // 详细记录错误信息
      console.log('请求错误详情:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        response: error.response,
        config: error.config
      })

      if (error.response?.status === 404) {
        console.log('API 路径不正确，请检查路由配置')
        taroShowToast({
          title: 'API路径不正确',
          icon: 'none',
          duration: 2000
        })
      } else if (error.message?.includes('Network Error')) {
        console.log('网络连接失败，请检查后端服务是否正常运行')
        taroShowToast({
          title: '网络连接失败',
          icon: 'none',
          duration: 2000
        })
      } else {
        console.log(error.message || '登录失败，请稍后重试')
        taroShowToast({
          title: error.message || '登录失败',
          icon: 'none',
          duration: 2000
        })
      }
    } finally {
      setLoading(false)
      console.log('登录请求完成')
    }
  }

  // 切换到人脸登录
  const switchToFaceLogin = () => {
    // 检查是否支持人脸登录
    if (!supportsFaceLogin) {
      if (isH5Environment) {
        taroShowToast({
          title: '当前环境不支持摄像头功能',
          icon: 'none',
          duration: TIME_CONSTANTS.THREE_SECONDS
        });
      } else {
        taroShowToast({
          title: '小程序暂不支持人脸登录，请使用H5版本',
          icon: 'none',
          duration: 3000
        });
      }
      return;
    }

    // 验证手机号
    if (!form.username || !form.username.trim()) {
      taroShowToast({
        title: '请先输入手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(form.username.trim())) {
      taroShowToast({
        title: '请输入正确的手机号格式',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('🎭 启动人脸登录，手机号:', form.username);
    setLoginMode('face');
    setShowFaceLogin(true);
  };

  // 人脸登录成功处理
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFaceLoginSuccess = (result: any) => {
    console.log('🎉 人脸登录成功:', result);
    setShowFaceLogin(false);
    setFaceLoginSuccess(true); // 设置人脸登录成功状态

    // 立即显示成功提示
    const toastTitle = result.isNewUser ? '欢迎新用户！' : '登录成功！';
    taroShowToast({
      title: toastTitle,
      icon: 'success',
      duration: 2000
    });

    // 如果是新用户，显示欢迎信息
    if (result.isNewUser) {
      console.log('🎉 欢迎新用户:', result.user?.nickName);
    }

    console.log('🏠 准备跳转到首页...');

    // 确保数据已保存后再跳转
    setTimeout(() => {
      // 验证数据是否正确保存
      try {
        console.log('📋 跳转前验证数据:');

        const savedToken = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
        const savedUser = taroGetStorageSync(STORAGE_KEYS.USER_INFO);

        console.log('  Token:', savedToken ? '已保存' : '未保存');
        console.log('  User:', savedUser ? savedUser.nickName : '未保存');

        if (!savedToken || !savedUser) {
          console.error('❌ 数据保存验证失败，延迟跳转');
          // 如果数据未保存，再等待一秒
          setTimeout(() => {
            console.log('🚀 延迟执行页面跳转');
            switchTab({
              url: '/pages/index/index'
            });
          }, TIME_CONSTANTS.ONE_SECOND);
          return;
        }

      } catch (error) {
        console.error('❌ 验证保存数据失败:', error);
      }

      console.log('🚀 执行页面跳转');
      switchTab({
        url: '/pages/index/index'
      });
    }, TIME_CONSTANTS.TWO_SECONDS); // 增加延迟时间到2秒，确保数据保存完成
  };

  // 人脸登录失败处理
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFaceLoginError = (error: string) => {
    console.error('人脸登录失败:', error);
    taroShowToast({
      title: error || '人脸登录失败',
      icon: 'error',
      duration: 2000
    });
  };

  // 取消人脸登录
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFaceLoginCancel = () => {
    setShowFaceLogin(false);
    setLoginMode('code');
  };

  // 如果显示人脸登录，渲染优化的人脸登录组件
  if (showFaceLogin) {
    return (
      <FaceLoginOptimized
        phone={form.username}
        autoStart={true}
        onSuccess={(result) => {
          console.log('🎉 人脸登录成功:', result);
          setShowFaceLogin(false);
          setFaceLoginSuccess(true);
          
          // 根据是否为新用户显示不同提示
          const successMessage = result.user?.isNewUser || result.isNewUser
            ? (result.faceRegistered ? '欢迎新用户！人脸注册并登录成功' : '欢迎新用户！登录成功')
            : (result.faceRegistered ? '人脸注册并登录成功' : '人脸登录成功');
          
          taroShowToast({
            title: successMessage,
            icon: 'success',
            duration: 3000
          });
          
          // 跳转到主页
          setTimeout(() => {
            switchTab({
              url: '/pages/index/index'
            });
          }, 2000);
        }}
        onError={(error) => {
          console.error('❌ 人脸登录失败:', error);
          setShowFaceLogin(false);
          setLoginMode('code');
          taroShowToast({
            title: error || '人脸登录失败，请重试',
            icon: 'error',
            duration: 3000
          });
        }}
        onCancel={() => {
          console.log('👋 用户取消人脸登录');
          setShowFaceLogin(false);
          setLoginMode('code');
        }}
      />
    );
  }

  return (
    <View className='login-page'>
      {/* 验证码显示区域 */}
      {receivedCode && (
        <View className='verify-code-display' style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '12px 16px',
          zIndex: Z_INDEX_CONSTANTS.MODAL.toString(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <Text style={{
            fontSize: '14px',
            fontWeight: '500',
            marginRight: '8px'
          }}>🔐 系统验证码:</Text>
          <Text style={{
            fontSize: '18px',
            fontWeight: 'bold',
            fontFamily: 'Courier New, monospace',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '4px 12px',
            borderRadius: '6px',
            letterSpacing: '3px',
            marginRight: '8px',
            cursor: 'pointer'
          }}
            onClick={() => {
              handleInputChange('verifyCode', receivedCode)
              console.log('验证码已自动填入')
            }}
          >{receivedCode}</Text>
          <Text style={{
            fontSize: '10px',
            opacity: '0.7',
            marginRight: '8px'
          }}>点击填入</Text>
          <Text
            style={{
              fontSize: '12px',
              opacity: '0.8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.1)'
            }}
            onClick={() => setReceivedCode(null)}
          >
            ✕
          </Text>
        </View>
      )}

      {/* 背景装饰 */}
      <View className='login-bg'>
        <View className='bg-circle circle-1'></View>
        <View className='bg-circle circle-2'></View>
        <View className='bg-circle circle-3'></View>
      </View>

      {/* 登录容器 */}
      <View className='login-container' style={{
        width: '100%',
        maxWidth: '380px',
        margin: '0 auto',
        padding: '20px 16px',
        marginTop: receivedCode ? '60px' : '0'
      }}>
        {/* Logo和标题 */}
        <View className='login-header' style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <View className='logo' style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 12px'
          }}>
            <Text className='logo-icon' style={{ fontSize: '32px' }}>⚡</Text>
          </View>
          <Text className='app-title' style={{
            fontSize: '28px',
            marginBottom: '6px'
          }}>智能充电</Text>
          <Text className='app-subtitle' style={{
            fontSize: '14px',
            marginBottom: '0'
          }}>让充电更简单</Text>
        </View>

        {/* 登录模式切换 */}
        <View className='login-mode-switch' style={{
          display: 'flex',
          marginBottom: '24px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'rgba(24, 144, 255, 0.05)',
          border: '1px solid rgba(24, 144, 255, 0.1)'
        }}>
          <Button
            className={`mode-switch-btn ${loginMode === 'code' ? 'active' : ''}`}
            onClick={() => setLoginMode('code')}
            style={{
              flex: '1',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0',
              background: loginMode === 'code'
                ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                : 'transparent',
              color: loginMode === 'code' ? '#fff' : '#666',
              transition: 'all 0.3s ease'
            }}
          >
            📱 短信验证码
          </Button>
          <Button
            className={`mode-switch-btn ${loginMode === 'face' ? 'active' : ''} ${!supportsFaceLogin ? 'disabled' : ''}`}
            onClick={switchToFaceLogin}
            disabled={!supportsFaceLogin}
            style={{
              flex: '1',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
              border: 'none',
              borderRadius: '0',
              background: loginMode === 'face'
                ? 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)'
                : !supportsFaceLogin
                ? '#f5f5f5'
                : 'transparent',
              color: loginMode === 'face' 
                ? '#fff' 
                : !supportsFaceLogin 
                ? '#ccc' 
                : '#666',
              opacity: !supportsFaceLogin ? 0.6 : 1,
              cursor: !supportsFaceLogin ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            🎭 人脸识别{!supportsFaceLogin && (isH5Environment ? ' (需要HTTPS)' : ' (暂不支持)')}
          </Button>
        </View>

        {/* 登录表单 */}
        <View className='login-form' style={{ width: '100%' }}>
          <View className='form-card' style={{
            padding: '24px 20px',
            borderRadius: '16px'
          }}>
            {/* 手机号输入框 */}
            <View className='input-group' style={{ marginBottom: '20px' }}>
              <View className='input-wrapper' style={{ minHeight: '48px' }}>
                <View className='input-icon' style={{
                  width: '48px',
                  height: '48px',
                  fontSize: '16px'
                }}>📱</View>
                <Input
                  className='form-input'
                  placeholder='请输入手机号'
                  placeholderClass='input-placeholder'
                  value={form.username}
                  onInput={(e) => handleInputChange('username', e.detail.value)}
                  style={{
                    padding: '12px 16px',
                    fontSize: '16px'
                  }}
                />
              </View>
              <View className='input-tip' style={{
                fontSize: '12px',
                color: '#666',
                marginTop: '6px',
                paddingLeft: '48px'
              }}>
                首次登录将自动为您创建账户
              </View>
            </View>

            {/* 验证码输入框 */}
            <View style={{ margin: '20px 0' }}>
              <View style={{ marginBottom: '10px' }}>
                <Text style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#333333',
                  letterSpacing: '0.5px'
                }}>🔑 验证码</Text>
              </View>

              <View style={{
                padding: '2px',
                borderRadius: '10px',
                marginBottom: '14px',
                background: 'rgba(24, 144, 255, 0.05)',
                border: '1px solid rgba(24, 144, 255, 0.1)'
              }}>
                <Input
                  className='verify-code-input-new'
                  value={form.verifyCode}
                  type='text'
                  maxlength={6}
                  adjustPosition={true}
                  holdKeyboard={false}
                  onInput={(e) => {
                    handleInputChange('verifyCode', e.detail.value)
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    background: '#fff',
                    fontSize: '16px',
                    fontWeight: '500',
                    letterSpacing: '2px',
                    textAlign: 'center',
                    color: '#333333',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                />
              </View>

              <Button
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: codeLoading || countdown > 0
                    ? 'linear-gradient(135deg, #d9d9d9 0%, #bfbfbf 100%)'
                    : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  boxShadow: codeLoading || countdown > 0
                    ? 'none'
                    : '0 4px 15px rgba(24, 144, 255, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onClick={handleGetVerifyCode}
                disabled={codeLoading || countdown > 0}
              >
                {codeLoading ? '发送中...' : countdown > 0 ? `重新获取 (${countdown}s)` : '获取验证码'}
              </Button>
            </View>

            {/* 安全验证模块 */}
            {process.env.NODE_ENV !== 'development' && (
              <View className='security-verify-section' style={{ margin: '20px 0' }}>
                <View className='verify-title' style={{ marginBottom: '12px' }}>
                  <Text className='verify-title-text' style={{ fontSize: '14px' }}>安全验证</Text>
                  <Text className='verify-desc' style={{ fontSize: '12px' }}>请拖动滑块完成验证</Text>
                </View>

              <View className='slider-verify-container' style={{
                margin: '12px 0',
                padding: '10px'
              }}>
                <SliderVerify
                  onSuccess={handleSliderSuccess}
                  onError={handleSliderError}
                  width={248}
                  height={40}
                />
              </View>

                {/* 验证状态提示 */}
                {verifyToken && (
                  <View className='verify-status' style={{ margin: '10px 0 0 0' }}>
                    <Text className='verify-success-text' style={{ fontSize: '12px' }}>✓ 安全验证已通过</Text>
                  </View>
                )}
              </View>
            )}

            {/* 开发环境提示 */}
            {process.env.NODE_ENV === 'development' && (
              <View className='dev-notice' style={{
                margin: '20px 0',
                padding: '12px',
                backgroundColor: '#f0f8ff',
                borderRadius: '8px',
                borderLeft: '4px solid #1890ff'
              }}>
                <Text style={{ fontSize: '12px', color: '#1890ff' }}>
                  🔧 开发环境：已跳过滑块验证，可直接登录
                </Text>
              </View>
            )}

            <Button
              className={`login-btn ${loading ? 'loading' : ''} ${(!verifyToken && process.env.NODE_ENV !== 'development') ? 'disabled' : ''}`}
              onClick={handleLogin}
              disabled={loading || (!verifyToken && process.env.NODE_ENV !== 'development')}
              style={{
                height: '48px',
                fontSize: '16px',
                fontWeight: '600',
                marginTop: '8px'
              }}
            >
              {loading ? '登录中...' : 
               (verifyToken || process.env.NODE_ENV === 'development') ? '登录' : '请先完成验证'}
            </Button>

            {/* 重新验证按钮 */}
            {verifyToken && (
              <View className='reverify-container' style={{ marginTop: '10px' }}>
                <Text
                  className='reverify-btn'
                  onClick={resetVerification}
                  style={{ fontSize: '12px' }}
                >
                  重新验证
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 操作提示 */}
        <View className='login-tips' style={{
          marginTop: '24px',
          padding: '16px',
          background: 'rgba(24, 144, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(24, 144, 255, 0.1)'
        }}>
          <View className='tip-item' style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <Text className='tip-icon' style={{
              fontSize: '14px',
              marginRight: '8px'
            }}>📱</Text>
            <Text className='tip-text' style={{
              fontSize: '12px',
              color: '#666'
            }}>输入手机号获取验证码即可登录</Text>
          </View>
          <View className='tip-item' style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <Text className='tip-icon' style={{
              fontSize: '14px',
              marginRight: '8px'
            }}>🆕</Text>
            <Text className='tip-text' style={{
              fontSize: '12px',
              color: '#666'
            }}>新用户首次登录将自动注册</Text>
          </View>
          <View className='tip-item' style={{
            display: 'flex',
            alignItems: 'center'
          }}>
            <Text className='tip-icon' style={{
              fontSize: '14px',
              marginRight: '8px'
            }}>👤</Text>
            <Text className='tip-text' style={{
              fontSize: '12px',
              color: '#666'
            }}>支持人脸识别快速登录</Text>
          </View>
        </View>
      </View>
    </View>
  )
}