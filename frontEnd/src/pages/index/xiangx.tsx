import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import './xiangx.scss'

// 充电站详情数据接口
interface ChargingStationDetail {
  _id: string
  name: string
  address: string
  location: {
    type: 'Point'
    coordinates: [number, number]
  }
  operator: string
  operatingHours: {
    open: string
    close: string
  }
  parkingFee: number
  photos: string[]
  chargers: Array<{
    chargerId: string
    type: 'fast' | 'slow'
    power: number
    status: 'available' | 'busy' | 'offline'
    pricing: {
      electricityFee: number
      serviceFee: number
    }
  }>
  rating: number
  reviewCount: number
  distance?: number
  createdAt: Date
  updatedAt: Date
}

export default function XiangX() {
  const [stationInfo, setStationInfo] = useState<ChargingStationDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'terminals'>('details')

  useLoad(() => {
    console.log('详情页面加载中...')
    // 从存储获取充电站信息
    let stationData = null
    
    try {
      // 优先尝试Taro存储
      if (typeof Taro.getStorageSync === 'function') {
        stationData = Taro.getStorageSync('selected_station')
        console.log('从Taro存储获取到的数据:', stationData)
      }
      
      // 如果Taro存储没有数据，尝试浏览器localStorage
      if (!stationData) {
        try {
          const browserData = localStorage.getItem('selected_station')
          if (browserData) {
            stationData = JSON.parse(browserData)
            console.log('从浏览器localStorage获取到的数据:', stationData)
          }
        } catch (browserError) {
          console.log('浏览器localStorage读取失败:', browserError)
        }
      }
      
      if (stationData) {
        setStationInfo(stationData)
        console.log('充电站数据设置成功')
      } else {
        console.log('未找到充电站数据，使用模拟数据')
        // 使用模拟数据
        setStationInfo(mockStationData)
      }
    } catch (error) {
      console.error('获取充电站数据失败:', error)
      // 使用模拟数据作为备选
      setStationInfo(mockStationData)
    }
  })

  // 模拟充电站数据
  const mockStationData: ChargingStationDetail = {
    _id: 'cs001',
    name: '天鹅湾充电站',
    address: '河北省保定市竞秀区丽园路和润家园',
    location: {
      type: 'Point',
      coordinates: [115.4901, 38.8731]
    },
    operator: '河北省-保定市-李*丽',
    operatingHours: { open: '00:00', close: '24:00' },
    parkingFee: 0,
    photos: ['https://example.com/station1.jpg'],
    chargers: [
      {
        chargerId: 'ch001',
        type: 'fast',
        power: 60,
        status: 'offline',
        pricing: { electricityFee: 0.83, serviceFee: 0.12 }
      },
      {
        chargerId: 'ch002',
        type: 'slow',
        power: 7,
        status: 'available',
        pricing: { electricityFee: 0.75, serviceFee: 0.10 }
      },
      {
        chargerId: 'ch003',
        type: 'slow',
        power: 7,
        status: 'available',
        pricing: { electricityFee: 0.75, serviceFee: 0.10 }
      },
      {
        chargerId: 'ch004',
        type: 'slow',
        power: 7,
        status: 'available',
        pricing: { electricityFee: 0.75, serviceFee: 0.10 }
      }
    ],
    rating: 4.5,
    reviewCount: 28,
    distance: 1340,
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // 处理新手操作指引
  const handleNewUserGuide = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '新手操作指引',
          icon: 'none'
        })
      } else {
        alert('新手操作指引')
      }
    } catch (error) {
      console.error('Toast显示失败:', error)
      alert('新手操作指引')
    }
  }

  // 处理购买充电卡
  const handleBuyCard = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '跳转购买充电卡页面',
          icon: 'none'
        })
      } else {
        alert('跳转购买充电卡页面')
      }
    } catch (error) {
      console.error('Toast显示失败:', error)
      alert('跳转购买充电卡页面')
    }
  }

  // 处理车辆绑定
  const handleBindVehicle = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '跳转车辆绑定页面',
          icon: 'none'
        })
      } else {
        alert('跳转车辆绑定页面')
      }
    } catch (error) {
      console.error('Toast显示失败:', error)
      alert('跳转车辆绑定页面')
    }
  }

  // 处理导航
  const handleNavigate = () => {
    if (stationInfo) {
      const [lng, lat] = stationInfo.location.coordinates
      const mapData = { lng, lat }
      const stationData = {
        name: stationInfo.name,
        address: stationInfo.address,
        distance: stationInfo.distance,
        rating: stationInfo.rating
      }
      
      try {
        // 尝试使用Taro存储
        if (typeof Taro.setStorageSync === 'function') {
          Taro.setStorageSync('map_target_coord', mapData)
          Taro.setStorageSync('map_target_station', stationData)
          console.log('地图数据已保存到Taro存储')
        } else {
          // 降级到浏览器localStorage
          localStorage.setItem('map_target_coord', JSON.stringify(mapData))
          localStorage.setItem('map_target_station', JSON.stringify(stationData))
          console.log('地图数据已保存到浏览器localStorage')
        }
        
        // 尝试导航到地图页面
        if (typeof Taro.navigateTo === 'function') {
          Taro.navigateTo({ url: '/pages/map/index' })
        } else {
          // 降级到浏览器导航
          window.location.hash = '#/pages/map/index'
        }
      } catch (error) {
        console.error('导航到地图失败:', error)
        // 最后的备选方案
        try {
          localStorage.setItem('map_target_coord', JSON.stringify(mapData))
          localStorage.setItem('map_target_station', JSON.stringify(stationData))
          window.location.hash = '#/pages/map/index'
        } catch (fallbackError) {
          console.error('备选方案也失败了:', fallbackError)
        }
      }
    }
  }

  // 处理扫码充电
  const handleScanCharge = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '扫码充电功能',
          icon: 'none'
        })
      } else {
        alert('扫码充电功能')
      }
    } catch (error) {
      console.error('Toast显示失败:', error)
      alert('扫码充电功能')
    }
  }

  if (!stationInfo) {
    return (
      <View className='xiangx-page'>
        <View className='loading'>加载中...</View>
      </View>
    )
  }

  // 获取快充和慢充状态
  const getFastChargers = () => {
    const fastChargers = stationInfo.chargers.filter(c => c.type === 'fast')
    const available = fastChargers.filter(c => c.status === 'available').length
    return { available, total: fastChargers.length }
  }

  const getSlowChargers = () => {
    const slowChargers = stationInfo.chargers.filter(c => c.type === 'slow')
    const available = slowChargers.filter(c => c.status === 'available').length
    return { available, total: slowChargers.length }
  }

  // 获取总价格
  const getTotalPrice = () => {
    if (!stationInfo.chargers.length) return '0.0000'
    const pricing = stationInfo.chargers[0].pricing
    return (pricing.electricityFee + pricing.serviceFee).toFixed(4)
  }

  return (
    <View className='xiangx-page'>
      {/* 新手操作指引 */}
      <View className='new-user-guide' onClick={handleNewUserGuide}>
        新手操作指引 {'>'}
      </View>

      {/* 促销横幅 */}
      <View className='promo-banner'>
        <View className='banner-content'>
          <View className='banner-icon'>
            <Text className='icon-text'>省</Text>
          </View>
          <View className='banner-text'>
            站点支持购买充电卡,充电更划算
          </View>
          <View className='banner-button' onClick={handleBuyCard}>
            去购卡
          </View>
        </View>
      </View>

      {/* 充电站信息卡片 */}
      <View className='station-info-card'>
        <View className='station-header'>
          <Text className='station-name'>{stationInfo.name}</Text>
          <View className='station-tags'>
            <View className='tag ground'>地上</View>
            <View className='tag invoice'>支持开票</View>
          </View>
        </View>

        <View className='station-details'>
          <View className='detail-row'>
            <View className='detail-item'>
              <Text className='detail-icon'>🕐</Text>
              <Text className='detail-text'>
                {stationInfo.operatingHours.open}-{stationInfo.operatingHours.close} 营业
              </Text>
            </View>
            <View className='detail-item'>
              <Text className='detail-icon'>📶</Text>
              <Text className='detail-text'>11小时内有人充电</Text>
            </View>
          </View>
        </View>

        <View className='parking-section'>
          <View className='parking-info'>
            <Text className='parking-title'>停车费用</Text>
            <Text className='parking-status'>
              {stationInfo.parkingFee === 0 ? '免费停车' : `¥${stationInfo.parkingFee}/小时`}
            </Text>
          </View>
          <View className='parking-icon'>
            <View className='car-icon'>🚗</View>
            <View className='p-symbol'>P</View>
          </View>
          <View className='bind-vehicle'>
            <Text className='bind-text'>绑定车辆享受更好的充电服务</Text>
            <Text className='bind-link' onClick={handleBindVehicle}>去绑定 {'>'}</Text>
          </View>
        </View>

        <View className='address-section'>
          <Text className='address-text'>{stationInfo.address}</Text>
          <View className='navigation-button' onClick={handleNavigate}>
            <Text className='nav-icon'>📡</Text>
            <Text className='nav-text'>导航</Text>
          </View>
        </View>
      </View>

      {/* 充电桩状态 */}
      <View className='charger-status-section'>
        <View className={`status-item fast ${getFastChargers().total === 0 ? 'unavailable' : ''}`}>
          <Text className='status-label'>快充</Text>
          <Text className='status-text'>空闲 {getFastChargers().available} / 共 {getFastChargers().total}</Text>
        </View>
        <View className={`status-item slow ${getSlowChargers().total === 0 ? 'unavailable' : ''}`}>
          <Text className='status-label'>慢充</Text>
          <Text className='status-text'>空闲 {getSlowChargers().available} / 共 {getSlowChargers().total}</Text>
        </View>
      </View>

      {/* 详细信息标签页 */}
      <View className='tabs-section'>
        <View className='tabs-header'>
          <View 
            className={`tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            电站详情
          </View>
          <View 
            className={`tab ${activeTab === 'terminals' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminals')}
          >
            终端列表
          </View>
        </View>

        {activeTab === 'details' && (
          <View className='tab-content details'>
            <View className='pricing-info'>
              <View className='current-period'>
                当前 {stationInfo.operatingHours.open}-{stationInfo.operatingHours.close}
              </View>
              <View className='price-breakdown'>
                电费{stationInfo.chargers[0]?.pricing.electricityFee || 0}元/度 | 服务费{stationInfo.chargers[0]?.pricing.serviceFee || 0}元/度
              </View>
              <View className='total-price'>¥{getTotalPrice()}起</View>
            </View>
          </View>
        )}

        {activeTab === 'terminals' && (
          <View className='tab-content terminals'>
            <View className='terminal-list'>
              {stationInfo.chargers.map((charger, index) => (
                <View key={charger.chargerId} className='terminal-item'>
                  <View className='terminal-header'>
                    <Text className='terminal-id'>终端{index + 1}</Text>
                    <View className={`status-badge ${charger.status}`}>
                      {charger.status === 'available' ? '空闲' : 
                       charger.status === 'busy' ? '使用中' : '离线'}
                    </View>
                  </View>
                  <View className='terminal-details'>
                    <Text className='charger-type'>{charger.type === 'fast' ? '快充' : '慢充'}</Text>
                    <Text className='charger-power'>{charger.power}kW</Text>
                    <Text className='charger-price'>¥{(charger.pricing.electricityFee + charger.pricing.serviceFee).toFixed(4)}/度</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 营业信息 */}
      <View className='business-info-section'>
        <View className='business-header'>
          <Text className='business-title'>营业信息</Text>
          <View className='business-tag'>他营</View>
        </View>
        <View className='business-details'>
          <View className='info-line'>
            <Text className='label'>服务提供:</Text>
            <Text className='value'>{stationInfo.operator}</Text>
          </View>
          <View className='info-line'>
            <Text className='label'>发票服务:</Text>
            <Text className='value'>{stationInfo.operator}</Text>
          </View>
          <View className='info-line'>
            <Text className='label'>服务热线:</Text>
            <Text className='value'>0797-966999</Text>
          </View>
        </View>
        <View className='disclaimer'>
          <Text className='disclaimer-icon'>ℹ️</Text>
          <Text className='disclaimer-text'>以上信息由经营者自行提供,具体以工商部门登记为准</Text>
        </View>
      </View>

      {/* 扫码充电按钮 */}
      <View className='scan-charge-section'>
        <View className='scan-charge-btn' onClick={handleScanCharge}>
          扫码充电
        </View>
      </View>
    </View>
  )
}
