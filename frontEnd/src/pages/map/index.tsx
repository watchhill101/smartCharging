import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'

export default function Map() {
  useLoad(() => {
    console.log('地图页面加载')
  })

  const [activeTab, setActiveTab] = useState(1) // 0: 首页 1: 地图 2: 充电 3: 我的

  const quickActions = [
    '券包中心',
    '充电订单',
    '常用电站',
    '设备地图',
    '安心充电服务',
    '免费车辆估值',
    '特惠买桩',
    '车险报价'
  ]

  const filters = ['不限', '电子充电卡', '免费停车', '快充']

  return (
    <View className='map-page'>
      <View className='top-bar'>
        <View className='city'>石家庄市</View>
        <View className='search'>请输入目的地/电站名</View>
        <View className='extra'>···</View>
      </View>

      <View className='content'>
        <View className='feature-section card'>
          <View className='feature-grid'>
            {quickActions.map((text) => (
              <View className='feature-item' key={text}>
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
          <View className='station-header'>
            <Text className='station-title'>翰林福邸充电站</Text>
            <View className='badge warning'>暂不可用</View>
          </View>
          <View className='station-meta'>
            <Text className='price'>¥ 1.0000 起/度</Text>
            <Text className='distance'>1.33km</Text>
          </View>
          <View className='station-features'>
            <Text className='feature'>24小时营业</Text>
            <Text className='feature'>按实际场地收费</Text>
            <Text className='feature'>2天内人充电</Text>
          </View>
        </View>
      </View>

      <View className='tabbar'>
        {['首页', '地图', '充电', '我的'].map((t, i) => (
          <View
            key={t}
            className={`tabbar-item ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <View className='tabbar-icon' />
            <Text className='tabbar-text'>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}