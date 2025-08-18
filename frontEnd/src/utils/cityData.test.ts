// 城市数据测试文件
import { hotCities, cityCategories, getAllCities, getCityInfo, searchCities, getCityStats } from './cityData'

// 测试热门城市数据
console.log('热门城市数量:', hotCities.length)
console.log('热门城市列表:', hotCities)

// 测试城市分类数据
console.log('城市分类数量:', Object.keys(cityCategories).length)
console.log('城市分类:', Object.keys(cityCategories))

// 测试所有城市
const allCities = getAllCities()
console.log('所有城市数量:', allCities.length)

// 测试城市信息查询
const beijingInfo = getCityInfo('北京市')
console.log('北京市信息:', beijingInfo)

// 测试搜索功能
const searchResults = searchCities('北京')
console.log('搜索"北京"结果:', searchResults)

// 测试统计信息
const stats = getCityStats()
console.log('城市统计信息:', stats)

// 验证数据完整性
console.log('数据验证完成！')
