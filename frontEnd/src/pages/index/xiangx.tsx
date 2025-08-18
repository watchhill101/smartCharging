import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './xiangx.scss'

export default function XiangX() {
  useLoad(() => {
    console.log('详情页面加载中...')
  })

  return (
    <View className='xiangx-page'>
      <View className='welcome-section'>
        <Text className='welcome-text'>您好</Text>
        <Text className='welcome-subtitle'>欢迎来到充电站详情页面</Text>
      </View>
      
      <View className='content-section'>
        <Text className='content-text'>这里是充电站的详细信息</Text>
        <Text className='content-text'>您可以查看充电桩状态、价格等信息</Text>
      </View>
    </View>
  )
}
