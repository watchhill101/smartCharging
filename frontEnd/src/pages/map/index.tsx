
import { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import Device from './device'
import './index.scss'

export default function Map() {
  useLoad(() => {
    console.log('地图页面加载')
  })
  const [showDevice, setShowDevice] = useState(false)

  if (showDevice) {
    return <Device onBack={() => setShowDevice(false)} />
  }

  return <Device onBack={() => setShowDevice(false)} />
} 