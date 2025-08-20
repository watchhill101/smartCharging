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
  })

	const [currentCity, setCurrentCity] = useState('保定市')
	const [showCitySelector, setShowCitySelector] = useState(false)
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
	}

	// 模拟充电站数据
	const allStations: ChargingStation[] = useMemo(() => [
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
			distance: 1340,
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
			distance: 1360,
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
			distance: 1530,
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z'
		}
	], [])

	// 筛选后的充电站
	const filteredStations = useMemo(() => {
		const km = selectedDistance === '不限' ? Infinity : parseFloat(selectedDistance)
		const distanceLimitM = km === Infinity ? Infinity : km * 1000

		return allStations.filter((station) => {
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
	}, [allStations, selectedDistance, selectedFilters])

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
				<View className='search'>请输入目的地/电站名</View>

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
					{filteredStations.length === 0 ? (
						<View className='empty-state'>
							<Text className='empty-text'>暂无符合条件的充电站</Text>
						</View>
					) : (
						filteredStations.map((station) => (
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
						))
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
				<View 
					className='ai-button'
					onClick={() => {
						console.log('点击AI客服按钮，准备跳转到AI客服页面')
						
						try {
							// 优先使用Taro导航
							if (typeof Taro.navigateTo === 'function') {
								Taro.navigateTo({
									url: '/pages/aiserver/index',
									success: () => {
										console.log('跳转到AI客服页面成功')
									},
									fail: (error) => {
										console.error('Taro跳转失败:', error)
										// 如果Taro跳转失败，使用浏览器导航
										window.location.hash = '#/pages/aiserver/index'
									}
								})
							} else {
								// Taro不可用，直接使用浏览器导航
								window.location.hash = '#/pages/aiserver/index'
							}
						} catch (error) {
							console.error('跳转到AI客服页面失败:', error)
							// 最后的备选方案
							try {
								window.location.hash = '#/pages/aiserver/index'
							} catch (fallbackError) {
								console.error('备选方案也失败了:', fallbackError)
							}
						}
					}}
				>
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
