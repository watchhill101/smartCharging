import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Charging() {
  useLoad(() => {
    console.log('充电页面加载')
  })

  return (
    <View className='charging-page'>
      <Text>充电页面</Text>
      <View className='charging-container'>
        {/* 充电相关组件将在后续任务中实现 */}
        <Text className='placeholder'>充电功能占位</Text>
      </View>
    </View>
  )
}