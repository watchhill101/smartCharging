// 城市数据配置文件
export interface CityData {
  hotCities: string[]
  cityCategories: Record<string, string[]>
}

// 热门城市数据
export const hotCities = [
  '保定市', '北京市', '邯郸市', '武汉市', '成都市',
  '上海市', '南京市', '苏州市', '杭州市', '郑州市', 
  '长沙市', '广州市'
]

// 城市分类数据（按拼音首字母）
export const cityCategories: Record<string, string[]> = {
  'A': ['安庆市', '安阳市', '鞍山市', '安康市'],
  'B': ['北京市', '保定市', '包头市', '蚌埠市', '本溪市'],
  'C': ['成都市', '重庆市', '长沙市', '常州市', '承德市'],
  'D': ['大连市', '东莞市', '大同市', '丹东市'],
  'E': ['鄂尔多斯市'],
  'F': ['福州市', '佛山市', '抚顺市'],
  'G': ['广州市', '贵阳市', '桂林市', '赣州市'],
  'H': ['杭州市', '哈尔滨市', '合肥市', '海口市', '邯郸市'],
  'J': ['济南市', '金华市', '嘉兴市', '江门市'],
  'K': ['昆明市', '开封市'],
  'L': ['兰州市', '洛阳市', '连云港市', '廊坊市'],
  'M': ['绵阳市', '马鞍山市'],
  'N': ['南京市', '宁波市', '南昌市', '南宁市'],
  'Q': ['青岛市', '泉州市', '秦皇岛市'],
  'S': ['上海市', '深圳市', '苏州市', '沈阳市', '石家庄市'],
  'T': ['天津市', '太原市', '唐山市', '台州市'],
  'W': ['武汉市', '无锡市', '温州市', '威海市'],
  'X': ['西安市', '厦门市', '徐州市', '襄阳市'],
  'Y': ['银川市', '烟台市', '扬州市', '盐城市'],
  'Z': ['郑州市', '珠海市', '中山市', '淄博市']
}

// 导出完整数据对象
export const cityData: CityData = {
  hotCities,
  cityCategories
}

// 获取所有城市列表（扁平化）
export const getAllCities = (): string[] => {
  return Object.values(cityCategories).flat()
}

// 根据城市名获取城市信息
export const getCityInfo = (cityName: string) => {
  const allCities = getAllCities()
  if (allCities.includes(cityName)) {
    // 找到城市所属的字母分类
    const category = Object.entries(cityCategories).find(([_, cities]) => 
      cities.includes(cityName)
    )
    return {
      name: cityName,
      category: category?.[0] || '',
      isHot: hotCities.includes(cityName)
    }
  }
  return null
}

// 搜索城市
export const searchCities = (keyword: string): string[] => {
  if (!keyword.trim()) return []
  
  const allCities = getAllCities()
  return allCities.filter(city =>
    city.toLowerCase().includes(keyword.toLowerCase()) ||
    city.includes(keyword)
  )
}

// 获取城市统计信息
export const getCityStats = () => {
  const allCities = getAllCities()
  return {
    totalCities: allCities.length,
    hotCitiesCount: hotCities.length,
    categoriesCount: Object.keys(cityCategories).length,
    categories: Object.keys(cityCategories).sort()
  }
}
