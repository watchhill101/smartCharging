import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import AMapLoader from '@amap/amap-jsapi-loader'
import './device.scss'
import { showToast } from '../utils/toast'

interface DeviceProps {
  onBack?: () => void
  initialCoord?: { lng: number; lat: number }
  stationInfo?: {
    name: string
    address: string
    distance?: number
    rating?: number
  }
}

// 安全 Toast 调用
function showToast(params: { title: string; icon?: 'none' | 'success' | 'error'; duration?: number }) {
  try {
    if (typeof Taro?.showToast === 'function') return showToast(params)
  } catch {}
  console.warn('[Toast]', params.title)
}

export default function Device(props: DeviceProps) {
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)
  const placeSearchRef = useRef<any>(null)
  const mapClickHandlerRef = useRef<any>(null)

  const [searchText, setSearchText] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [locationInfo, setLocationInfo] = useState<{
    name: string
    address: string
    coord: { lng: number; lat: number }
  } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // 初始化高德地图
  useEffect(() => {
    // @ts-ignore
    if (process.env.TARO_ENV !== 'h5') return

    // @ts-ignore
    window._AMapSecurityConfig = { securityJsCode: '88a533ed5eb157250debf50883ccbe61' }

    let destroyed = false

    AMapLoader.load({
      key: 'fe211b3e07c4e9b86b16adfd57925547',
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.PlaceSearch', 'AMap.Geolocation']
    }).then((AMap) => {
      if (destroyed) return
      
      // 创建地图实例，显示详细街道信息
      const map = new AMap.Map('map-container', {
        zoom: 16,
        viewMode: '3D',
        showLabel: true,
        lang: 'zh_cn',
        features: ['bg', 'road', 'point', 'building'],
        mapStyle: 'amap://styles/normal',
        center: props.initialCoord ? [props.initialCoord.lng, props.initialCoord.lat] : [115.480656, 38.877012]
      })
      mapRef.current = map

      // 初始化地理编码器
      geocoderRef.current = new AMap.Geocoder({
        radius: 1000,
        extensions: 'all'
      })

      // 初始化地点搜索
      placeSearchRef.current = new AMap.PlaceSearch({
        city: '全国',
        pageSize: 1
      })


      // 地图点击事件：点击即将该点设为“我的位置”
      mapClickHandlerRef.current = (e: any) => {
        const { lnglat } = e
        if (lnglat) {
          addRedMarker(lnglat.lng, lnglat.lat, '我的位置')
          showToast({ title: '已设置为我的位置', icon: 'success' })
        }
      }
      map.on('click', mapClickHandlerRef.current)

      // 如果有初始坐标，添加标记
      if (props.initialCoord) {
        const title = props.stationInfo?.name || '目标位置'
        addRedMarker(props.initialCoord.lng, props.initialCoord.lat, title)
      } else {
        // 没有初始坐标时，自动获取当前位置
        getCurrentLocation()
      }
    })

    return () => {
      destroyed = true
      if (mapRef.current) {
        if (mapClickHandlerRef.current) {
          // 解绑点击事件
          try { mapRef.current.off('click', mapClickHandlerRef.current) } catch {}
          mapClickHandlerRef.current = null
        }
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  // 添加红色标记 - 使用HTML DOM元素确保显示
  const addRedMarker = (lng: number, lat: number, title: string = '') => {
    if (!mapRef.current) return

    // 移除旧标记
    if (markerRef.current) {
      mapRef.current.remove(markerRef.current)
    }

    // 创建红色标记DOM元素 - 移动端优化
    const markerContent = document.createElement('div')
    markerContent.style.cssText = `
      width: 36px;
      height: 50px;
      background: transparent;
      position: relative;
      cursor: pointer;
      transform: scale(1.1);
    `
    markerContent.innerHTML = `
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #FF4444, #CC3333);
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 4px 12px rgba(255,68,68,0.4);
      "></div>
      <div style="
        position: absolute;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 14px solid #FF4444;
        filter: drop-shadow(0 3px 6px rgba(255,68,68,0.3));
      "></div>
      <div style="
        position: absolute;
        top: 10px;
        left: 10px;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      "></div>
    `

    // @ts-ignore
    markerRef.current = new (window as any).AMap.Marker({
      position: [lng, lat],
      content: markerContent,
      title: title,
      anchor: 'bottom-center'
    })

    mapRef.current.add(markerRef.current)
    mapRef.current.setCenter([lng, lat])
    mapRef.current.setZoom(18)

    // 获取地址信息
    if (geocoderRef.current) {
      geocoderRef.current.getAddress([lng, lat], (status: string, result: any) => {
        if (status === 'complete' && result?.regeocode) {
          const regeocode = result.regeocode
          setLocationInfo({
            name: title || regeocode.addressComponent?.building || regeocode.addressComponent?.neighborhood || '未知位置',
            address: regeocode.formattedAddress,
            coord: { lng, lat }
          })
        }
      })
    }
  }

  // 根据地名搜索定位
  const searchByPlaceName = async () => {
    if (!searchText.trim() || !placeSearchRef.current) {
      showToast({ title: '请输入地名', icon: 'none' })
      return
    }

    setIsSearching(true)
    
    placeSearchRef.current.search(searchText.trim(), (status: string, result: any) => {
      setIsSearching(false)
      
      if (status === 'complete' && result?.poiList?.pois?.length > 0) {
        const poi = result.poiList.pois[0]
        const location = poi.location
        
        if (location) {
          addRedMarker(location.lng, location.lat, poi.name)
          showToast({ title: '定位成功', icon: 'success' })
        } else {
          showToast({ title: '未找到精确位置', icon: 'none' })
        }
      } else {
        showToast({ title: '未找到该地点', icon: 'none' })
      }
    })
  }

  // 获取当前位置 - H5环境优化
  const getCurrentLocation = () => {
    if (isGettingLocation) return
    
    setIsGettingLocation(true)
    showToast({ title: '正在获取位置...', icon: 'none' })
    
    // H5环境检测
    console.log('[定位] H5环境定位开始...')
    console.log('[定位] 当前URL:', window.location.href)
    console.log('[定位] 是否HTTPS:', window.location.protocol === 'https:')
    console.log('[定位] User Agent:', navigator.userAgent)
    console.log('[定位] 网络状态:', navigator.onLine ? '在线' : '离线')
    console.log('[定位] 平台:', navigator.platform)
    console.log('[定位] 语言:', navigator.language)
    
    // H5环境特殊检查
    const h5EnvironmentCheck = () => {
      const issues: string[] = []
      
      // H5环境必须HTTPS（除了localhost）
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        issues.push('H5环境需要HTTPS')
        console.error('[定位] H5环境错误: 非HTTPS环境，定位将被阻止')
      }
      
      // 检查网络连接
      if (!navigator.onLine) {
        issues.push('网络离线')
        console.error('[定位] H5环境错误: 网络离线')
      }
      
      // 检查定位API支持
      if (!navigator.geolocation) {
        issues.push('浏览器不支持定位')
        console.error('[定位] H5环境错误: 浏览器不支持定位API')
      }
      
      // 检查是否在移动设备上
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      if (!isMobile) {
        console.log('[定位] 桌面环境，定位可能不准确')
      }
      
      if (issues.length > 0) {
        console.warn('[定位] H5环境问题:', issues.join(', '))
        showToast({ title: `H5环境问题: ${issues[0]}`, icon: 'none' })
        return false
      }
      
      return true
    }
    
    if (!h5EnvironmentCheck()) {
      console.log('[定位] H5环境检测失败，尝试继续定位...')
    }
    
    // 检查权限状态
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        console.log('[定位] H5权限状态:', result.state)
        if (result.state === 'denied') {
          showToast({ title: 'H5定位权限被拒绝，请在浏览器设置中允许', icon: 'none' })
          setIsGettingLocation(false)
          setDefaultLocation()
          return
        } else if (result.state === 'prompt') {
          console.log('[定位] H5需要用户授权定位权限')
        }
      }).catch(() => {
        console.log('[定位] H5无法查询权限状态')
      })
    }

    // H5环境优先使用浏览器原生定位
    tryH5BrowserLocation()
  }

  // H5环境浏览器定位
  const tryH5BrowserLocation = () => {
    if (!navigator.geolocation) {
      console.log('[定位] 浏览器不支持定位')
      showToast({ title: '浏览器不支持定位', icon: 'none' })
      setDefaultLocation()
      return
    }

    // 检查环境
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.log('[定位] 非HTTPS环境，定位可能失败')
      showToast({ title: '需要HTTPS环境才能定位', icon: 'none' })
    }

    const options = {
      enableHighAccuracy: false, // 降低精度要求，提高成功率
      timeout: 30000, // 30秒超时
      maximumAge: 600000 // 10分钟内缓存的位置
    }

    console.log('[定位] 尝试浏览器原生定位...')
    console.log('[定位] 定位选项:', options)
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGettingLocation(false)
        console.log('[定位] 浏览器定位成功:', position)
        
        const { latitude, longitude, accuracy } = position.coords
        console.log('[定位] 原始坐标:', { latitude, longitude, accuracy })
        
        // 检查坐标有效性
        if (latitude === 0 && longitude === 0) {
          console.log('[定位] 坐标无效（0,0），可能是默认值')
          showToast({ title: '获取到无效坐标，尝试其他方式', icon: 'none' })
          tryTaroLocation()
          return
        }
        
        // 尝试坐标转换
        convertAndSetLocation(longitude, latitude, '我的位置')
      },
      (error) => {
        setIsGettingLocation(false)
        console.error('[定位] 浏览器定位失败:', error)
        
        let errorMessage = '定位失败'
        let errorDetail = ''
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '定位权限被拒绝'
            errorDetail = '请在浏览器设置中允许定位权限，或点击地址栏左侧的定位图标'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置信息不可用'
            errorDetail = '请检查GPS是否开启，或移动到信号更好的地方'
            break
          case error.TIMEOUT:
            errorMessage = '定位超时'
            errorDetail = '网络连接可能较慢，请检查网络设置'
            break
          default:
            errorMessage = '定位失败'
            errorDetail = '未知错误，请稍后重试'
        }
        
        console.log('[定位] 错误详情:', errorDetail)
        showToast({ title: errorMessage, icon: 'none' })
        
        // 显示详细错误信息
        setTimeout(() => {
          showToast({ title: errorDetail, icon: 'none', duration: 3000 })
        }, 1000)
        
        // H5环境浏览器定位失败，尝试Taro定位
        setTimeout(() => {
          tryTaroLocation()
        }, 2000)
      },
      options
    )
  }

  // Taro定位
  const tryTaroLocation = () => {
    const getLocation = (...args: any[]) => (Taro as any).getLocation?.(...args)
    
    if (typeof getLocation !== 'function') {
      console.log('[定位] Taro定位不可用')
      setDefaultLocation()
      return
    }

    console.log('[定位] 尝试Taro定位...')
    
    getLocation({
      type: 'gcj02',
      isHighAccuracy: false,
      highAccuracyExpireTime: 20000,
      success: (res: any) => {
        setIsGettingLocation(false)
        console.log('[定位] Taro定位成功:', res)
        
        if (res.longitude && res.latitude) {
          addRedMarker(res.longitude, res.latitude, '我的位置')
          showToast({ title: '定位成功', icon: 'success' })
        } else {
          console.log('[定位] Taro定位数据异常')
          setDefaultLocation()
        }
      },
      fail: (err: any) => {
        setIsGettingLocation(false)
        console.error('[定位] Taro定位失败:', err)
        setDefaultLocation()
      }
    })
  }

  // 坐标转换并设置位置
  const convertAndSetLocation = (lng: number, lat: number, title: string) => {
    // @ts-ignore
    if (window.AMap && window.AMap.convertFrom) {
      console.log('[定位] 尝试坐标转换...')
      // @ts-ignore
      window.AMap.convertFrom([lng, lat], 'gps', (status: string, result: any) => {
        if (status === 'complete' && result.locations && result.locations.length > 0) {
          const converted = result.locations[0]
          console.log('[定位] 坐标转换成功:', converted)
          addRedMarker(converted.lng, converted.lat, title)
          showToast({ title: '定位成功', icon: 'success' })
        } else {
          console.log('[定位] 坐标转换失败，使用原始坐标')
          addRedMarker(lng, lat, title)
          showToast({ title: '定位成功', icon: 'success' })
        }
      })
    } else {
      console.log('[定位] 无转换功能，使用原始坐标')
      addRedMarker(lng, lat, title)
      showToast({ title: '定位成功', icon: 'success' })
    }
  }

  // 设置默认位置的统一函数
  const setDefaultLocation = () => {
    addRedMarker(115.480656, 38.877012, '默认位置')
    showToast({ title: '已设置默认位置（保定）', icon: 'none' })
  }



  // 处理搜索输入
  const handleSearchInput = (e: any) => {
    setSearchText(e?.target?.value || '')
  }

  // 处理回车搜索
  const handleKeyPress = (e: any) => {
    if (e.key === 'Enter') {
      searchByPlaceName()
    }
  }

  return (
    <View className='map-page' style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: '#f5f5f5'
    }}>


      {/* 搜索栏 */}
      <View style={{
        padding: '12px 16px 12px 32px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        zIndex: 9
      }}>
        <View style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <View style={{
            flex: 1,
            height: '34px',
            background: '#f8f9fa',
            borderRadius: '17px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px 0 18px',
            border: '1px solid #e9ecef'
          }}>
            <Text style={{ fontSize: '14px', color: '#999', marginRight: '6px' }}>🔍</Text>
            <input
              value={searchText}
              onChange={handleSearchInput}
              onKeyPress={handleKeyPress}
              placeholder='输入地名、地址或POI'
              style={{
                flex: 1,
                height: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                color: '#333'
              }}
            />
          </View>
          <View
            onClick={searchByPlaceName}
            style={{
              height: '34px',
              padding: '0 12px',
              background: isSearching ? '#d6d6d6' : '#007bff',
              color: '#fff',
              borderRadius: '17px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSearching ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              minWidth: '50px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,123,255,0.2)',
              flexShrink: 0
            }}
          >
            {isSearching ? '搜索' : '搜索'}
          </View>
          <View
            onClick={getCurrentLocation}
            style={{
              width: '34px',
              height: '34px',
              background: isGettingLocation ? '#d6d6d6' : '#28a745',
              color: '#fff',
              borderRadius: '17px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isGettingLocation ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(40,167,69,0.2)',
              flexShrink: 0
            }}
          >
            📍
          </View>
        </View>
      </View>

      {/* 充电站信息展示 */}
      {props.stationInfo && (
        <View style={{
          padding: '16px',
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          zIndex: 8,
          margin: '0 8px',
          borderRadius: '12px',
          marginBottom: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <View style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <View style={{
              width: '12px',
              height: '12px',
              background: '#4caf50',
              borderRadius: '50%',
              marginRight: '10px'
            }} />
            <Text style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
              🔌 充电站信息
            </Text>
          </View>
          <Text style={{ fontSize: '15px', fontWeight: '500', color: '#333', marginBottom: '6px', lineHeight: '1.4' }}>
            {props.stationInfo.name}
          </Text>
          <Text style={{ fontSize: '13px', color: '#666', marginBottom: '6px', lineHeight: '1.4' }}>
            📍 {props.stationInfo.address}
          </Text>
          {props.stationInfo.distance && (
            <Text style={{ fontSize: '13px', color: '#4caf50', marginBottom: '4px' }}>
              📏 距离: {(props.stationInfo.distance / 1000).toFixed(2)}km
            </Text>
          )}
          {props.stationInfo.rating && (
            <Text style={{ fontSize: '13px', color: '#ff9800' }}>
              ⭐ 评分: {props.stationInfo.rating.toFixed(1)}
            </Text>
          )}
        </View>
      )}

      {/* 位置信息展示 */}
      {locationInfo && (
        <View style={{
          padding: '12px',
          background: '#fff',
          borderBottom: '1px solid #e8e8e8',
          zIndex: 8,
          margin: '0 8px',
          borderRadius: '12px',
          marginBottom: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <View style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
            <View style={{
              width: '8px',
              height: '8px',
              background: '#ff4444',
              borderRadius: '50%',
              marginRight: '8px'
            }} />
            <Text style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>
              我的位置
            </Text>
          </View>
          <Text style={{ fontSize: '13px', color: '#666', marginBottom: '4px', lineHeight: '1.4' }}>
            {locationInfo.address}
          </Text>
          <Text style={{ fontSize: '11px', color: '#999' }}>
            {locationInfo.coord.lng.toFixed(6)}, {locationInfo.coord.lat.toFixed(6)}
          </Text>
        </View>
      )}

      {/* 地图容器 */}
      <View style={{ flex: 1, position: 'relative', margin: '0 8px', marginBottom: '8px' }}>
        <View 
          id='map-container' 
          style={{ 
            width: '100%', 
            height: '100%',
            background: '#f5f5f5',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }} 
        />
      </View>
    </View>
  )
} 