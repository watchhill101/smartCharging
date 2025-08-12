import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'
import { Button } from '@nutui/nutui-react-taro'

export default function Index () {
  useLoad(() => {
    console.log('智能充电应用启动')
  })

  return (
    <View className='index'>
      <Text className='welcome-text'>智能充电</Text>
      <Button type="primary" className='demo-button'>
        开始使用
      </Button>
    </View>
  )
}
