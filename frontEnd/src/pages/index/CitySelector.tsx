import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useRef } from 'react'
import Taro from '@tarojs/taro'
// 兼容导入（避免某些打包器的 default/cjs 差异）
const getLocation = (...args: any[]) => (Taro as any).getLocation?.(...args)
import './CitySelector.scss'

interface CitySelectorProps {
  currentCity: string
  onCityChange: (city: string) => void
  onClose: () => void
}

export default function CitySelector({ currentCity, onCityChange, onClose }: CitySelectorProps) {
  const [searchText, setSearchText] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const locateTimeoutRef = useRef<number | null>(null)

  const hotCities = [
    '北京市', '上海市', '南京市', '苏州市',
    '杭州市', '郑州市', '武汉市', '长沙市',
    '广州市', '深圳市', '重庆市', '成都市'
  ]

  const cityData = {
    'A': ['阿拉善盟', '鞍山市', '安庆市', '安阳市', '阿坝藏族羌族自治州', '安顺市', '阿里地区', '安康市', '阿克苏地区', '阿勒泰地区'],
    'B': ['保定市', '北京市', '包头市', '宝鸡市', '蚌埠市', '本溪市', '白山市', '白城市', '巴中市', '百色市'],
    'C': ['成都市', '重庆市', '长沙市', '长春市', '常州市', '成都市', '承德市', '沧州市', '长治市', '赤峰市'],
    'D': ['大连市', '东莞市', '大庆市', '德阳市', '东营市', '大同市', '丹东市', '大庆市', '德州市', '大理白族自治州'],
    'E': ['鄂尔多斯市', '恩施土家族苗族自治州'],
    'F': ['佛山市', '福州市', '抚顺市', '阜新市', '阜阳市', '抚州市', '防城港市'],
    'G': ['广州市', '贵阳市', '桂林市', '赣州市', '广元市', '广安市', '贵港市'],
    'H': ['杭州市', '合肥市', '哈尔滨市', '惠州市', '海口市', '呼和浩特市', '邯郸市', '衡水市', '黄山市', '黄石市'],
    'J': ['济南市', '嘉兴市', '金华市', '江门市', '揭阳市', '焦作市', '济宁市', '晋中市', '晋城市', '锦州市'],
    'K': ['昆明市', '开封市', '克拉玛依市', '喀什地区'],
    'L': ['廊坊市', '洛阳市', '兰州市', '临沂市', '柳州市', '泸州市', '乐山市', '丽江市', '临沧市', '六盘水市'],
    'M': ['绵阳市', '茂名市', '梅州市', '牡丹江市', '马鞍山市', '眉山市'],
    'N': ['南京市', '宁波市', '南昌市', '南宁市', '南通市', '南充市', '内江市', '宁德市', '南平市'],
    'P': ['莆田市', '濮阳市', '盘锦市', '平顶山市', '萍乡市'],
    'Q': ['青岛市', '泉州市', '齐齐哈尔市', '秦皇岛市', '清远市', '衢州市', '曲靖市'],
    'R': ['日照市', '瑞安市'],
    'S': ['石家庄市', '深圳市', '苏州市', '上海市', '沈阳市', '厦门市', '汕头市', '韶关市', '商丘市', '三门峡市'],
    'T': ['天津市', '太原市', '唐山市', '台州市', '泰州市', '泰安市', '铁岭市'],
    'W': ['武汉市', '无锡市', '温州市', '潍坊市', '威海市', '芜湖市', '渭南市', '乌海市'],
    'X': ['西安市', '厦门市', '徐州市', '新乡市', '许昌市', '信阳市', '咸阳市', '西宁市', '忻州市'],
    'Y': ['烟台市', '银川市', '宜昌市', '岳阳市', '运城市', '阳泉市', '营口市', '延边朝鲜族自治州'],
    'Z': ['郑州市', '中山市', '珠海市', '淄博市', '枣庄市', '张家口市', '张家界市', '周口市', '驻马店市', '遵义市']
  }

  const letters = Object.keys(cityData).sort()

  const handleCitySelect = (city: string) => {
    onCityChange(city)
    onClose()
  }

  const handleLetterClick = (letter: string) => {
    // 滚动到对应字母的城市列表
    const element = document.getElementById(`letter-${letter}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleRelocate = () => {
    if (isLocating) return
    setIsLocating(true)

          // 安全超时：20s 内无响应则提示失败，避免卡在定位中
      locateTimeoutRef.current = window.setTimeout(() => {
        setIsLocating(false)
        Taro.showToast({ title: '定位超时，请检查网络与权限', icon: 'error' })
      }, 20000)

      getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 18000,
      success: (res: any) => {
        console.log('定位成功:', res)
        // TODO: 可调用逆地理编码获取城市
        const newCity = '保定市'
        onCityChange(newCity)
        Taro.showToast({ title: `已定位到${newCity}`, icon: 'success', duration: 1500 })
      },
      fail: (err) => {
        console.error('定位失败:', err)
        Taro.showToast({ title: '定位失败，请检查定位权限', icon: 'error' })
      },
      complete: () => {
        setIsLocating(false)
        if (locateTimeoutRef.current) {
          clearTimeout(locateTimeoutRef.current)
          locateTimeoutRef.current = null
        }
      }
    })
  }

  const filteredCities = searchText ? 
    Object.values(cityData).flat().filter(city => 
      city.includes(searchText) || city.toLowerCase().includes(searchText.toLowerCase())
    ) : []
  return (
    <View className='city-selector-overlay'>
      <View className='city-selector'>
        {/* 顶部导航 */}
        <View className='city-header'>
          <View className='back-btn' onClick={onClose}>
            <Text>‹</Text>
          </View>
          <Text className='title'>城市选择</Text>
        </View>

        {/* 搜索栏 */}
        <View className='search-bar'>
          <input
            className='search-input'
            placeholder='搜索城市名或拼音'
            value={searchText}
            onChange={(e) => setSearchText((e.target as any).value)}
          />
        </View>

        {/* 当前城市 */}
        <View className='current-city'>
          <Text>当前城市: {currentCity}</Text>
          <View className='relocate-btn' onClick={handleRelocate}>
            <View className={`relocate-icon ${isLocating ? 'locating' : ''}`}>
              {isLocating ? '⟳' : '⊙'}
            </View>
            <Text>{isLocating ? '定位中...' : '重新定位'}</Text>
          </View>
        </View>

        {/* 搜索结果 */}
        {searchText && (
          <View className='search-results'>
            {filteredCities.map((city, idx) => (
              <View 
                key={`${city}-${idx}`}
                className='city-item'
                onClick={() => handleCitySelect(city)}
              >
                <Text>{city}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 热门城市 */}
        {!searchText && (
          <View className='hot-cities'>
            <Text className='section-title'>热门城市</Text>
            <View className='hot-cities-grid'>
              {hotCities.map(city => (
                <View 
                  key={city} 
                  className='hot-city-item'
                  onClick={() => handleCitySelect(city)}
                >
                  <Text>{city}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 城市列表 */}
        {!searchText && (
          <ScrollView className='city-list' scrollY>
            {letters.map(letter => (
              <View key={letter} id={`letter-${letter}`} className='letter-section'>
                <Text className='letter-title'>{letter}</Text>
                {cityData[letter].map((city, idx) => (
                  <View 
                    key={`${letter}-${city}-${idx}`}
                    className='city-item'
                    onClick={() => handleCitySelect(city)}
                  >
                    <Text>{city}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* 字母索引 */}
        {!searchText && (
          <View className='letter-index'>
            <View className='index-item' onClick={() => handleLetterClick('热')}>
              <Text>热</Text>
            </View>
            {letters.map(letter => (
              <View 
                key={letter} 
                className='index-item'
                onClick={() => handleLetterClick(letter)}
              >
                <Text>{letter}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
} 