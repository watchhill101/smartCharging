import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
import { SafeButton } from '../../utils/platform'
import { STORAGE_KEYS } from '../../utils/constants'

export default function Index() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useLoad(() => {
    console.log('智能充电应用启动')
    checkLoginStatus()
  })

  useDidShow(() => {
    // 每次显示页面时检查登录状态
    checkLoginStatus()
  })

  const checkLoginStatus = () => {
    try {
      const token = Taro.getStorageSync(STORAGE_KEYS.USER_TOKEN)
      const user = Taro.getStorageSync(STORAGE_KEYS.USER_INFO)

      if (token && user) {
        setIsLoggedIn(true)
        setUserInfo(user)
        console.log('当前登录用户:', user)
      } else {
        setIsLoggedIn(false)
        setUserInfo(null)
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      setIsLoggedIn(false)
      setUserInfo(null)
    }
  }

  const goToLogin = () => {
    Taro.navigateTo({
      url: '/pages/login/login'
    })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储的登录信息
          Taro.removeStorageSync(STORAGE_KEYS.USER_TOKEN)
          Taro.removeStorageSync(STORAGE_KEYS.USER_INFO)
          Taro.removeStorageSync('refresh_token')

          setIsLoggedIn(false)
          setUserInfo(null)

          console.log('已退出登录')
        }
      }
    })
  }

  return (
    <View className='index'>
      <Text className='welcome-text'>智能充电</Text>

      {isLoggedIn && userInfo ? (
        <View className='user-info-card'>
          <View className='user-header'>
            <Text className='user-name'>欢迎，{userInfo.nickName || '用户'}</Text>
            <Text className='user-phone'>{userInfo.phone}</Text>
          </View>
          <View className='user-details'>
            <View className='detail-item'>
              <Text className='label'>账户余额：</Text>
              <Text className='value'>¥{userInfo.balance || 0}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>验证等级：</Text>
              <Text className='value'>
                {userInfo.verificationLevel === 'basic' ? '基础认证' : '人脸认证'}
              </Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>车辆数量：</Text>
              <Text className='value'>{userInfo.vehicles?.length || 0} 辆</Text>
            </View>
          </View>
          <SafeButton type='default' className='logout-button' onClick={handleLogout}>
            退出登录
          </SafeButton>
        </View>
      ) : (
        <View className='login-prompt'>
          <Text className='prompt-text'>请先登录以使用完整功能</Text>
          <SafeButton type='primary' className='demo-button' onClick={goToLogin}>
            立即登录
          </SafeButton>
        </View>
      )}

      {/* 功能按钮 */}
      <View className='function-buttons'>
        <SafeButton type='primary' className='demo-button mt-md'>
          开始充电
        </SafeButton>
        <SafeButton type='default' className='demo-button mt-md'>
          充电记录
        </SafeButton>
      </View>
    </View>
  )
}
