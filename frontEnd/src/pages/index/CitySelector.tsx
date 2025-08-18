import { View, Text } from '@tarojs/components'
import { useEffect, useState, useRef } from 'react'
import Taro from '@tarojs/taro'
import AMapLoader from '@amap/amap-jsapi-loader'
import { hotCities, cityCategories, searchCities } from '../../utils/cityData'
import './CitySelector.scss'

interface CitySelectorProps {
  currentCity: string
  onCityChange: (city: string) => void
  onClose: () => void
}

// 安全 Toast 调用
function showToast(params: { title: string; icon?: 'none' | 'success' | 'error'; duration?: number }) {
  try {
    if (typeof Taro?.showToast === 'function') return Taro.showToast(params)
  } catch {}
  console.warn('[Toast]', params.title)
}

export default function CitySelector({ currentCity, onCityChange, onClose }: CitySelectorProps) {
  const [searchText, setSearchText] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [locationInfo, setLocationInfo] = useState<{
    city: string
    province: string
    district: string
    address: string
    coordinates?: [number, number] // 添加坐标信息
  } | null>(null)
  const geocoderRef = useRef<any>(null)

  // 城市分类数据（按拼音首字母）
  // const cityCategories = {
  //   'A': ['安庆市', '安阳市', '鞍山市', '安康市'],
  //   'B': ['北京市', '保定市', '包头市', '蚌埠市', '本溪市'],
  //   'C': ['成都市', '重庆市', '长沙市', '常州市', '承德市'],
  //   'D': ['大连市', '东莞市', '大同市', '丹东市'],
  //   'E': ['鄂尔多斯市'],
  //   'F': ['福州市', '佛山市', '抚顺市'],
  //   'G': ['广州市', '贵阳市', '桂林市', '赣州市'],
  //   'H': ['杭州市', '哈尔滨市', '合肥市', '海口市', '邯郸市'],
  //   'J': ['济南市', '金华市', '嘉兴市', '江门市'],
  //   'K': ['昆明市', '开封市'],
  //   'L': ['兰州市', '洛阳市', '连云港市', '廊坊市'],
  //   'M': ['绵阳市', '马鞍山市'],
  //   'N': ['南京市', '宁波市', '南昌市', '南宁市'],
  //   'Q': ['青岛市', '泉州市', '秦皇岛市'],
  //   'S': ['上海市', '深圳市', '苏州市', '沈阳市', '石家庄市'],
  //   'T': ['天津市', '太原市', '唐山市', '台州市'],
  //   'W': ['武汉市', '无锡市', '温州市', '威海市'],
  //   'X': ['西安市', '厦门市', '徐州市', '襄阳市'],
  //   'Y': ['银川市', '烟台市', '扬州市', '盐城市'],
  //   'Z': ['郑州市', '珠海市', '中山市', '淄博市']
  // }

  // 初始化高德地图API
  useEffect(() => {
    // @ts-ignore
    if (process.env.TARO_ENV !== 'h5') return

    // @ts-ignore
    window._AMapSecurityConfig = { securityJsCode: '88a533ed5eb157250debf50883ccbe61' }

    AMapLoader.load({
      key: 'fe211b3e07c4e9b86b16adfd57925547',
      version: '2.0',
      plugins: ['AMap.Geocoder']
    }).then((AMap) => {
      // 初始化地理编码器
      geocoderRef.current = new AMap.Geocoder({
        radius: 1000,
        extensions: 'all'
      })
    }).catch((error) => {
      console.error('高德地图加载失败:', error)
    })
  }, [])

  const handleCitySelect = (city: string) => {
    onCityChange(city)
    onClose()
  }

  // GPS定位获取当前城市
  const getCurrentLocation = () => {
    if (isLocating) return
    
    setIsLocating(true)
    showToast({ title: '正在定位...', icon: 'none' })
    
    // H5环境浏览器定位
    if (!navigator.geolocation) {
      showToast({ title: '浏览器不支持定位', icon: 'none' })
      setIsLocating(false)
      return
    }

    const options = {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 600000
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        
        // 使用高德地图逆地理编码获取城市信息
        if (geocoderRef.current) {
          geocoderRef.current.getAddress([longitude, latitude], (status: string, result: any) => {
            setIsLocating(false)
            
            if (status === 'complete' && result?.regeocode) {
              const regeocode = result.regeocode
              const addressComponent = regeocode.addressComponent
              
              const cityInfo = {
                city: addressComponent.city || addressComponent.province || '未知城市',
                province: addressComponent.province || '未知省份',
                district: addressComponent.district || '未知区域',
                address: regeocode.formattedAddress,
                coordinates: [longitude, latitude] as [number, number] // 保存坐标信息
              }
              
              setLocationInfo(cityInfo)
              showToast({ title: `定位成功：${cityInfo.city}`, icon: 'success' })
              
              // 自动选择定位到的城市
              if (cityInfo.city && cityInfo.city !== '未知城市') {
                onCityChange(cityInfo.city)
                
                // 保存定位信息到存储，供地图页面使用
                try {
                  const locationData = {
                    lng: longitude,
                    lat: latitude,
                    city: cityInfo.city,
                    address: cityInfo.address,
                    province: cityInfo.province,
                    district: cityInfo.district
                  }
                  
                  if (typeof Taro.setStorageSync === 'function') {
                    Taro.setStorageSync('current_location', locationData)
                    console.log('定位信息已保存到Taro存储:', locationData)
                  } else {
                    localStorage.setItem('current_location', JSON.stringify(locationData))
                    console.log('定位信息已保存到localStorage:', locationData)
                  }
                } catch (storageError) {
                  console.error('保存定位信息失败:', storageError)
                }
              }
            } else {
              showToast({ title: '获取城市信息失败', icon: 'none' })
            }
          })
        } else {
          setIsLocating(false)
          showToast({ title: '地图服务未就绪', icon: 'none' })
        }
      },
      (error) => {
        setIsLocating(false)
        let errorMessage = '定位失败'
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '定位权限被拒绝'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = '位置信息不可用'
            break
          case error.TIMEOUT:
            errorMessage = '定位超时'
            break
        }
        
        showToast({ title: errorMessage, icon: 'none' })
      },
      options
    )
  }

  // 搜索输入处理
  const handleSearchInput = (e: any) => {
    setSearchText(e?.target?.value || '')
  }

  // 过滤城市（搜索功能）
  const getFilteredCities = () => {
    if (!searchText.trim()) return cityCategories
    
    const filtered: Partial<typeof cityCategories> = {}
    const searchResults = searchCities(searchText)
    
    // 根据搜索结果重新组织分类
    Object.keys(cityCategories).forEach(letter => {
      const cities = cityCategories[letter as keyof typeof cityCategories].filter(city =>
        searchResults.includes(city)
      )
      if (cities.length > 0) {
        filtered[letter as keyof typeof cityCategories] = cities
      }
    })
    
    return filtered
  }

  const filteredCities = getFilteredCities()

  return (
    <View className='city-selector-overlay'>
      <View className='city-selector'>
        <View className='city-header'>
          <View className='back-btn' onClick={onClose}>
            <Text>‹</Text>
          </View>
          <Text className='title'>选择城市</Text>
        </View>

        {/* 搜索栏 */}
        <View className='search-section'>
          <View className='search-bar'>
            <Text className='search-icon'>🔍</Text>
            <input
              value={searchText}
              onChange={handleSearchInput}
              placeholder='搜索城市名或拼音'
              className='search-input'
            />
          </View>
        </View>

        {/* 当前城市和重新定位 */}
        <View className='current-section'>
          <Text className='section-title'>当前城市: {currentCity}</Text>
          <View
            className={`location-btn ${isLocating ? 'locating' : ''}`}
            onClick={getCurrentLocation}
          >
            <Text className='location-icon'>📍</Text>
            <Text className='location-text'>
              {isLocating ? '定位中...' : '重新定位'}
            </Text>
          </View>
        </View>

        {/* 定位信息显示 */}
        {locationInfo && (
          <View className='location-info'>
            <Text className='location-city'>{locationInfo.city}</Text>
            <Text className='location-address'>{locationInfo.address}</Text>
            {locationInfo.coordinates && (
              <View className='location-coordinates'>
                <Text className='coordinates-text'>
                  坐标: {locationInfo.coordinates[0].toFixed(6)}, {locationInfo.coordinates[1].toFixed(6)}
                </Text>
                <View 
                  className='view-map-btn'
                  onClick={() => {
                    // 跳转到地图页面查看当前位置
                    try {
                      const mapData = {
                        lng: locationInfo.coordinates![0],
                        lat: locationInfo.coordinates![1]
                      }
                      const locationData = {
                        name: locationInfo.city,
                        address: locationInfo.address,
                        distance: 0,
                        rating: 0
                      }
                      
                      if (typeof Taro.setStorageSync === 'function') {
                        Taro.setStorageSync('map_target_coord', mapData)
                        Taro.setStorageSync('map_target_station', locationData)
                        console.log('地图数据已保存到Taro存储')
                      } else {
                        localStorage.setItem('map_target_coord', JSON.stringify(mapData))
                        localStorage.setItem('map_target_station', JSON.stringify(locationData))
                        console.log('地图数据已保存到localStorage')
                      }
                      
                      if (typeof Taro.navigateTo === 'function') {
                        Taro.navigateTo({ url: '/pages/map/index' })
                      } else {
                        window.location.hash = '#/pages/map/index'
                      }
                    } catch (error) {
                      console.error('跳转到地图失败:', error)
                    }
                  }}
                >
                  <Text className='map-btn-text'>查看地图</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View className='content'>
          {/* 热门城市 */}
          <View className='hot-cities-section'>
            <Text className='section-title'>热门城市</Text>
            <View className='hot-cities-grid'>
              {hotCities.map((city) => (
                <View
                  key={city}
                  className={`hot-city-item ${city === currentCity ? 'active' : ''}`}
                  onClick={() => handleCitySelect(city)}
                >
                  <Text>{city}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 城市列表（按字母分类） */}
          <View className='cities-section'>
            {/* 字母索引 */}
            <View className='alphabet-index'>
              {Object.keys(filteredCities).map((letter) => (
                <View key={letter} className='alphabet-item'>
                  <Text>{letter}</Text>
                </View>
              ))}
            </View>

            {/* 城市分组列表 */}
            <View className='city-groups'>
              {Object.entries(filteredCities).map(([letter, cities]) => (
                <View key={letter} className='city-group'>
                  <View className='group-header'>
                    <Text className='group-letter'>{letter}</Text>
                  </View>
                  <View className='group-cities'>
                    {(cities || []).map((city) => (
                      <View
                        key={city}
                        className={`city-item ${city === currentCity ? 'active' : ''}`}
                        onClick={() => handleCitySelect(city)}
                      >
                        <Text>{city}</Text>
                        {city === currentCity && <Text className='check'>✓</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  )
} 