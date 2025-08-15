import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useMemo, useState } from 'react'
import CitySelector from './CitySelector'
import './index.scss'
import type { ChargingStation } from '../../types'

interface StationWithExtras extends ChargingStation {
	supportsECard: boolean
}

export default function Index() {
  useLoad(() => {
    console.log('智能充电应用启动')
  })

	const [currentCity, setCurrentCity] = useState('保定市')
	const [showCitySelector, setShowCitySelector] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [hasMoreStations, setHasMoreStations] = useState(true)

	const quickActions = [
		{ text: '蓝充补贴', icon: '💰', color: '#4285f4' },
		{ text: '充电订单', icon: '📋', color: '#ff6b6b' },
		{ text: '易捷支付', icon: '⚡', color: '#ff9800' },
		{ text: '收费咨询', icon: '📍', color: '#f44336' },
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

	// 模拟电站数据（与 types 对齐）
	const allStations: StationWithExtras[] = useMemo(
		() => [
			{
				_id: 's1',
				name: '八里庄家园充电站',
				address: '保定市莲池区八里庄街道',
				location: { type: 'Point', coordinates: [115.4901, 38.8731] },
				operator: '官方',
				operatingHours: { open: '00:00', close: '23:59' },
				parkingFee: 2,
				photos: [],
				chargers: [
					{ chargerId: 'c1', type: 'slow', power: 7, status: 'available', pricing: { electricityFee: 0.7, serviceFee: 0.3 } },
				],
				rating: 4.7,
				reviewCount: 120,
				distance: 1140,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				supportsECard: true,
			},
			{
				_id: 's2',
				name: '理工南区站',
				address: '保定理工学院南区',
				location: { type: 'Point', coordinates: [115.5002, 38.8702] },
				operator: '社会运营商',
				operatingHours: { open: '00:00', close: '23:59' },
				parkingFee: 0,
				photos: [],
				chargers: [
					{ chargerId: 'c2', type: 'fast', power: 60, status: 'available', pricing: { electricityFee: 0.65, serviceFee: 0.25 } },
					{ chargerId: 'c3', type: 'slow', power: 7, status: 'busy', pricing: { electricityFee: 0.70, serviceFee: 0.30 } },
				],
				rating: 4.5,
				reviewCount: 86,
				distance: 3200,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				supportsECard: true,
			},
			{
				_id: 's3',
				name: '莲池区大悦城站',
				address: '保定市莲池区大悦城',
				location: { type: 'Point', coordinates: [115.5055, 38.8803] },
				operator: '社会运营商',
				operatingHours: { open: '07:00', close: '22:00' },
				parkingFee: 5,
				photos: [],
				chargers: [
					{ chargerId: 'c4', type: 'fast', power: 120, status: 'available', pricing: { electricityFee: 0.75, serviceFee: 0.35 } },
				],
				rating: 4.2,
				reviewCount: 41,
				distance: 5800,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				supportsECard: false,
			},
		],
		[]
	)

	const filteredStations = useMemo(() => {
		const km = selectedDistance === '不限' ? Infinity : parseFloat(selectedDistance)
		const distanceLimitM = km === Infinity ? Infinity : km * 1000

		return allStations.filter((s) => {
			if (typeof s.distance === 'number' && s.distance > distanceLimitM) return false
			// 依次校验三类筛选
			if (selectedFilters.includes('免费停车') && !(s.parkingFee === 0)) return false
			if (selectedFilters.includes('快充')) {
				const hasFast = s.chargers.some((c) => c.type === 'fast')
				if (!hasFast) return false
			}
			if (selectedFilters.includes('慢充')) {
				const hasSlow = s.chargers.some((c) => c.type === 'slow')
				if (!hasSlow) return false
			}
			return true
		})
	}, [allStations, selectedDistance, selectedFilters])

	const getDisplayPrice = (station: StationWithExtras) => {
		if (!station.chargers.length) return '0.0000'
		const p = station.chargers[0].pricing
		const total = (p.electricityFee + p.serviceFee).toFixed(4)
		return total
	}

	const getDisplayDistance = (station: StationWithExtras) => {
		if (typeof station.distance !== 'number') return '--'
		return (station.distance / 1000).toFixed(2) + 'km'
	}

	const handleLoadMore = () => {
		if (isLoadingMore || !hasMoreStations) return
		
		setIsLoadingMore(true)
		// 模拟异步加载更多数据
		setTimeout(() => {
			setIsLoadingMore(false)
			// 模拟加载3次后没有更多数据
			if (Math.random() > 0.6) {
				setHasMoreStations(false)
			}
			console.log('加载更多电站数据')
		}, 1500)
	}

  return (
    <View className='index'>
			<View className='top-bar'>
				<View className='city' onClick={() => setShowCitySelector(true)}>
					{currentCity}
				</View>
				<View className='search'>请输入目的地/电站名</View>
				<View className='extra'>
					<View className='star'>
						<Text className='star-icon'>⭐</Text>
						<Text>2.7</Text>
					</View>
					<View className='target'>
						🎯
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
				{/* 电站列表（根据筛选动态变化） */}
				{filteredStations.length === 0 ? (
					<View className='station-card card'>
						<Text className='station-title big'>暂无符合条件的电站</Text>
					</View>
				) : (
					<>
						<View className='station-list'>
							{filteredStations.map((s) => (
								<View className='station-card card' key={s._id}>
									<View className='card-header'>
										<View className='station-logo'>
											<View className='logo-circle'></View>
										</View>
										<View className='header-content'>
											<Text className='station-name'>{s.name}</Text>
											<View className='station-tags'>
												<Text className='tag'>对外开放</Text>
												{(s.operatingHours.open === '00:00' && s.operatingHours.close === '23:59') && (
													<Text className='tag'>24h营业</Text>
												)}
												{s.parkingFee === 0 && <Text className='tag'>免费停车</Text>}
												{s.chargers.some((c) => c.type === 'fast') && <Text className='tag'>快充</Text>}
											</View>
										</View>
										<View className='rating-badge'>
											<Text className='score'>营业中</Text>
											<Text className='rating-score'>10/10</Text>
										</View>
									</View>

									<View className='station-details'>
										<View className='detail-row'>
											<Text className='detail-icon'>🅿️</Text>
											<Text className='detail-text'>按实际场地收费标准收费</Text>
										</View>
										<View className='detail-row'>
											<Text className='detail-icon'>⚡</Text>
											<Text className='detail-text'>12小时内有人充电</Text>
											<Text className='status-text'>暂不可用</Text>
										</View>
									</View>

									<View className='station-bottom'>
										<View className='price-info'>
											<Text className='price-symbol'>¥</Text>
											<Text className='price-value'>{getDisplayPrice(s)}</Text>
											<Text className='price-unit'>元/度</Text>
										</View>
										<View className='distance-info' onClick={() => {
											const [lng, lat] = s.location.coordinates
											try {
												Taro.setStorageSync('map_target_coord', { lng, lat })
											} catch {}
											Taro.switchTab({ url: '/pages/map/index' })
										}}>
											<Text className='distance-dot'>●</Text>
											<Text className='distance-value'>{getDisplayDistance(s)}</Text>
										</View>
									</View>
								</View>
							))}
						</View>
						
						{/* 加载更多区域 */}
						<View className='load-more-container'>
							{isLoadingMore ? (
								<View className='loading-text'>正在加载更多电站</View>
							) : hasMoreStations ? (
								<View className='load-more-btn' onClick={handleLoadMore}>
									查看更多电站
								</View>
							) : (
								<View className='loading-text'>已显示全部电站</View>
							)}
						</View>
					</>
				)}
			</View>

			{/* 城市选择器 */}
			{showCitySelector && (
				<CitySelector
					currentCity={currentCity}
					onCityChange={setCurrentCity}
					onClose={() => setShowCitySelector(false)}
				/>
			)}
    </View>
  )
}
