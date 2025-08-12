import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Map() {
  useLoad(() => {
    console.log('地图页面加载')
  })

  return (
    <View className='map-page'>
      <Text>地图页面</Text>
      <View className='map-container'>
        {/* 地图组件将在后续任务中实现 */}
        <Text className='placeholder'>地图组件占位</Text>
      </View>
    </View>
  )
}