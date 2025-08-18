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
  const [userPhotos, setUserPhotos] = useState<string[]>([])
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)

  // 处理返回功能
  const handleGoBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack()
      } else if (typeof Taro.switchTab === 'function') {
        Taro.switchTab({ url: '/pages/index/index' })
      } else {
        // 降级到浏览器导航
        window.history.back()
      }
    } catch (error) {
      console.error('返回失败:', error)
      // 最后的备选方案
      try {
        window.history.back()
      } catch (fallbackError) {
        console.error('备选返回方案也失败了:', fallbackError)
        // 如果都失败了，跳转到首页
        if (typeof Taro.switchTab === 'function') {
          Taro.switchTab({ url: '/pages/index/index' })
        } else {
          window.location.hash = '#/pages/index/index'
        }
      }
    }
  }

  // 处理更多操作
  const handleMoreOptions = () => {
    try {
      if (typeof Taro.showActionSheet === 'function') {
        Taro.showActionSheet({
          itemList: ['分享', '收藏', '举报', '联系客服'],
          success: (res) => {
            console.log('选择了操作:', res.tapIndex)
            // 根据选择执行相应操作
            switch (res.tapIndex) {
              case 0:
                handleShare()
                break
              case 1:
                handleFavorite()
                break
              case 2:
                handleReport()
                break
              case 3:
                handleContactService()
                break
            }
          }
        })
      } else {
        // 降级到浏览器显示
        const action = prompt('选择操作: 1-分享, 2-收藏, 3-举报, 4-联系客服')
        if (action) {
          const index = parseInt(action) - 1
          switch (index) {
            case 0:
              handleShare()
              break
            case 1:
              handleFavorite()
              break
            case 2:
              handleReport()
              break
            case 3:
              handleContactService()
              break
          }
        }
      }
    } catch (error) {
      console.error('显示操作菜单失败:', error)
    }
  }

  // 处理分享
  const handleShare = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '分享功能开发中',
          icon: 'none'
        })
      } else {
        alert('分享功能开发中')
      }
    } catch (error) {
      console.error('分享失败:', error)
    }
  }

  // 处理收藏
  const handleFavorite = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '收藏功能开发中',
          icon: 'none'
        })
      } else {
        alert('收藏功能开发中')
      }
    } catch (error) {
      console.error('收藏失败:', error)
    }
  }

  // 处理举报
  const handleReport = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '举报功能开发中',
          icon: 'none'
        })
      } else {
        alert('举报功能开发中')
      }
    } catch (error) {
      console.error('举报失败:', error)
    }
  }

  // 处理联系客服
  const handleContactService = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '客服热线: 0797-966999',
          icon: 'none',
          duration: 3000
        })
      } else {
        alert('客服热线: 0797-966999')
      }
    } catch (error) {
      console.error('联系客服失败:', error)
    }
  }

  // 处理设置
  const handleSettings = () => {
    try {
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '设置功能开发中',
          icon: 'none'
        })
      } else {
        alert('设置功能开发中')
      }
    } catch (error) {
      console.error('设置失败:', error)
    }
  }

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

      // 加载用户拍摄的照片
      try {
        let savedPhotos: string[] = []
        if (typeof Taro.getStorageSync === 'function') {
          savedPhotos = Taro.getStorageSync('user_photos') || []
          console.log('从Taro存储加载照片:', savedPhotos.length, '张')
        } else {
          const photosData = localStorage.getItem('user_photos')
          if (photosData) {
            savedPhotos = JSON.parse(photosData)
            console.log('从localStorage加载照片:', savedPhotos.length, '张')
          }
        }
        
        // 验证照片数据的有效性
        if (Array.isArray(savedPhotos) && savedPhotos.length > 0) {
          // 过滤掉无效的照片数据
          const validPhotos = savedPhotos.filter(photo => 
            photo && typeof photo === 'string' && photo.length > 0
          );
          
          if (validPhotos.length !== savedPhotos.length) {
            console.log('发现无效照片数据，已过滤:', {
              original: savedPhotos.length,
              valid: validPhotos.length
            });
            // 更新存储中的有效数据
            if (typeof Taro.setStorageSync === 'function') {
              Taro.setStorageSync('user_photos', validPhotos);
            }
            localStorage.setItem('user_photos', JSON.stringify(validPhotos));
          }
          
          setUserPhotos(validPhotos)
          console.log('用户照片加载成功:', validPhotos.length, '张')
        } else {
          console.log('没有找到用户照片数据')
          setUserPhotos([])
        }
      } catch (photoError) {
        console.error('加载用户照片失败:', photoError)
        setUserPhotos([])
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

  // 处理拍照功能
  const handleTakePhoto = async () => {
    if (isTakingPhoto) return
    
    setIsTakingPhoto(true)
    
    try {
      // 尝试使用Taro拍照API
      if (typeof Taro.chooseImage === 'function') {
        const result = await Taro.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['camera']
        })
        
        if (result.tempFilePaths && result.tempFilePaths.length > 0) {
          const newPhoto = result.tempFilePaths[0]
          setUserPhotos(prev => [...prev, newPhoto])
          
          // 保存到存储
          try {
            if (typeof Taro.setStorageSync === 'function') {
              Taro.setStorageSync('user_photos', [...userPhotos, newPhoto])
            } else {
              localStorage.setItem('user_photos', JSON.stringify([...userPhotos, newPhoto]))
            }
          } catch (storageError) {
            console.error('保存照片失败:', storageError)
          }
          
          // 显示成功提示
          if (typeof Taro.showToast === 'function') {
            Taro.showToast({
              title: '拍照成功！',
              icon: 'success'
            })
          } else {
            alert('拍照成功！')
          }
        }
      } else {
        // 降级到浏览器拍照（需要用户手动选择文件）
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.capture = 'camera'
        
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const photoData = e.target?.result as string
              setUserPhotos(prev => [...prev, photoData])
              
              // 保存到存储
              try {
                localStorage.setItem('user_photos', JSON.stringify([...userPhotos, photoData]))
              } catch (storageError) {
                console.error('保存照片失败:', storageError)
              }
            }
            reader.readAsDataURL(file)
          }
        }
        
        input.click()
      }
    } catch (error) {
      console.error('拍照失败:', error)
      
      // 显示错误提示
      if (typeof Taro.showToast === 'function') {
        Taro.showToast({
          title: '拍照失败，请重试',
          icon: 'error'
        })
      } else {
        alert('拍照失败，请重试')
      }
    } finally {
      setIsTakingPhoto(false)
    }
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
          <View className='more-button' onClick={handleMoreOptions}>
            <Text className='more-icon'>⋯</Text>
          </View>
          <View className='settings-button' onClick={handleSettings}>
            <Text className='settings-icon'>⚙</Text>
          </View>
        </View>
      </View>

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
            {/* 充电站图片展示 */}
            <View className='station-images'>
              <View className='main-image' onClick={handleTakePhoto}>
                {userPhotos.length > 0 ? (
                  <View className='user-photo-display'>
                    <img 
                      src={userPhotos[userPhotos.length - 1]} 
                      alt="用户拍摄的照片"
                      className='user-photo'
                    />
                    <View className='photo-overlay'>
                      <Text className='photo-text'>点击重新拍照</Text>
                    </View>
                  </View>
                ) : (
                  <View className='image-placeholder'>
                    <Text className='image-icon'>📷</Text>
                    <Text className='image-text'>点击拍照</Text>
                    <Text className='photo-hint'>记录充电站实况</Text>
                  </View>
                )}
                {isTakingPhoto && (
                  <View className='photo-loading'>
                    <Text className='loading-icon'>⏳</Text>
                    <Text className='loading-text'>拍照中...</Text>
                  </View>
                )}
              </View>
              
              <View className='image-gallery'>
                {/* 显示用户拍摄的照片 */}
                {userPhotos.slice(-3).map((photo, index) => (
                  <View key={`user-${index}`} className='gallery-item'>
                    <img 
                      src={photo} 
                      alt={`用户照片${index + 1}`}
                      className='user-gallery-photo'
                    />
                    <View className='photo-remove' onClick={() => {
                      // 修复：找到照片在原始数组中的真实索引
                      const realIndex = userPhotos.indexOf(photo);
                      
                      if (realIndex === -1) {
                        console.error('未找到要删除的照片:', photo.substring(0, 50));
                        return;
                      }
                      
                      const newPhotos = userPhotos.filter((_, i) => i !== realIndex);
                      
                      console.log('删除照片:', {
                        galleryIndex: index,
                        realIndex: realIndex,
                        totalPhotos: userPhotos.length,
                        newTotal: newPhotos.length,
                        deletedPhoto: photo.substring(0, 50) + '...'
                      });
                      
                      // 立即更新状态
                      setUserPhotos(newPhotos);
                      
                      // 强制刷新界面
                      setTimeout(() => {
                        setUserPhotos(prev => [...prev]);
                      }, 50);
                      
                      // 同步更新存储
                      try {
                        if (typeof Taro.setStorageSync === 'function') {
                          Taro.setStorageSync('user_photos', newPhotos);
                          console.log('Taro存储已更新:', newPhotos.length, '张照片');
                        }
                        localStorage.setItem('user_photos', JSON.stringify(newPhotos));
                        console.log('localStorage已更新:', newPhotos.length, '张照片');
                        console.log('照片删除成功，存储已同步');
                      } catch (error) {
                        console.error('更新照片存储失败:', error);
                      }
                    }}>
                      <Text className='remove-icon'>❌</Text>
                    </View>
                  </View>
                ))}
                {/* 如果用户照片不足3张，显示占位符 */}
                {userPhotos.length < 3 && Array.from({ length: 3 - userPhotos.length }).map((_, index) => (
                  <View key={`placeholder-${index}`} className='gallery-item'>
                    <View className='image-placeholder small' onClick={handleTakePhoto}>
                      <Text className='image-icon'>📷</Text>
                      <Text className='add-photo-text'>添加</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 评分和评论 */}
            <View className='rating-section'>
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
