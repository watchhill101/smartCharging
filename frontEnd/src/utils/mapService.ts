import AMapLoader from '@amap/amap-jsapi-loader'

let AMapCache: any | null = null

export async function loadAMap(): Promise<any> {
	if (AMapCache) return AMapCache
	// @ts-ignore
	;(window as any)._AMapSecurityConfig = { securityJsCode: '88a533ed5eb157250debf50883ccbe61' }
	AMapCache = await AMapLoader.load({
		key: 'fe211b3e07c4e9b86b16adfd57925547',
		version: '2.0',
		plugins: ['AMap.Geocoder', 'AMap.Geolocation']
	})
	return AMapCache
}

export async function createMap(containerId: string, options?: any) {
	const AMap = await loadAMap()
	const map = new AMap.Map(containerId, {
		zoom: 15,
		viewMode: '3D',
		renderOptions: { preserveDrawingBuffer: true },
		...options,
	})
	return map
}

export async function geocodeByName(name: string, city?: string, timeoutMs = 20000): Promise<{ lng: number; lat: number; address?: string }> {
	const AMap = await loadAMap()
	return await new Promise((resolve, reject) => {
		const geocoder = new AMap.Geocoder({ city: city || '全国' })
		let finished = false
		const timer = window.setTimeout(() => {
			if (!finished) {
				finished = true
				reject(new Error('geocode timeout'))
			}
		}, timeoutMs)
		geocoder.getLocation(name, (status: string, result: any) => {
			if (finished) return
			finished = true
			window.clearTimeout(timer)
			if (status === 'complete' && result?.geocodes?.length) {
				const g = result.geocodes[0]
				resolve({ lng: g.location.lng, lat: g.location.lat, address: g.formattedAddress })
			} else {
				reject(new Error('geocode failed'))
			}
		})
	})
}

export async function getCurrentPosition(timeoutMs = 20000): Promise<{ lng: number; lat: number }> {
	const AMap = await loadAMap()
	return await new Promise((resolve, reject) => {
		try {
			const geo = new AMap.Geolocation({ enableHighAccuracy: true, timeout: timeoutMs, showButton: false, showCircle: false })
			geo.getCurrentPosition((status: string, result: any) => {
				if (status === 'complete' && result?.position) {
					return resolve({ lng: result.position.lng, lat: result.position.lat })
				}
				reject(new Error('amap geolocation failed'))
			})
		} catch (e) {
			reject(e)
		}
	})
}

export function ensureMarker(map: any, existing: any, lng: number, lat: number) {
	if (!existing) {
		// @ts-ignore
		existing = new (window as any).AMap.Marker({ position: [lng, lat] })
		map.add(existing)
	} else {
		existing.setPosition([lng, lat])
	}
	map.setZoom(16)
	map.setCenter([lng, lat])
	return existing
} 