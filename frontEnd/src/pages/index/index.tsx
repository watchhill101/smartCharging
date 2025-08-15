import React from 'react'
import { View, Text } from '@tarojs/components'
import Icon from '../../components/Icon'
import { SOLID_ICONS } from '../../utils/fontawesome'
import './index.scss'
import { Scanner } from '@yudiel/react-qr-scanner';


const Index: React.FC = () => {
  return (
    <View className="index">
      <View>
        <Text>首页</Text>
      </View>
      <View>
        <Scanner onScan={(result) => console.log(result)} />
      </View>
    </View>
  )
}

export default Index
