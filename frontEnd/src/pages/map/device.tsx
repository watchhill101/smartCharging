import { View, Text } from '@tarojs/components'
import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

interface DeviceProps {
  onBack?: () => void
}

export default function Device(props: DeviceProps) {
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const geolocationRef = useRef<any>(null)

  const refreshLocation = () => {
    if (geolocationRef.current) {
      geolocationRef.current.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete' && result?.position) {
          const { lng, lat } = result.position
          if (markerRef.current) {
            markerRef.current.setPosition([lng, lat])
            mapRef.current.setCenter([lng, lat])
          }
        }
      })
    }
  }

  useEffect(() => {
    // 仅 H5 环境启用
    // @ts-ignore
    if (process.env.TARO_ENV !== 'h5') return

    // 修复 meta 标签弃用警告
    const addMetaTag = () => {
      const name = 'mobile-web-app-capable'
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', 'yes')
    }
    addMetaTag()

    // 高德 JSAPI v2 安全密钥
    // @ts-ignore
    window._AMapSecurityConfig = { securityJsCode: '88a533ed5eb157250debf50883ccbe61' }

    let destroyed = false

    AMapLoader.load({
      key: 'fe211b3e07c4e9b86b16adfd57925547',
      version: '2.0',
      plugins: ['AMap.Geolocation']
    }).then((AMap) => {
      if (destroyed) return
      
      const map = new AMap.Map('amap-container', { zoom: 15 })
      mapRef.current = map

      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        showButton: false,
        showCircle: false,
        zoomToAccuracy: true,
        position: 'RB'
      })
      map.addControl(geolocation)
      geolocationRef.current = geolocation

      const setPoint = (lng: number, lat: number) => {
        if (!markerRef.current) {
          markerRef.current = new AMap.Marker({ 
            position: [lng, lat],
            icon: new AMap.Icon({
              size: new AMap.Size(32, 32),
              image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTIiIGZpbGw9IiMyMkM1NUUiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iNiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+'
            })
          })
          map.add(markerRef.current)
        } else {
          markerRef.current.setPosition([lng, lat])
        }
        map.setCenter([lng, lat])
      }

      // 获取用户当前位置
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete' && result?.position) {
          const { lng, lat } = result.position
          setPoint(lng, lat)
        }
      })
    })

    return () => {
      destroyed = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
      markerRef.current = null
      geolocationRef.current = null
    }
  }, [])

  return (
    <View className='device-page' style={{ background: '#ffffff', minHeight: '100vh' }}>
      <View
        style={{
          position: 'relative',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
        }}
      >
        <View
          onClick={() => props.onBack && props.onBack()}
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 28 }}>‹</Text>
        </View>
        <Text style={{ fontSize: 26, fontWeight: '800' }}>设备地图</Text>
      </View>

      <View style={{ padding: '0 16px', marginBottom: 8 }}>
        <View
          style={{
            height: 44,
            background: '#f2f3f5',
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
          }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 9, border: '2px solid #c8c9cc', marginRight: 8 }} />
          <Text style={{ color: '#a0a0a0' }}>请输入目的地/电站名</Text>
        </View>
      </View>

      <View style={{ padding: '16px', position: 'relative' }}>
        <View id='amap-container' style={{ width: '100%', height: '70vh', borderRadius: 8, overflow: 'hidden' }} />
        
        {/* 自定义定位控件 */}
        <View
          onClick={refreshLocation}
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: 48,
            height: 48,
            background: '#ffffff',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000
          }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, background: '#1890ff' }} />
        </View>
      </View>
    </View>
  )
} 