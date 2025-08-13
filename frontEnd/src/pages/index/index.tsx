import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Index() {
  useLoad(() => {
    console.log('智能充电应用启动')
  })

  const quickActions = [
    '券包中心',
    '充电订单',
    '常用电站',
    '设备地图',
  ]

  const filters = ['不限', '电子充电卡', '免费停车', '快充']

  return (
    <View className='index'>
      <View className='top-bar'>
        <View className='city'>石家庄市</View>
        <View className='search'>请输入目的地/电站名</View>
        <View className='extra'>···</View>
      </View>

      <View className='content'>
        <View className='feature-section card'>
          <View className='feature-grid'>
            {quickActions.map((text) => (
              <View
                className='feature-item'
                key={text}
                onClick={() => {
                  if (text === '设备地图') {
                    Taro.navigateTo({
                      url: '/pages/map/index'
                    })
                  }
                }}
              >
                <View className='feature-icon' />
                <Text className='feature-text'>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='filter-bar card'>
          {filters.map((f) => (
            <View className='filter-tag' key={f}>
              {f}
            </View>
          ))}
        </View>

        <View className='bind-car-hint'>
          绑定车辆 享受更好的充电体验
          <Text className='action'>去绑定</Text>
        </View>

        <View className='station-card card'>
          <View className='station-top'>
            <View className='logo' />
            <Text className='station-title big'>八里庄家园充电站</Text>
            <View className='status-chip slow'>慢 闲10/10</View>
          </View>

          <View className='tag-list'>
            <View className='tag'>对外开放</View>
            <View className='tag'>24小时营业</View>
          </View>

          <View className='info-list'>
            <View className='info-item'>
              <View className='icon parking' />
              <Text className='info-text'>按实际场地收费标准收费</Text>
            </View>
            <View className='info-item active'>
              <View className='icon active-icon' />
              <Text className='info-text'>12小时内有人充电</Text>
            </View>
          </View>

          <View className='divider' />

          <View className='bottom-row'>
            <View className='price'>
              <Text className='currency'>¥</Text>
              <Text className='amount'>1.0000</Text>
              <Text className='unit'>起/度</Text>
            </View>
            <View className='distance-chip'>
              <View className='nav-icon' />
              <Text>1.14km</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
