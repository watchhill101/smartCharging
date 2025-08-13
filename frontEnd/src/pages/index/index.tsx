import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import {
  getStorageSync as taroGetStorageSync,
  removeStorageSync as taroRemoveStorageSync,
  navigateTo as taroNavigateTo,
  showModal as taroShowModal
} from '@tarojs/taro'
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

  // 检查登录状态
  const checkLoginStatus = () => {
    try {
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN)
      const user = taroGetStorageSync(STORAGE_KEYS.USER_INFO)

      if (token && user) {
        setUserInfo(user)
        setIsLoggedIn(true)
        console.log('用户已登录:', user)
      } else {
        setIsLoggedIn(false)
        console.log('用户未登录')
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      setIsLoggedIn(false)
    }
  }

  // 跳转到登录页
  const handleLogin = () => {
    try {
      taroNavigateTo({
        url: '/pages/login/login'
      })
    } catch (error) {
      console.log('页面跳转不可用:', error)
    }
  }

  // 登出
  const handleLogout = () => {
    try {
      taroShowModal({
        title: '提示',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            try {
              taroRemoveStorageSync(STORAGE_KEYS.USER_TOKEN)
              taroRemoveStorageSync(STORAGE_KEYS.USER_INFO)
              taroRemoveStorageSync('refresh_token')
              setUserInfo(null)
              setIsLoggedIn(false)
              console.log('用户已登出')
            } catch (error) {
              console.error('退出登录失败:', error)
            }
          }
        }
      })
    } catch (error) {
      console.log('showModal 不可用:', error)
    }
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
          <SafeButton type='primary' className='demo-button' onClick={handleLogin}>
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
