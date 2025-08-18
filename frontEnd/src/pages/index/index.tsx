import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useMemo } from 'react'
import CitySelector from './CitySelector'
import './index.scss'

// 充电站数据接口
interface ChargingStation {
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

export default function Index() {
  useLoad(() => {
    console.log('智能充电应用启动')
    console.log('初始城市:', '保定市')
    console.log('总充电站数据:', 21)
  })

	const [currentCity, setCurrentCity] = useState('保定市')
	const [showCitySelector, setShowCitySelector] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [isLoading, setIsLoading] = useState(false)
	const pageSize = 3 // 每页显示3个数据

	// 搜索功能相关状态
	const [searchText, setSearchText] = useState('')
	const [isSearching, setIsSearching] = useState(false)
	const [searchResults, setSearchResults] = useState<ChargingStation[]>([])
	const [showSearchResults, setShowSearchResults] = useState(false)

	const quickActions = [
		{ text: '券包中心', icon: '💰', color: '#ff6b6b' },
		{ text: '充电订单', icon: '📋', color: '#ff9800' },
		{ text: '常用电站', icon: '⚡', color: '#4285f4' },
		{ text: '设备地图', icon: '📍', color: '#ff6b6b' },
	]
	// 距离筛选
	const distanceOptions = ['不限', '3km内', '5km内', '10km内', '20km内']
	const [selectedDistance, setSelectedDistance] = useState(distanceOptions[0])
	const [showDistanceDropdown, setShowDistanceDropdown] = useState(false)

	// 其它筛选（可多选）
	const otherFilters = ['免费停车', '快充','慢充'] as const
	type OtherFilter = typeof otherFilters[number]
	const [selectedFilters, setSelectedFilters] = useState<OtherFilter[]>([])

	const toggleFilter = (f: OtherFilter) => {
		setSelectedFilters((prev) =>
			prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
		)
		// 当用户选择筛选条件时，清除搜索状态
		if (showSearchResults) {
			clearSearch()
		}
	}

	// 模拟充电站数据 - 为保定、北京、邯郸、武汉、成都添加充电站数据
	const allStations: ChargingStation[] = useMemo(() => [
		// 保定地区充电站
		{
			_id: 'cs001',
			name: '保定市志广好滋味快餐饮食连锁有限公司保定市东兴东路店',
			address: '河北省保定市莲池区东兴东路与东三环交叉口',
			location: {
				type: 'Point',
				coordinates: [115.4901, 38.8731]
			},
			operator: '国家电网',
			operatingHours: { open: '00:00', close: '23:59' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch001',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.65, serviceFee: 0.05 }
				}
			],
			rating: 4.8,
			reviewCount: 12,
			distance: 6000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs002',
			name: '董傲国际仓储充电站',
			address: '河北省保定市清苑区董傲国际仓储物流园',
			location: {
				type: 'Point',
				coordinates: [115.5002, 38.8702]
			},
			operator: '特来电',
			operatingHours: { open: '00:00', close: '23:59' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch002',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 0.95, serviceFee: 0.05 }
				},
				{
					chargerId: 'ch003',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 0.95, serviceFee: 0.05 }
				}
			],
			rating: 4.6,
			reviewCount: 28,
			distance: 11000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs003',
			name: '董傲国际仓储内充电站',
			address: '河北省保定市清苑区董傲国际仓储物流园内部',
			location: {
				type: 'Point',
				coordinates: [115.5055, 38.8803]
			},
			operator: '星星充电',
			operatingHours: { open: '00:00', close: '23:59' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch004',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.75, serviceFee: 0.05 }
				}
			],
			rating: 4.4,
			reviewCount: 15,
			distance: 22000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs004',
			name: '保定市天鹅湾购物中心充电站',
			address: '河北省保定市竞秀区丽园路天鹅湾购物中心地下停车场',
			location: {
				type: 'Point',
				coordinates: [115.4801, 38.8751]
			},
			operator: '小鹏充电',
			operatingHours: { open: '08:00', close: '22:00' },
			parkingFee: 5,
			photos: [],
			chargers: [
				{
					chargerId: 'ch005',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.20, serviceFee: 0.15 }
				},
				{
					chargerId: 'ch006',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.85, serviceFee: 0.10 }
				}
			],
			rating: 4.7,
			reviewCount: 35,
			distance: 8500,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs005',
			name: '保定市火车站北广场充电站',
			address: '河北省保定市竞秀区火车站北广场停车场',
			location: {
				type: 'Point',
				coordinates: [115.4701, 38.8701]
			},
			operator: '国家电网',
			operatingHours: { open: '00:00', close: '24:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch007',
					type: 'fast',
					power: 60,
					status: 'busy',
					pricing: { electricityFee: 0.90, serviceFee: 0.08 }
				},
				{
					chargerId: 'ch008',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 0.90, serviceFee: 0.08 }
				},
				{
					chargerId: 'ch009',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.70, serviceFee: 0.05 }
				}
			],
			rating: 4.5,
			reviewCount: 42,
			distance: 12500,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs006',
			name: '保定市万和城购物中心充电站',
			address: '河北省保定市莲池区万和城购物中心地面停车场',
			location: {
				type: 'Point',
				coordinates: [115.4851, 38.8651]
			},
			operator: '特来电',
			operatingHours: { open: '09:00', close: '21:00' },
			parkingFee: 3,
			photos: [],
			chargers: [
				{
					chargerId: 'ch010',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.05, serviceFee: 0.12 }
				},
				{
					chargerId: 'ch011',
					type: 'slow',
					power: 7,
					status: 'offline',
					pricing: { electricityFee: 0.80, serviceFee: 0.08 }
				}
			],
			rating: 4.3,
			reviewCount: 18,
			distance: 15800,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs007',
			name: '保定市植物园充电站',
			address: '河北省保定市竞秀区植物园西门停车场',
			location: {
				type: 'Point',
				coordinates: [115.4751, 38.8801]
			},
			operator: '星星充电',
			operatingHours: { open: '06:00', close: '20:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch012',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.75, serviceFee: 0.05 }
				},
				{
					chargerId: 'ch013',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.75, serviceFee: 0.05 }
				}
			],
			rating: 4.6,
			reviewCount: 25,
			distance: 18200,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs008',
			name: '保定市高新区科技园充电站',
			address: '河北省保定市高新区科技园A区停车场',
			location: {
				type: 'Point',
				coordinates: [115.5101, 38.8851]
			},
			operator: '小鹏充电',
			operatingHours: { open: '00:00', close: '24:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch014',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.15, serviceFee: 0.18 }
				},
				{
					chargerId: 'ch015',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.15, serviceFee: 0.18 }
				},
				{
					chargerId: 'ch016',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.90, serviceFee: 0.10 }
				}
			],
			rating: 4.9,
			reviewCount: 31,
			distance: 25000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs009',
			name: '保定市大学城充电站',
			address: '河北省保定市莲池区大学城商业街停车场',
			location: {
				type: 'Point',
				coordinates: [115.4951, 38.8751]
			},
			operator: '特来电',
			operatingHours: { open: '08:00', close: '23:00' },
			parkingFee: 2,
			photos: [],
			chargers: [
				{
					chargerId: 'ch017',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 0.95, serviceFee: 0.10 }
				},
				{
					chargerId: 'ch018',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.70, serviceFee: 0.05 }
				}
			],
			rating: 4.4,
			reviewCount: 22,
			distance: 9200,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		// 北京地区充电站
		{
			_id: 'cs010',
			name: '北京国贸CBD充电站',
			address: '北京市朝阳区建国门外大街1号国贸商城地下停车场',
			location: {
				type: 'Point',
				coordinates: [116.4501, 39.9081]
			},
			operator: '国家电网',
			operatingHours: { open: '00:00', close: '23:59' },
			parkingFee: 10,
			photos: [],
			chargers: [
				{
					chargerId: 'ch019',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.50, serviceFee: 0.20 }
				},
				{
					chargerId: 'ch020',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.20, serviceFee: 0.15 }
				}
			],
			rating: 4.8,
			reviewCount: 156,
			distance: 8000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs011',
			name: '北京西单大悦城充电站',
			address: '北京市西城区西单北大街131号大悦城地下停车场',
			location: {
				type: 'Point',
				coordinates: [116.3701, 39.9131]
			},
			operator: '特来电',
			operatingHours: { open: '09:00', close: '22:00' },
			parkingFee: 8,
			photos: [],
			chargers: [
				{
					chargerId: 'ch021',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.25, serviceFee: 0.18 }
				}
			],
			rating: 4.6,
			reviewCount: 89,
			distance: 12000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs012',
			name: '北京三里屯太古里充电站',
			address: '北京市朝阳区三里屯路19号太古里北区停车场',
			location: {
				type: 'Point',
				coordinates: [116.4551, 39.9351]
			},
			operator: '小鹏充电',
			operatingHours: { open: '10:00', close: '22:00' },
			parkingFee: 12,
			photos: [],
			chargers: [
				{
					chargerId: 'ch022',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.60, serviceFee: 0.25 }
				}
			],
			rating: 4.7,
			reviewCount: 67,
			distance: 15000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		// 邯郸地区充电站
		{
			_id: 'cs013',
			name: '邯郸市丛台公园充电站',
			address: '河北省邯郸市丛台区丛台公园东门停车场',
			location: {
				type: 'Point',
				coordinates: [114.4901, 36.6251]
			},
			operator: '星星充电',
			operatingHours: { open: '06:00', close: '22:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch023',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.75, serviceFee: 0.05 }
				},
				{
					chargerId: 'ch024',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.10, serviceFee: 0.12 }
				}
			],
			rating: 4.5,
			reviewCount: 34,
			distance: 6000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs014',
			name: '邯郸市火车站充电站',
			address: '河北省邯郸市丛台区火车站广场停车场',
			location: {
				type: 'Point',
				coordinates: [114.4801, 36.6151]
			},
			operator: '国家电网',
			operatingHours: { open: '00:00', close: '24:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch025',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.00, serviceFee: 0.10 }
				}
			],
			rating: 4.3,
			reviewCount: 28,
			distance: 8500,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs015',
			name: '邯郸市万达广场充电站',
			address: '河北省邯郸市丛台区万达广场地下停车场',
			location: {
				type: 'Point',
				coordinates: [114.5051, 36.6351]
			},
			operator: '特来电',
			operatingHours: { open: '09:00', close: '21:00' },
			parkingFee: 5,
			photos: [],
			chargers: [
				{
					chargerId: 'ch026',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.15, serviceFee: 0.15 }
				}
			],
			rating: 4.6,
			reviewCount: 42,
			distance: 11000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		// 武汉地区充电站
		{
			_id: 'cs016',
			name: '武汉市光谷广场充电站',
			address: '湖北省武汉市洪山区光谷广场地下停车场',
			location: {
				type: 'Point',
				coordinates: [114.4001, 30.5051]
			},
			operator: '小鹏充电',
			operatingHours: { open: '08:00', close: '22:00' },
			parkingFee: 6,
			photos: [],
			chargers: [
				{
					chargerId: 'ch027',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.40, serviceFee: 0.20 }
				},
				{
					chargerId: 'ch028',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.20, serviceFee: 0.15 }
				}
			],
			rating: 4.8,
			reviewCount: 78,
			distance: 9000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs017',
			name: '武汉市黄鹤楼充电站',
			address: '湖北省武汉市武昌区黄鹤楼景区停车场',
			location: {
				type: 'Point',
				coordinates: [114.3101, 30.5451]
			},
			operator: '星星充电',
			operatingHours: { open: '07:00', close: '19:00' },
			parkingFee: 8,
			photos: [],
			chargers: [
				{
					chargerId: 'ch029',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.80, serviceFee: 0.08 }
				}
			],
			rating: 4.4,
			reviewCount: 45,
			distance: 14000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs018',
			name: '武汉市东湖绿道充电站',
			address: '湖北省武汉市武昌区东湖绿道游客中心停车场',
			location: {
				type: 'Point',
				coordinates: [114.3701, 30.5551]
			},
			operator: '国家电网',
			operatingHours: { open: '06:00', close: '20:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch030',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.10, serviceFee: 0.12 }
				}
			],
			rating: 4.7,
			reviewCount: 56,
			distance: 16000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		// 成都地区充电站
		{
			_id: 'cs019',
			name: '成都市春熙路充电站',
			address: '四川省成都市锦江区春熙路步行街地下停车场',
			location: {
				type: 'Point',
				coordinates: [104.0801, 30.6551]
			},
			operator: '特来电',
			operatingHours: { open: '09:00', close: '22:00' },
			parkingFee: 10,
			photos: [],
			chargers: [
				{
					chargerId: 'ch031',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.35, serviceFee: 0.18 }
				},
				{
					chargerId: 'ch032',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.15, serviceFee: 0.15 }
				}
			],
			rating: 4.6,
			reviewCount: 92,
			distance: 7000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs020',
			name: '成都市宽窄巷子充电站',
			address: '四川省成都市青羊区宽窄巷子景区停车场',
			location: {
				type: 'Point',
				coordinates: [104.0601, 30.6651]
			},
			operator: '小鹏充电',
			operatingHours: { open: '08:00', close: '21:00' },
			parkingFee: 6,
			photos: [],
			chargers: [
				{
					chargerId: 'ch033',
					type: 'fast',
					power: 60,
					status: 'available',
					pricing: { electricityFee: 1.20, serviceFee: 0.16 }
				}
			],
			rating: 4.5,
			reviewCount: 38,
			distance: 12000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		},
		{
			_id: 'cs021',
			name: '成都市天府软件园充电站',
			address: '四川省成都市高新区天府软件园C区停车场',
			location: {
				type: 'Point',
				coordinates: [104.0701, 30.5851]
			},
			operator: '星星充电',
			operatingHours: { open: '00:00', close: '24:00' },
			parkingFee: 0,
			photos: [],
			chargers: [
				{
					chargerId: 'ch034',
					type: 'fast',
					power: 120,
					status: 'available',
					pricing: { electricityFee: 1.45, serviceFee: 0.22 }
				},
				{
					chargerId: 'ch035',
					type: 'slow',
					power: 7,
					status: 'available',
					pricing: { electricityFee: 0.85, serviceFee: 0.10 }
				}
			],
			rating: 4.8,
			reviewCount: 67,
			distance: 18000,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		}
	], [])

	// 筛选后的充电站
	const filteredStations = useMemo(() => {
		console.log('[筛选] 开始筛选充电站数据...')
		console.log('[筛选] 当前城市:', currentCity)
		console.log('[筛选] 总充电站数量:', allStations.length)
		
		// 如果有搜索结果显示，优先显示搜索结果
		if (showSearchResults && searchResults.length > 0) {
			console.log('[筛选] 显示搜索结果，数量:', searchResults.length)
			return searchResults
		}

		// 根据当前城市筛选充电站
		let cityStations = allStations
		
		// 定义有充电站数据的城市
		const citiesWithStations = ['保定市', '北京市', '邯郸市', '武汉市', '成都市']
		
		if (currentCity && citiesWithStations.includes(currentCity)) {
			// 有数据的城市，根据城市名称筛选
			cityStations = allStations.filter(station => {
				// 改进城市名称匹配逻辑
				const address = station.address
				if (currentCity === '保定市' && address.includes('保定市')) {
					return true
				} else if (currentCity === '北京市' && address.includes('北京市')) {
					return true
				} else if (currentCity === '邯郸市' && address.includes('邯郸市')) {
					return true
				} else if (currentCity === '武汉市' && address.includes('武汉市')) {
					return true
				} else if (currentCity === '成都市' && address.includes('成都市')) {
					return true
				}
				return false
			})
			console.log('[筛选] 城市筛选结果，数量:', cityStations.length)
			// 添加调试信息，显示匹配到的充电站
			if (cityStations.length > 0) {
				console.log('[筛选] 匹配到的充电站:', cityStations.map(s => s.name))
			}
		} else if (currentCity) {
			// 其他城市，返回空数组（将显示"未统计充电站数据"提示）
			cityStations = []
			console.log('[筛选] 该城市暂无数据')
		}

		// 根据距离筛选
		if (selectedDistance === '不限') {
			console.log('[筛选] 距离筛选: 不限，返回城市筛选结果')
			return cityStations
		}

		const km = parseFloat(selectedDistance)
		const distanceLimitM = km * 1000
		console.log('[筛选] 距离筛选:', selectedDistance, '=', distanceLimitM, '米')

		const finalStations = cityStations.filter((station) => {
			// 距离筛选
			if (typeof station.distance === 'number' && station.distance > distanceLimitM) return false
			
			// 免费停车筛选
			if (selectedFilters.includes('免费停车') && station.parkingFee > 0) return false
			
			// 快充筛选
			if (selectedFilters.includes('快充')) {
				const hasFast = station.chargers.some((c) => c.type === 'fast')
				if (!hasFast) return false
			}
			
			// 慢充筛选
			if (selectedFilters.includes('慢充')) {
				const hasSlow = station.chargers.some((c) => c.type === 'slow')
				if (!hasSlow) return false
			}
			
			return true
		})
		
		console.log('[筛选] 最终筛选结果，数量:', finalStations.length)
		return finalStations
	}, [allStations, currentCity, selectedDistance, selectedFilters, showSearchResults, searchResults])

	// 当前页显示的数据 - 修改为累积显示
	const currentPageStations = useMemo(() => {
		// 计算当前应该显示的总数据量
		const totalToShow = currentPage * pageSize
		const result = filteredStations.slice(0, totalToShow)
		console.log('[分页] 当前页:', currentPage, '页大小:', pageSize, '总显示:', totalToShow)
		console.log('[分页] 筛选后总数:', filteredStations.length, '当前页显示:', result.length)
		return result
	}, [filteredStations, currentPage])

	// 检查是否还有更多数据
	useMemo(() => {
		const totalPages = Math.ceil(filteredStations.length / pageSize)
		setHasMore(currentPage < totalPages)
	}, [filteredStations.length, currentPage])

	// 重置分页
	useMemo(() => {
		setCurrentPage(1)
	}, [selectedDistance, selectedFilters, currentCity])

	// 加载更多数据 - 修改为追加模式
	const loadMore = () => {
		if (isLoading || !hasMore) return
		
		setIsLoading(true)
		// 模拟网络延迟
		setTimeout(() => {
			setCurrentPage(prev => prev + 1)
			setIsLoading(false)
		}, 500)
	}

	// 搜索功能实现
	const handleSearch = async () => {
		if (!searchText.trim()) {
			setShowSearchResults(false)
			return
		}

		setIsSearching(true)
		setShowSearchResults(true)

		try {
			// 模拟搜索延迟
			await new Promise(resolve => setTimeout(resolve, 500))

			// 执行搜索逻辑
			const results = allStations.filter(station => {
				const searchLower = searchText.toLowerCase().trim()
				
				// 搜索充电站名称
				if (station.name.toLowerCase().includes(searchLower)) {
					return true
				}
				
				// 搜索地址
				if (station.address.toLowerCase().includes(searchLower)) {
					return true
				}
				
				// 搜索运营商
				if (station.operator.toLowerCase().includes(searchLower)) {
					return true
				}
				
				// 搜索充电桩类型
				const hasFastCharger = station.chargers.some(c => c.type === 'fast')
				const hasSlowCharger = station.chargers.some(c => c.type === 'slow')
				
				if (searchLower.includes('快充') && hasFastCharger) {
					return true
				}
				
				if (searchLower.includes('慢充') && hasSlowCharger) {
					return true
				}
				
				// 搜索免费停车
				if (searchLower.includes('免费停车') && station.parkingFee === 0) {
					return true
				}
				
				// 搜索24小时营业
				if (searchLower.includes('24小时') && 
					station.operatingHours.open === '00:00' && 
					station.operatingHours.close === '23:59') {
					return true
				}
				
				return false
			})

			setSearchResults(results)
			console.log('搜索完成，找到', results.length, '个结果')
		} catch (error) {
			console.error('搜索失败:', error)
			setSearchResults([])
		} finally {
			setIsSearching(false)
		}
	}

	// 清除搜索
	const clearSearch = () => {
		setSearchText('')
		setSearchResults([])
		setShowSearchResults(false)
		setCurrentPage(1)
	}

	// 处理搜索输入框回车
	const handleSearchKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSearch()
		}
	}


	// 获取显示价格
	const getDisplayPrice = (station: ChargingStation) => {
		if (!station.chargers.length) return '0.0000'
		const pricing = station.chargers[0].pricing
		const total = (pricing.electricityFee + pricing.serviceFee).toFixed(4)
		return total
	}

	// 获取显示距离
	const getDisplayDistance = (station: ChargingStation) => {
		if (typeof station.distance !== 'number') return '--'
		return (station.distance / 1000).toFixed(2) + 'km'
	}

	// 获取可用充电桩数量
	const getAvailableChargers = (station: ChargingStation) => {
		const available = station.chargers.filter(c => c.status === 'available').length
		const total = station.chargers.length
		return `${available}/${total}`
	}



  return (
    <View className='index'>
			<View className='top-bar'>
				<View className='city' onClick={() => setShowCitySelector(true)}>
					{currentCity}
				</View>
				<View className='search-container'>
					<View className='search-input-wrapper'>
						<Text className='search-icon'>🔍</Text>
						<input
							className='search-input'
							type='text'
							placeholder='请输入目的地/电站名'
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							onKeyPress={handleSearchKeyPress}
						/>
						{searchText && (
							<View className='clear-search' onClick={clearSearch}>
								<Text className='clear-icon'>✕</Text>
							</View>
						)}
					</View>
					<View className='search-button' onClick={handleSearch}>
						{isSearching ? (
							<Text className='searching-text'>搜索中...</Text>
						) : (
							<Text className='search-text'>搜索</Text>
						)}
					</View>
				</View>
			</View>

			<View className='content'>
				<View className='feature-section card'>
					<View className='feature-grid'>
						{quickActions.map((item) => (
							<View
								className='feature-item'
								key={item.text}
								onClick={() => {
									if (item.text === '设备地图') {
										Taro.navigateTo({
											url: '/pages/map/index'
										})
									}
								}}
							>
								<View className='feature-icon' style={{ color: item.color }}>{item.icon}</View>
								<Text className='feature-text'>{item.text}</Text>
							</View>
						))}
					</View>
				</View>

				{/* 搜索结果显示 */}
				{showSearchResults && (
					<View className='search-results-header card'>
						<View className='search-results-info'>
							<Text className='search-results-title'>
								搜索结果: "{searchText}"
							</Text>
							<Text className='search-results-count'>
								找到 {searchResults.length} 个充电站
							</Text>
						</View>
						<View className='search-results-actions'>
							<View className='clear-search-btn' onClick={clearSearch}>
								<Text className='clear-search-text'>清除搜索</Text>
							</View>
						</View>
					</View>
				)}

				<View className='filter-bar card'>
					{/* 距离下拉选择器 */}
					<View
						className={`filter-tag distance ${showDistanceDropdown ? 'open' : ''}`}
						onClick={() => setShowDistanceDropdown(!showDistanceDropdown)}
					>
						{selectedDistance}
					</View>
					
					{/* 其它筛选按钮（可多选） */}
					{otherFilters.map((f) => (
						<View
							key={f}
							className={`filter-tag ${selectedFilters.includes(f) ? 'selected' : ''}`}
							onClick={() => toggleFilter(f)}
						>
							{f}
						</View>
					))}

					{/* 距离下拉面板 - 顶层显示 */}
					{showDistanceDropdown && (
						<>
							<View
								className='dropdown-mask'
								onClick={() => setShowDistanceDropdown(false)}
							/>
							<View className='dropdown-panel top-layer'>
								{distanceOptions.map((opt) => (
									<View
										key={opt}
										className={`dropdown-option ${selectedDistance === opt ? 'active' : ''}`}
										onClick={() => {
											setSelectedDistance(opt)
											setShowDistanceDropdown(false)
											// 当用户选择距离时，清除搜索状态
											if (showSearchResults) {
												clearSearch()
											}
										}}
									>
										{opt}
									</View>
								))}
							</View>
						</>
					)}
				</View>

				{/* 充电站列表 */}
				<View className='station-list'>
					{currentPageStations.length === 0 ? (
						<View className='empty-state'>
							{showSearchResults ? (
								<>
									<Text className='empty-icon'>🔍</Text>
									<Text className='empty-text'>未找到匹配的充电站</Text>
									<Text className='empty-hint'>请尝试其他关键词或调整搜索条件</Text>
									<View className='empty-actions'>
										<View className='empty-action-btn' onClick={clearSearch}>
											<Text className='empty-action-text'>清除搜索</Text>
										</View>
									</View>
								</>
							) : currentCity && !['保定市', '北京市', '邯郸市', '武汉市', '成都市'].includes(currentCity) ? (
								<>
									<Text className='empty-icon'>🏙️</Text>
									<Text className='empty-text'>该地区目前未统计充电站数据</Text>
									<Text className='empty-hint'>
										我们正在努力完善{currentCity}地区的充电站信息，敬请期待！
									</Text>
									<View className='empty-actions'>
										<View className='empty-action-btn' onClick={() => setCurrentCity('北京市')}>
											<Text className='empty-action-text'>查看北京市充电站</Text>
										</View>
										<View className='empty-action-btn' onClick={() => setCurrentCity('邯郸市')}>
											<Text className='empty-action-text'>查看邯郸充电站</Text>
										</View>
										<View className='empty-action-btn' onClick={() => setCurrentCity('武汉市')}>
											<Text className='empty-action-text'>查看武汉市充电站</Text>
										</View>
										<View className='empty-action-btn' onClick={() => setCurrentCity('成都市')}>
											<Text className='empty-action-text'>查看成都市充电站</Text>
										</View>
									</View>
								</>
							) : (
								<>
									<Text className='empty-icon'>📋</Text>
									<Text className='empty-text'>暂无符合条件的充电站</Text>
									<Text className='empty-hint'>请尝试调整筛选条件</Text>
								</>
							)}
						</View>
					) : (
						<>
							{/* 城市充电站统计信息 */}
							{currentCity && ['保定市', '北京市', '邯郸市', '武汉市', '成都市'].includes(currentCity) && (
								<View className='city-stats card'>
									<Text className='city-stats-title'>
										🏙️ {currentCity}地区充电站统计
									</Text>
									<Text className='city-stats-count'>
										共找到 {filteredStations.length} 个充电站
									</Text>
									<Text className='city-stats-hint'>
										点击充电站卡片查看详细信息
									</Text>
								</View>
							)}
							
							{currentPageStations.map((station) => (
								<View 
									key={station._id} 
									className='station-card'
									onClick={() => {
										console.log('点击充电站:', station)
										// 保存选中的充电站信息
										try {
											if (typeof Taro.setStorageSync === 'function') {
												Taro.setStorageSync('selected_station', station)
												console.log('充电站数据已保存到Taro存储')
											} else {
												localStorage.setItem('selected_station', JSON.stringify(station))
												console.log('充电站数据已保存到浏览器localStorage')
											}
											
											// 跳转到详情页面
											if (typeof Taro.navigateTo === 'function') {
												Taro.navigateTo({
													url: '/pages/index/xiangx',
													success: () => {
														console.log('跳转到详情页面成功')
													},
													fail: (error) => {
														console.error('Taro跳转失败:', error)
														// 如果Taro跳转失败，使用浏览器导航
														window.location.hash = '#/pages/index/xiangx'
													}
												})
											} else {
												// Taro不可用，直接使用浏览器导航
												window.location.hash = '#/pages/index/xiangx'
											}
										} catch (error) {
											console.error('跳转失败:', error)
											// 最后的备选方案
											try {
												localStorage.setItem('selected_station', JSON.stringify(station))
												window.location.hash = '#/pages/index/xiangx'
											} catch (fallbackError) {
												console.error('备选方案也失败了:', fallbackError)
											}
										}
									}}
								>
									{/* 顶部信息 */}
									<View className='station-header'>
										<View className='station-logo'>
											<Text className='logo-icon'>🔌</Text>
										</View>
										<View className='station-info'>
											<Text className='station-name'>{station.name}</Text>
											<View className='station-tags'>
												<Text className='tag'>对外开放</Text>
												{station.operatingHours.open === '00:00' && station.operatingHours.close === '23:59' && (
													<Text className='tag'>24小时营业</Text>
												)}
												{station.parkingFee === 0 && <Text className='tag'>免费停车</Text>}
											</View>
										</View>
										<View className='station-status'>
											<Text className='status-text'>营业中</Text>
											<Text className='status-count'>闲{getAvailableChargers(station)}</Text>
										</View>
									</View>

									{/* 详细信息 */}
									<View className='station-details'>
										<View className='detail-item'>
											<Text className='detail-icon'>🅿️</Text>
											<Text className='detail-text'>按实际场地收费标准收费</Text>
										</View>
										<View className='detail-item activity'>
											<Text className='detail-icon'>⚡</Text>
											<Text className='detail-text'>5小时内有人充电</Text>
											<Text className='detail-status'>暂不可用</Text>
										</View>
									</View>

									{/* 底部价格和距离 */}
									<View className='station-bottom'>
										<View className='price-section'>
											<Text className='price-symbol'>¥</Text>
											<Text className='price-value'>{getDisplayPrice(station)}</Text>
											<Text className='price-unit'>起/度</Text>
										</View>
										<View className='distance-section' onClick={(e) => {
											e.stopPropagation() // 阻止事件冒泡，避免触发整个卡片的点击
											console.log('点击距离，准备跳转到地图页面:', station)
											
											// 保存地图目标位置信息
											try {
												if (typeof Taro.setStorageSync === 'function') {
													Taro.setStorageSync('map_target_coord', {
														lng: station.location.coordinates[0],
														lat: station.location.coordinates[1]
													})
													Taro.setStorageSync('map_target_station', {
														name: station.name,
														address: station.address,
														distance: station.distance,
														rating: station.rating
													})
													console.log('地图数据已保存到Taro存储')
												} else {
													// 降级到浏览器localStorage
													localStorage.setItem('map_target_coord', JSON.stringify({
														lng: station.location.coordinates[0],
														lat: station.location.coordinates[1]
													}))
													localStorage.setItem('map_target_station', JSON.stringify({
														name: station.name,
														address: station.address,
														distance: station.distance,
														rating: station.rating
													}))
													console.log('地图数据已保存到浏览器localStorage')
												}
												
												// 跳转到地图页面
												if (typeof Taro.navigateTo === 'function') {
													Taro.navigateTo({
														url: '/pages/map/index',
														success: () => {
															console.log('跳转到地图页面成功')
														},
														fail: (error) => {
															console.error('Taro跳转失败:', error)
															// 如果Taro跳转失败，使用浏览器导航
															window.location.hash = '#/pages/map/index'
														}
													})
												} else {
													// Taro不可用，直接使用浏览器导航
													window.location.hash = '#/pages/map/index'
												}
											} catch (error) {
												console.error('保存地图数据或跳转失败:', error)
												// 最后的备选方案
												try {
													localStorage.setItem('map_target_coord', JSON.stringify({
														lng: station.location.coordinates[0],
														lat: station.location.coordinates[1]
													}))
													localStorage.setItem('map_target_station', JSON.stringify({
														name: station.name,
														address: station.address,
														distance: station.distance,
														rating: station.rating
													}))
													window.location.hash = '#/pages/map/index'
												} catch (fallbackError) {
													console.error('备选方案也失败了:', fallbackError)
												}
											}
										}}>
											<Text className='distance-icon'>📍</Text>
											<Text className='distance-text'>{getDisplayDistance(station)}</Text>
										</View>
									</View>
								</View>
							))}

							{/* 加载更多按钮 */}
							{hasMore && (
								<View className='load-more-section'>
									<View 
										className={`load-more-btn ${isLoading ? 'loading' : ''}`}
										onClick={loadMore}
									>
										{isLoading ? (
											<>
												<Text className='loading-icon'>⏳</Text>
												<Text className='loading-text'>加载中...</Text>
											</>
										) : (
											<>
												<Text className='load-more-icon'>⬇️</Text>
												<Text className='load-more-text'>点击加载更多</Text>
											</>
										)}
									</View>
								</View>
							)}

							{/* 没有更多数据提示 */}
							{!hasMore && currentPageStations.length > 0 && (
								<View className='no-more-section'>
									<Text className='no-more-text'>没有更多数据了</Text>
								</View>
							)}
						</>
					)}
				</View>

			</View>

			{/* 城市选择器 */}
			{showCitySelector && (
				<CitySelector
					currentCity={currentCity}
					onCityChange={setCurrentCity}
					onClose={() => setShowCitySelector(false)}
				/>
			)}

			{/* AI客服浮动按钮 */}
			<View className='ai-customer-service'>
				<View className='ai-button'>
					<View className='ai-icon'>
						<Text className='ai-text'>Ai</Text>
					</View>
					<View className='ai-label'>
						<Text className='label-text'>AI客服</Text>
					</View>
				</View>
			</View>


    </View>
  )
}