import Taro, { useLoad, getCurrentInstance, useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import Device from './device'
import './index.scss'

export default function Map() {
	// 同步读取（storage 优先，其次 query），避免首次渲染时拿不到坐标
	const initCoord = (() => {
		try {
			const cached = Taro.getStorageSync('map_target_coord') as any
			console.log('[Map] 初始化坐标数据:', cached)
			if (cached && typeof cached.lng === 'number' && typeof cached.lat === 'number') {
				Taro.removeStorageSync('map_target_coord')
				console.log('[Map] 从存储获取到坐标:', { lng: cached.lng, lat: cached.lat })
				return { lng: cached.lng, lat: cached.lat } as { lng: number; lat: number }
			}
		} catch (error) {
			console.error('[Map] 读取坐标存储失败:', error)
		}
		const inst = getCurrentInstance()
		const q = inst?.router?.params || {}
		const lng = q?.lng ? parseFloat(String(q.lng)) : undefined
		const lat = q?.lat ? parseFloat(String(q.lat)) : undefined
		console.log('[Map] 从路由参数获取坐标:', { lng, lat, params: q })
		if (Number.isFinite(lng) && Number.isFinite(lat)) {
			return { lng: lng as number, lat: lat as number }
		}
		return undefined
	})()

	const initStation = (() => {
		try {
			const cached = Taro.getStorageSync('map_target_station') as any
			console.log('[Map] 初始化站点数据:', cached)
			if (cached && cached.name) {
				Taro.removeStorageSync('map_target_station')
				console.log('[Map] 从存储获取到站点信息:', cached)
				return cached
			}
		} catch (error) {
			console.error('[Map] 读取站点存储失败:', error)
		}
		return undefined
	})()

	const [coord, setCoord] = useState<{ lng: number; lat: number } | undefined>(initCoord)
	const [stationInfo, setStationInfo] = useState<any>(initStation)

	// 添加调试日志
	console.log('[Map] 当前状态:', { coord, stationInfo })

	const parseParams = () => {
		console.log('[Map] 开始解析参数...')
		const inst = getCurrentInstance()
		const q = inst?.router?.params || {}
		let lng = q?.lng ? parseFloat(String(q.lng)) : undefined
		let lat = q?.lat ? parseFloat(String(q.lat)) : undefined
		let station = undefined
		
		console.log('[Map] 路由参数:', q)
		console.log('[Map] 解析的坐标:', { lng, lat })
		
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
			try {
				const cached = Taro.getStorageSync('map_target_coord') as any
				console.log('[Map] 从存储重新获取坐标:', cached)
				if (cached && typeof cached.lng === 'number' && typeof cached.lat === 'number') {
					lng = cached.lng
					lat = cached.lat
					Taro.removeStorageSync('map_target_coord')
					console.log('[Map] 使用存储的坐标:', { lng, lat })
				}
			} catch (error) {
				console.error('[Map] 重新获取坐标失败:', error)
			}
		}
		
		try {
			const cachedStation = Taro.getStorageSync('map_target_station') as any
			console.log('[Map] 从存储重新获取站点:', cachedStation)
			if (cachedStation && cachedStation.name) {
				station = cachedStation
				Taro.removeStorageSync('map_target_station')
				console.log('[Map] 使用存储的站点信息:', station)
			}
		} catch (error) {
			console.error('[Map] 重新获取站点失败:', error)
		}
		
		console.log('[Map] 最终解析结果:', { lng, lat, station })
		
		if (Number.isFinite(lng) && Number.isFinite(lat)) {
			setCoord({ lng: lng as number, lat: lat as number })
		} else {
			setCoord(undefined)
		}
		setStationInfo(station)
	}

  useLoad(() => {
		parseParams()
	})

	useDidShow(() => {
		parseParams()
	})

	const deviceKey = useMemo(() => (coord ? `${coord.lng},${coord.lat}` : 'auto'), [coord])

	return <Device key={deviceKey} initialCoord={coord} stationInfo={stationInfo} />
}