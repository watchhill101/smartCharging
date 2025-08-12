import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'
import { SafeButton } from '../../utils/platform'

export default function Index () {
  useLoad(() => {
    console.log('智能充电应用启动')
  })

  return (
    <View className='index'>
      <Text className='welcome-text'>智能充电</Text>
      
      {/* 使用安全的按钮组件，自动适配不同平台 */}
      <SafeButton type='primary' className='demo-button'>
        开始使用
      </SafeButton>
    </View>
  )
}
