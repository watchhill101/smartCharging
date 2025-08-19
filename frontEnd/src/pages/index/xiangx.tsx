import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import stationDetailsData from '../../data/stationDetails.json'
import commentsData from '../../data/comments.json'
import './xiangx.scss'

// 声明微信小程序全局对象类型
declare global {
  interface Window {
    wx?: any
  }
  const wx: any
}

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
  createdAt: string
  updatedAt: string
}

export default function XiangX() {
  const [stationInfo, setStationInfo] = useState<ChargingStationDetail | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'terminals'>('details')
  const [userPhotos, setUserPhotos] = useState<string[]>([])
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [showMapSelectorModal, setShowMapSelectorModal] = useState(false)
  const [mapSelectorData, setMapSelectorData] = useState<{
    maps: Array<{name: string, url: string}>
    lat: number
    lng: number
    name: string
    address: string
  } | null>(null)
  
  // 评论区相关状态
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [userRating, setUserRating] = useState(5)
  const [comments, setComments] = useState<Array<{
    id: string
    user: string
    avatar: string
    content: string
    rating: number
    time: string
    likes: number
  }>>([])

  // 从JSON文件导入充电站详情数据
  const mockStationData: ChargingStationDetail = stationDetailsData[0] as unknown as ChargingStationDetail

  // 处理返回功能
  const handleGoBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack({
          fail: () => fallbackToSwitchTab()
        })
        return
      }
      fallbackToSwitchTab()
    } catch (error) {
      fallbackToSwitchTab()
    }
  }

  // 备选返回方案：使用switchTab
  const fallbackToSwitchTab = () => {
    try {
      if (typeof Taro.switchTab === 'function') {
        Taro.switchTab({ url: '/pages/index/index' })
      } else {
        fallbackToBrowser()
      }
    } catch (error) {
      fallbackToBrowser()
    }
  }

  // 最后的备选方案：浏览器导航
  const fallbackToBrowser = () => {
    try {
      if (window.history && window.history.length > 1) {
        window.history.back()
      } else {
        window.location.hash = '#/pages/index/index'
      }
    } catch (error) {
      try {
        window.location.href = '/pages/index/index'
      } catch (finalError) {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({
            title: '返回失败，请手动返回',
            icon: 'error',
            duration: 3000
          })
        }
      }
    }
  }

  // 选择终端并跳转开始充电
  const handleSelectTerminal = (charger: ChargingStationDetail['chargers'][number], index: number) => {
    try {
      const payload = {
        stationId: stationInfo?._id,
        stationName: stationInfo?.name,
        address: stationInfo?.address,
        chargerOrder: index + 1,
        chargerId: charger.chargerId,
        chargerType: charger.type,
        chargerPower: charger.power,
        pricePerKwh: (charger.pricing.electricityFee + charger.pricing.serviceFee).toFixed(4),
        currentPeriod: `${stationInfo?.operatingHours.open}-${stationInfo?.operatingHours.close}`
      }

      if (typeof Taro.setStorageSync === 'function') {
        Taro.setStorageSync('selected_terminal', payload)
      } else {
        localStorage.setItem('selected_terminal', JSON.stringify(payload))
      }

      Taro.navigateTo({ url: '/pages/charging/start/index' })
    } catch (error) {
      Taro.showToast({ title: '选择终端失败', icon: 'none' })
    }
  }

  // 处理导航
  const handleNavigate = () => {
    if (stationInfo) {
      const [lng, lat] = stationInfo.location.coordinates
      const stationName = stationInfo.name
      const stationAddress = stationInfo.address
      
      try {
        if (typeof Taro.openLocation === 'function') {
          Taro.openLocation({
            latitude: lat,
            longitude: lng,
            name: stationName,
            address: stationAddress,
            scale: 18,
            fail: () => {
              openMapWithUniversalLink(lat, lng, stationName, stationAddress)
            }
          })
        } else {
          openMapWithUniversalLink(lat, lng, stationName, stationAddress)
        }
      } catch (error) {
        openMapWithUniversalLink(lat, lng, stationName, stationAddress)
      }
    }
  }

  // 使用通用地图链接打开地图应用
  const openMapWithUniversalLink = (lat: number, lng: number, name: string, address: string) => {
    try {
      const maps = [
        {
          name: '高德地图',
          url: `amapuri://route/plan/?sid=BGVIS1&slat=&slon=&sname=我的位置&did=BGVIS2&dlat=${lat}&dlon=${lng}&dname=${encodeURIComponent(name)}&dev=0&t=0`
        },
        {
          name: '百度地图',
          url: `baidumap://map/direction?destination=latlng:${lat},${lng}|name:${encodeURIComponent(name)}&mode=driving&region=${encodeURIComponent(address)}`
        },
        {
          name: '腾讯地图',
          url: `qqmap://map/routeplan?type=drive&to=${encodeURIComponent(name)}&tocoord=${lat},${lng}&referer=myapp`
        }
      ]

      let opened = false
      
      if (typeof wx !== 'undefined' && wx.openLocation) {
        wx.openLocation({
          latitude: lat,
          longitude: lng,
          name: name,
          address: address,
          scale: 18,
          success: () => {
            opened = true
          }
        })
      }

      if (!opened) {
        openMapSelectorModal(maps, lat, lng, name, address)
      }
    } catch (error) {
      showCoordinateInfo(lat, lng, name, address)
    }
  }

  // 显示地图选择器模态框
  const openMapSelectorModal = (maps: Array<{name: string, url: string}>, lat: number, lng: number, name: string, address: string) => {
    setMapSelectorData({ maps, lat, lng, name, address })
    setShowMapSelectorModal(true)
  }

  // 处理地图应用选择
  const handleMapSelection = (selectedMap: {name: string, url: string}) => {
    setShowMapSelectorModal(false)
    try {
      openMapInBrowser(selectedMap.url, selectedMap.name)
    } catch (error) {
      openMapInBrowser(selectedMap.url, selectedMap.name)
    }
  }

  // 关闭地图选择器
  const closeMapSelector = () => {
    setShowMapSelectorModal(false)
    setMapSelectorData(null)
  }

  // 在浏览器中打开地图
  const openMapInBrowser = (url: string, mapName: string) => {
    try {
      const newWindow = window.open(url, '_blank')
      if (newWindow) {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({
            title: `已打开${mapName}`,
            icon: 'success',
            duration: 2000
          })
        }
      } else {
        window.location.href = url
      }
    } catch (error) {
      showCoordinateInfo(0, 0, '', '')
    }
  }

  // 显示坐标信息
  const showCoordinateInfo = (lat: number, lng: number, name: string, address: string) => {
    try {
      if (typeof Taro.showModal === 'function') {
        Taro.showModal({
          title: '导航信息',
          content: `充电站：${name}\n地址：${address}\n坐标：${lat}, ${lng}\n\n请手动复制坐标到地图应用`,
          showCancel: false,
          confirmText: '知道了'
        })
      }
    } catch (error) {
      // 忽略错误
    }
  }

  // 打开评论区
  const openComments = () => {
    setShowComments(true)
  }

  // 关闭评论区
  const closeComments = () => {
    setShowComments(false)
    setCommentText('')
    setUserRating(5)
  }

  // 提交评论
  const submitComment = () => {
    if (!commentText.trim()) {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '请输入评论内容',
          icon: 'none'
        })
      }
      return
    }

    const newComment = {
      id: Date.now().toString(),
      user: '当前用户',
      avatar: '👤',
      content: commentText.trim(),
      rating: userRating,
      time: new Date().toLocaleString('zh-CN'),
      likes: 0
    }

    setComments(prev => {
      const newComments = [newComment, ...prev]
      saveCommentsToStorage(newComments)
      return newComments
    })
    setCommentText('')
    setUserRating(5)
    
    if (typeof Taro.showToast === 'function') {
      Taro.showToast({
        title: '评论发表成功！',
        icon: 'success'
      })
    }
  }

  // 点赞评论
  const likeComment = (commentId: string) => {
    setComments(prev => {
      const newComments = prev.map(comment => 
        comment.id === commentId 
          ? { ...comment, likes: comment.likes + 1 }
          : comment
      )
      saveCommentsToStorage(newComments)
      return newComments
    })
  }

  // 保存评论到本地存储
  const saveCommentsToStorage = (commentsToSave: typeof comments) => {
    if (!stationInfo) return
    
    try {
      const storageKey = `comments_${stationInfo._id}`
      const dataToSave = JSON.stringify(commentsToSave)
      
      if (typeof Taro.setStorageSync === 'function') {
        Taro.setStorageSync(storageKey, dataToSave)
      } else {
        localStorage.setItem(storageKey, dataToSave)
      }
    } catch (error) {
      // 忽略错误
    }
  }

  // 从本地存储加载评论
  const loadCommentsFromStorage = () => {
    if (!stationInfo) return
    
    try {
      const storageKey = `comments_${stationInfo._id}`
      let storedComments: string | null = null
      
      if (typeof Taro.getStorageSync === 'function') {
        storedComments = Taro.getStorageSync(storageKey)
      } else {
        storedComments = localStorage.getItem(storageKey)
      }
      
      if (storedComments) {
        const parsedComments = JSON.parse(storedComments)
        if (Array.isArray(parsedComments)) {
          setComments(parsedComments)
          return
        }
      }
      
      const stationId = stationInfo._id
      const initialComments = commentsData[stationId as keyof typeof commentsData] || []
      setComments(initialComments)
      
    } catch (error) {
      const stationId = stationInfo._id
      const initialComments = commentsData[stationId as keyof typeof commentsData] || []
      setComments(initialComments)
    }
  }

  useLoad(() => {
    let stationData = null
    
    try {
      if (typeof Taro.getStorageSync === 'function') {
        stationData = Taro.getStorageSync('selected_station')
      }
      
      if (!stationData) {
        try {
          const browserData = localStorage.getItem('selected_station')
          if (browserData) {
            stationData = JSON.parse(browserData)
          }
        } catch (browserError) {
          // 忽略错误
        }
      }
      
      if (stationData) {
        setStationInfo(stationData)
      } else {
        setStationInfo(mockStationData)
      }

      // 加载用户拍摄的照片
      try {
        let savedPhotos: string[] = []
        if (typeof Taro.getStorageSync === 'function') {
          savedPhotos = Taro.getStorageSync('user_photos') || []
        } else {
          const photosData = localStorage.getItem('user_photos')
          if (photosData) {
            savedPhotos = JSON.parse(photosData)
          }
        }
        
        if (Array.isArray(savedPhotos) && savedPhotos.length > 0) {
          const validPhotos = savedPhotos.filter(photo => 
            photo && typeof photo === 'string' && photo.length > 0
          );
          
          if (validPhotos.length !== savedPhotos.length) {
            if (typeof Taro.setStorageSync === 'function') {
              Taro.setStorageSync('user_photos', validPhotos);
            }
            localStorage.setItem('user_photos', JSON.stringify(validPhotos));
          }
          
          setUserPhotos(validPhotos)
        } else {
          setUserPhotos([])
        }
      } catch (photoError) {
        setUserPhotos([])
      }

      loadCommentsFromStorage()
    } catch (error) {
      setStationInfo(mockStationData)
    }
  })

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
      {/* 头部导航栏 */}
      <View className='header-navbar'>
        <View className='navbar-left' onClick={handleGoBack}>
          <Text className='back-icon'>‹</Text>
          <Text className='back-text'>返回</Text>
        </View>
        <View className='navbar-center'>
          <Text className='navbar-title'>充电站详情</Text>
        </View>
        <View className='navbar-right'>
          <View className='more-button'>
            <Text className='more-icon'>⋯</Text>
          </View>
          <View className='settings-button'>
            <Text className='settings-icon'>⚙</Text>
          </View>
        </View>
      </View>

      {/* 新手操作指引 */}
      <View className='new-user-guide'>
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
          <View className='banner-button'>
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
            <Text className='bind-link'>去绑定 {'>'}</Text>
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
            {/* 评分和评论 */}
            <View className='rating-section' onClick={openComments}>
              <View className='rating-info'>
                <View className='rating-score'>
                  <Text className='score'>{stationInfo.rating}</Text>
                  <Text className='score-unit'>分</Text>
                </View>
                <View className='rating-details'>
                  <Text className='rating-text'>用户评分</Text>
                  <Text className='review-count'>{stationInfo.reviewCount}条评论</Text>
                </View>
              </View>
              <View className='rating-stars'>
                {[1, 2, 3, 4, 5].map(star => (
                  <Text key={star} className={`star ${star <= Math.floor(stationInfo.rating) ? 'filled' : ''}`}>
                    {star <= Math.floor(stationInfo.rating) ? '⭐' : '☆'}
                  </Text>
                ))}
              </View>
              <View className='rating-arrow'>
                <Text className='arrow-icon'>›</Text>
              </View>
            </View>

            {/* 价格信息 */}
            <View className='pricing-info'>
              <View className='pricing-header'>
                <Text className='pricing-title'>价格信息</Text>
                <View className='price-tag'>实时价格</View>
              </View>
              
              <View className='current-period'>
                当前时段: {stationInfo.operatingHours.open}-{stationInfo.operatingHours.close}
              </View>
              
              <View className='price-breakdown'>
                <View className='price-item'>
                  <Text className='price-label'>电费:</Text>
                  <Text className='price-value'>¥{stationInfo.chargers[0]?.pricing.electricityFee || 0}/度</Text>
                </View>
                <View className='price-item'>
                  <Text className='price-label'>服务费:</Text>
                  <Text className='price-value'>¥{stationInfo.chargers[0]?.pricing.serviceFee || 0}/度</Text>
                </View>
                <View className='price-item total'>
                  <Text className='price-label'>总计:</Text>
                  <Text className='price-value'>¥{getTotalPrice()}/度</Text>
                </View>
              </View>
            </View>

            {/* 充电桩统计 */}
            <View className='charger-stats'>
              <View className='stats-header'>
                <Text className='stats-title'>充电桩统计</Text>
              </View>
              <View className='stats-grid'>
                <View className='stat-item'>
                  <Text className='stat-number'>{stationInfo.chargers.length}</Text>
                  <Text className='stat-label'>总数量</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-number'>{stationInfo.chargers.filter(c => c.type === 'fast').length}</Text>
                  <Text className='stat-label'>快充桩</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-number'>{stationInfo.chargers.filter(c => c.type === 'slow').length}</Text>
                  <Text className='stat-label'>慢充桩</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-number'>{stationInfo.chargers.filter(c => c.status === 'available').length}</Text>
                  <Text className='stat-label'>可用桩</Text>
                </View>
              </View>
            </View>

            {/* 服务特色 */}
            <View className='service-features'>
              <View className='features-header'>
                <Text className='features-title'>服务特色</Text>
              </View>
              <View className='features-list'>
                <View className='feature-item'>
                  <Text className='feature-icon'>🔋</Text>
                  <Text className='feature-text'>24小时营业</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🅿️</Text>
                  <Text className='feature-text'>免费停车</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>📱</Text>
                  <Text className='feature-text'>扫码充电</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>💳</Text>
                  <Text className='feature-text'>支持充电卡</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'terminals' && (
          <View className='tab-content terminals'>
            <View className='terminal-list'>
              {stationInfo.chargers.map((charger, index) => (
                <View key={charger.chargerId} className='terminal-item' onClick={() => handleSelectTerminal(charger, index)}>
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
        <View className='scan-charge-btn'>
          扫码充电
        </View>
      </View>

      {/* 地图选择器模态框 */}
      {showMapSelectorModal && mapSelectorData && (
        <View className='map-selector-modal'>
          <View className='modal-mask' onClick={closeMapSelector} />
          <View className='modal-content'>
            <View className='modal-header'>
              <Text className='modal-title'>选择地图应用</Text>
              <View className='modal-close' onClick={closeMapSelector}>
                <Text className='close-icon'>✕</Text>
              </View>
            </View>
            <View className='modal-body'>
              {mapSelectorData.maps.map((map) => (
                <View 
                  key={map.name}
                  className='map-option'
                  onClick={() => handleMapSelection(map)}
                >
                  <View className='map-icon'>
                    {map.name === '高德地图' && <Text className='icon-text'>🗺️</Text>}
                    {map.name === '百度地图' && <Text className='icon-text'>📍</Text>}
                    {map.name === '腾讯地图' && <Text className='icon-text'>🌐</Text>}
                  </View>
                  <Text className='map-name'>{map.name}</Text>
                  <View className='map-arrow'>
                    <Text className='arrow-icon'>›</Text>
                  </View>
                </View>
              ))}
            </View>
            <View className='modal-footer'>
              <View className='cancel-btn' onClick={closeMapSelector}>
                <Text className='cancel-text'>取消</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 评论区模态框 */}
      {showComments && (
        <View className='comments-modal'>
          <View className='modal-mask' onClick={closeComments} />
          <View className='modal-content'>
            <View className='modal-header'>
              <View className='back-btn' onClick={closeComments}>
                <Text className='back-icon'>‹</Text>
              </View>
              <Text className='modal-title'>用户评价</Text>
            </View>
            
            <View className='modal-body'>
              {/* 评论输入框 */}
              <View className='comment-input-section'>
                {/* 评分选择器 */}
                <View className='rating-selector'>
                  <Text className='rating-label'>请选择评分:</Text>
                  <View className='stars-container'>
                    {[1, 2, 3, 4, 5].map(star => (
                      <View
                        key={star}
                        className={`star-item ${star <= userRating ? 'selected' : ''}`}
                        onClick={() => setUserRating(star)}
                      >
                        <Text className='star-icon'>
                          {star <= userRating ? '⭐' : '☆'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text className='rating-text'>
                    {userRating === 1 && '很差'}
                    {userRating === 2 && '较差'}
                    {userRating === 3 && '一般'}
                    {userRating === 4 && '较好'}
                    {userRating === 5 && '很好'}
                  </Text>
                </View>
                
                <View className='input-wrapper'>
                  <input
                    className='comment-input'
                    type='text'
                    placeholder='写下您的评价...'
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={200}
                  />
                  <View className='input-counter'>
                    <Text className='counter-text'>{commentText.length}/200</Text>
                  </View>
                </View>
                <View className='submit-btn' onClick={submitComment}>
                  <Text className='submit-text'>发表</Text>
                </View>
              </View>

              {/* 评论列表 */}
              <View className='comments-list'>
                {comments.map((comment) => (
                  <View key={comment.id} className='comment-item'>
                    <View className='comment-header'>
                      <View className='user-info'>
                        <View className='user-avatar'>
                          <Text className='avatar-text'>{comment.avatar}</Text>
                        </View>
                        <View className='user-details'>
                          <Text className='user-name'>{comment.user}</Text>
                          <View className='comment-rating'>
                            {[1, 2, 3, 4, 5].map(star => (
                              <Text key={star} className={`star ${star <= comment.rating ? 'filled' : ''}`}>
                                {star <= comment.rating ? '⭐' : '☆'}
                              </Text>
                            ))}
                          </View>
                        </View>
                      </View>
                      <Text className='comment-time'>{comment.time}</Text>
                    </View>
                    
                    <View className='comment-content'>
                      <Text className='content-text'>{comment.content}</Text>
                    </View>
                    
                    <View className='comment-actions'>
                      <View className='like-btn' onClick={() => likeComment(comment.id)}>
                        <Text className='like-icon'>👍</Text>
                        <Text className='like-count'>{comment.likes}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
