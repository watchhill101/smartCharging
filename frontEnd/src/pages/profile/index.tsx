import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Profile() {
  useLoad(() => {
    console.log('个人中心页面加载')
  })

  return (
    <View className='profile-page'>
      <Text>个人中心</Text>
      <View className='profile-container'>
        {/* 个人中心相关组件将在后续任务中实现 */}
        <Text className='placeholder'>个人中心功能占位</Text>
      </View>
    </View>
  )
}