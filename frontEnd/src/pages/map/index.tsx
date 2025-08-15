  
import Taro, { useLoad, getCurrentInstance, useDidShow } from '@tarojs/taro'
import { useMemo, useState } from 'react'
import Device from './device'
import './index.scss'

export default function Map() {
	// 同步读取（storage 优先，其次 query），避免首次渲染时拿不到坐标
	const initCoord = (() => {
		try {
			const cached = Taro.getStorageSync('map_target_coord') as any
			if (cached && typeof cached.lng === 'number' && typeof cached.lat === 'number') {
				Taro.removeStorageSync('map_target_coord')
				return { lng: cached.lng, lat: cached.lat } as { lng: number; lat: number }
			}
		} catch {}
		const inst = getCurrentInstance()
		const q = inst?.router?.params || {}
		const lng = q?.lng ? parseFloat(String(q.lng)) : undefined
		const lat = q?.lat ? parseFloat(String(q.lat)) : undefined
		if (Number.isFinite(lng) && Number.isFinite(lat)) {
			return { lng: lng as number, lat: lat as number }
		}
		return undefined
	})()

	const [coord, setCoord] = useState<{ lng: number; lat: number } | undefined>(initCoord)

	const parseParams = () => {
		const inst = getCurrentInstance()
		const q = inst?.router?.params || {}
		let lng = q?.lng ? parseFloat(String(q.lng)) : undefined
		let lat = q?.lat ? parseFloat(String(q.lat)) : undefined
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
			try {
				const cached = Taro.getStorageSync('map_target_coord') as any
				if (cached && typeof cached.lng === 'number' && typeof cached.lat === 'number') {
					lng = cached.lng
					lat = cached.lat
					Taro.removeStorageSync('map_target_coord')
				}
			} catch {}
		}
		if (Number.isFinite(lng) && Number.isFinite(lat)) {
			setCoord({ lng: lng as number, lat: lat as number })
		} else {
			setCoord(undefined)
		}
	}

  useLoad(() => {
		parseParams()
	})

	useDidShow(() => {
		parseParams()
	})

	const deviceKey = useMemo(() => (coord ? `${coord.lng},${coord.lat}` : 'auto'), [coord])

	return <Device key={deviceKey} initialCoord={coord} />
}