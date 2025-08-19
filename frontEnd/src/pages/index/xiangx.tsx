import { View, Text, Button } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import stationDetailsData from '../../data/stationDetails.json'
import commentsData from '../../data/comments.json'
import './xiangx.scss'

// 充电站详情接口
interface ChargingStationDetail {
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

// 终端状态枚举
enum TerminalStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

// 充电类型枚举
enum ChargerType {
  FAST = 'fast',
  SLOW = 'slow'
}

// 页面状态接口
interface PageState {
  isLoading: boolean
  error: string | null
  refreshing: boolean
}

// 评论接口
interface Comment {
  id: string
  user: string
  avatar: string
  content: string
  rating: number
  time: string
  likes: number
}

// 照片接口
interface Photo {
  id: string
  url: string
  thumbnail: string
  uploadTime: string
  userId: string
}

// 地图选择器数据
interface MapApp {
  name: string
  icon: string
  action: () => void
}

export default function Xiangx() {
  // 状态管理
  const [activeTab, setActiveTab] = useState<'info' | 'terminals' | 'reviews'>('info')
  const [showMapSelectorModal, setShowMapSelectorModal] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [userRating, setUserRating] = useState(5)
  const [comments, setComments] = useState<Comment[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [pageState, setPageState] = useState<PageState>({
    isLoading: false,
    error: null,
    refreshing: false
  })
  const [favorites, setFavorites] = useState(false)

  // 获取当前充电站ID - 直接从页面参数获取
  const [currentStationId, setCurrentStationId] = useState('cs001')
  const [isDataLoading, setIsDataLoading] = useState(true)

  // 页面生命周期 - 优化数据接收逻辑
  useLoad((options) => {
    if (options?.stationId) {
      setCurrentStationId(options.stationId)
      setIsDataLoading(false)
      setPageState(prev => ({ ...prev, isLoading: false }))
    } else {
      // 备用方案1: 从URL获取参数
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search)
        const stationIdFromUrl = urlParams.get('stationId')
        if (stationIdFromUrl) {
          setCurrentStationId(stationIdFromUrl)
          setIsDataLoading(false)
          setPageState(prev => ({ ...prev, isLoading: false }))
          return
        }
      }
      
      // 备用方案2: 从localStorage获取
      try {
        const selectedStation = localStorage.getItem('selected_station')
        if (selectedStation) {
          const stationData = JSON.parse(selectedStation)
          if (stationData._id) {
            setCurrentStationId(stationData._id)
            setIsDataLoading(false)
            setPageState(prev => ({ ...prev, isLoading: false }))
            return
          }
        }
      } catch (error) {
        // 忽略错误
      }
      
      // 备用方案3: 使用默认值
      setCurrentStationId('cs001')
      setIsDataLoading(false)
      setPageState(prev => ({ ...prev, isLoading: false }))
    }
  })

  // 页面显示时刷新数据
  useDidShow(() => {
    if (!isDataLoading) {
      // 并行加载数据，提升性能
      Promise.all([
        loadCommentsFromStorage(),
        loadFavoriteStatus(),
        loadPhotosFromStorage()
      ]).then(() => {
        // 确保页面状态为已加载
        setPageState(prev => ({ ...prev, isLoading: false }))
      }).catch(error => {
        console.error('❌ 数据加载失败:', error)
        // 即使失败也要显示页面
        setPageState(prev => ({ ...prev, isLoading: false }))
      })
    }
  })

  // 重新加载数据
  const reloadData = useCallback(async () => {
    try {
      setPageState(prev => ({ ...prev, refreshing: true, isLoading: false }))
      await Promise.all([
        loadCommentsFromStorage(),
        loadFavoriteStatus(),
        loadPhotosFromStorage()
      ])
    } catch (error) {
      console.error('❌ 数据重载失败:', error)
    } finally {
      setPageState(prev => ({ ...prev, refreshing: false, isLoading: false }))
    }
  }, [])

    // 创建充电站数据索引，提升查找效率
  const stationDataIndex = useMemo(() => {
    const index: Record<string, ChargingStationDetail> = {}
    stationDetailsData.forEach(station => {
      index[station._id] = station as unknown as ChargingStationDetail
    })
    return index
  }, [])

  // 预加载评论数据，提升访问速度
  const commentsIndex = useMemo(() => {
    return commentsData
  }, [])

  // 获取充电站详情数据 - 优化后的查找逻辑
  const mockStationData: ChargingStationDetail = useMemo(() => {
    if (isDataLoading) {
      return stationDetailsData[0] as unknown as ChargingStationDetail
    }
    
    // 使用索引直接查找，提升性能
    const station = stationDataIndex[currentStationId]
    
    if (station) {
      return station
      } else {
      // 如果找不到，返回第一个充电站作为默认值
      return stationDetailsData[0] as unknown as ChargingStationDetail
    }
  }, [currentStationId, isDataLoading, stationDataIndex])

  // 获取评论数据 - 使用预加载索引的优化逻辑
  const initialComments: Comment[] = useMemo(() => {
    if (isDataLoading) {
      return []
    }

    const stationComments = commentsIndex[currentStationId] || []
    return stationComments
  }, [currentStationId, isDataLoading, commentsIndex])

  // 保存评论到本地存储
  const saveCommentsToStorage = useCallback((newComments: Comment[]) => {
    try {
      const key = `comments_${currentStationId}`
      if (typeof Taro.setStorageSync === 'function') {
        Taro.setStorageSync(key, newComments)
      } else {
        localStorage.setItem(key, JSON.stringify(newComments))
      }
    } catch (error) {
      console.error('❌ 保存评论失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'error' })
    }
  }, [currentStationId])

  // 从本地存储加载评论 - 优化后的加载逻辑
  const loadCommentsFromStorage = useCallback(async () => {
    if (isDataLoading) {
      return
    }

    try {
      let storedComments: Comment[] = []
      const key = `comments_${currentStationId}`
      
      if (typeof Taro.getStorageSync === 'function') {
        storedComments = Taro.getStorageSync(key) || []
        } else {
        const raw = localStorage.getItem(key)
        if (raw) {
          try {
            storedComments = JSON.parse(raw)
          } catch (parseError) {
            storedComments = []
          }
        }
      }
      
      // 合并本地存储的评论和初始评论数据，避免重复
      const allComments = [...initialComments, ...storedComments]
      const uniqueComments = allComments.filter((comment, index, self) => 
        index === self.findIndex(c => c.id === comment.id)
      )
      
      // 按时间排序，最新的在前面
      const sortedComments = uniqueComments.sort((a, b) => {
        const timeA = new Date(a.time).getTime()
        const timeB = new Date(b.time).getTime()
        return timeB - timeA
      })
      
      setComments(sortedComments)
    } catch (error) {
      console.error('❌ 加载评论失败:', error)
      setComments(initialComments)
    }
  }, [currentStationId, initialComments, isDataLoading])

  // 加载收藏状态 - 优化后的加载逻辑
  const loadFavoriteStatus = useCallback(async () => {
    if (isDataLoading) {
      return
    }

    try {
      const key = `favorite_${currentStationId}`
      let isFavorite = false
      
      if (typeof Taro.getStorageSync === 'function') {
        isFavorite = !!Taro.getStorageSync(key)
      } else {
        isFavorite = localStorage.getItem(key) === 'true'
      }
      
      setFavorites(isFavorite)
    } catch (error) {
      console.error('❌ 加载收藏状态失败:', error)
    }
  }, [currentStationId, isDataLoading])

  // 切换收藏状态
  const toggleFavorite = useCallback(async () => {
    try {
      const key = `favorite_${currentStationId}`
      const newFavoriteState = !favorites
      
      if (typeof Taro.setStorageSync === 'function') {
        if (newFavoriteState) {
          Taro.setStorageSync(key, true)
        } else {
          Taro.removeStorageSync(key)
        }
      } else {
        if (newFavoriteState) {
          localStorage.setItem(key, 'true')
        } else {
          localStorage.removeItem(key)
        }
      }
      
      setFavorites(newFavoriteState)
      
      // 显示收藏状态提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ 
            title: newFavoriteState ? '已收藏' : '已取消收藏', 
            icon: 'success' 
        })
      } else {
          alert(newFavoriteState ? '已收藏' : '已取消收藏')
        }
      } catch (error) {
        alert(newFavoriteState ? '已收藏' : '已取消收藏')
      }
    } catch (error) {
      console.error('❌ 切换收藏状态失败:', error)
      
      // 显示操作失败提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '操作失败', icon: 'error' })
        } else {
          alert('操作失败')
        }
      } catch (error) {
        alert('操作失败')
      }
    }
  }, [favorites, currentStationId])

  // 打开地图选择器
  const openMapSelectorModal = useCallback(() => {
    setShowMapSelectorModal(true)
  }, [])

  // 关闭地图选择器
  const closeMapSelector = useCallback(() => {
    setShowMapSelectorModal(false)
  }, [])

  // 处理地图选择
  const handleMapSelection = useCallback((mapType: string) => {
    closeMapSelector()
    
    const { coordinates } = mockStationData.location
    const [lng, lat] = coordinates
    const stationName = mockStationData.name



    switch (mapType) {
      case 'gaode':
        openMapWithUniversalLink('gaode', lng, lat, stationName)
              break
      case 'baidu':
        openMapWithUniversalLink('baidu', lng, lat, stationName)
              break
      case 'tencent':
        openMapWithUniversalLink('tencent', lng, lat, stationName)
              break
      default:
        // 默认使用Taro.openLocation
        if (typeof Taro.openLocation === 'function') {
          Taro.openLocation({
            latitude: lat,
            longitude: lng,
            name: stationName,
            address: mockStationData.address,
            success: () => {},
            fail: (error) => {
              console.error('❌ 地图打开失败:', error)
              openMapInBrowser(lng, lat, stationName)
            }
          })
        } else {
          // 降级到浏览器打开
          openMapInBrowser(lng, lat, stationName)
        }
    }
  }, [mockStationData, closeMapSelector])

  // 使用通用链接打开地图
  const openMapWithUniversalLink = useCallback((mapType: string, lng: number, lat: number, name: string) => {
    const mapUrls = {
      gaode: `amapuri://route/plan/?sid=BGVIS1&slat=${lat}&slon=${lng}&sname=${encodeURIComponent(name)}&did=BGVIS2&dlat=${lat}&dlon=${lng}&dname=${encodeURIComponent(name)}&dev=0&t=0`,
      baidu: `baidumap://map/direction?destination=latlng:${lat},${lng}|name:${encodeURIComponent(name)}&mode=driving&src=ios.baidu.openAPIdemo`,
      tencent: `qqmap://map/routeplan?type=drive&to=${encodeURIComponent(name)}&tocoord=${lat},${lng}&referer=myapp`
    }

    const url = mapUrls[mapType as keyof typeof mapUrls]
    
    if (url) {
      try {

        // 尝试打开原生应用
        try {
          // @ts-ignore - Taro.openUrl 在某些环境下可能不存在
          if (typeof Taro.openUrl === 'function') {
            // @ts-ignore
            Taro.openUrl({
              url,
              success: () => {},
              fail: () => {
                openMapInBrowser(lng, lat, name, mapType)
              }
            })
          } else {
            // 降级到浏览器打开
            openMapInBrowser(lng, lat, name, mapType)
          }
        } catch (apiError) {
          console.warn('Taro.openUrl API 不可用，使用浏览器打开')
          openMapInBrowser(lng, lat, name, mapType)
      }
    } catch (error) {
        console.error(`❌ 打开${mapType}地图失败:`, error)
        openMapInBrowser(lng, lat, name, mapType)
      }
    } else {
      openMapInBrowser(lng, lat, name, mapType)
    }
  }, [])

  // 在浏览器中打开地图
  const openMapInBrowser = useCallback((lng: number, lat: number, name: string, mapType: string = 'gaode') => {
    const browserUrls = {
      gaode: `https://uri.amap.com/navigation?to=${lng},${lat},${encodeURIComponent(name)}&mode=car&policy=1&src=mypage&coordinate=gaode&callnative=0`,
      baidu: `https://map.baidu.com/mobile/webapp/direction?origin=我的位置&destination=${encodeURIComponent(name)}&coord_type=bd09ll&dest_coord=${lat},${lng}&mode=driving`,
      tencent: `https://apis.map.qq.com/tools/routeplan?type=drive&to=${encodeURIComponent(name)}&tocoord=${lat},${lng}&referer=myapp`
    }

    const url = browserUrls[mapType as keyof typeof browserUrls] || browserUrls.gaode
    
    try {

      window.open(url, '_blank')
      Taro.showToast({ title: '正在打开地图...', icon: 'loading' })
    } catch (error) {
      console.error('❌ 浏览器打开地图失败:', error)
      Taro.showToast({ title: '打开地图失败', icon: 'error' })
    }
  }, [])

  // 显示坐标信息
  const showCoordinateInfo = () => {
    const { coordinates } = mockStationData.location
    const [lng, lat] = coordinates
    Taro.showModal({
      title: '坐标信息',
      content: `经度: ${lng}\n纬度: ${lat}\n地址: ${mockStationData.address}`,
      showCancel: false
    })
  }

  // 处理返回
  const handleGoBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack({
          fail: () => {
            // 如果返回失败，尝试切换到首页
            if (typeof Taro.switchTab === 'function') {
              Taro.switchTab({ url: '/pages/index/index' })
      } else {
              fallbackBack()
            }
          }
        })
      } else {
        fallbackBack()
      }
    } catch (error) {
      console.error('返回失败:', error)
      fallbackBack()
    }
  }

  // 备选返回方案
  const fallbackBack = () => {
    try {
      if (window.history.length > 1) {
        window.history.back()
      } else if (window.location.hash) {
        window.location.hash = '#/pages/index/index'
      } else {
        window.location.href = '/pages/index/index'
      }
    } catch (error) {
      console.error('备选返回方案失败:', error)
      // 最后的备选方案
      try {
        window.location.href = '/'
      } catch (finalError) {
        console.error('最终返回方案失败:', finalError)
      }
    }
  }

  // 打开评论区
  const openComments = useCallback(() => {
    setShowComments(true)
  }, [])

  // 关闭评论区
  const closeComments = useCallback(() => {
    setShowComments(false)
    setCommentText('')
    setUserRating(5)
  }, [])

  // 提交评论
  const submitComment = useCallback(() => {
    if (!commentText.trim()) {
    try {
      if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '请输入评论内容', icon: 'none' })
      } else {
          alert('请输入评论内容')
      }
    } catch (error) {
        alert('请输入评论内容')
    }
      return
  }

    if (commentText.trim().length < 5) {
    try {
      if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '评论内容至少需要5个字符', icon: 'none' })
      } else {
          alert('评论内容至少需要5个字符')
      }
    } catch (error) {
        alert('评论内容至少需要5个字符')
    }
      return
  }

    if (userRating < 1) {
    try {
      if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '请选择评分', icon: 'none' })
      } else {
          alert('请选择评分')
      }
    } catch (error) {
        alert('请选择评分')
      }
      return
    }

    try {
      const newComment: Comment = {
        id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user: '我',
        avatar: '👤',
        content: commentText.trim(),
        rating: userRating,
        time: new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        likes: 0
      }

      const newComments = [newComment, ...comments]
      setComments(newComments)
      saveCommentsToStorage(newComments)
      setCommentText('')
      setUserRating(5)
      
      // 显示成功提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '评论发布成功', icon: 'success' })
        } else {
          alert('评论发布成功')
        }
      } catch (error) {
        alert('评论发布成功')
      }
      
      // 关闭评论模态框
      setTimeout(() => {
        setShowComments(false)
      }, 1500)
    } catch (error) {
      console.error('❌ 评论发布失败:', error)
      
      // 显示错误提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '发布失败，请重试', icon: 'error' })
        } else {
          alert('发布失败，请重试')
        }
      } catch (error) {
        alert('发布失败，请重试')
      }
    }
  }, [commentText, userRating, comments, saveCommentsToStorage])

  // 点赞评论
  const likeComment = useCallback((commentId: string) => {
    try {
      const newComments = comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, likes: comment.likes + 1 }
          : comment
      )
      setComments(newComments)
      saveCommentsToStorage(newComments)
      
      // 显示点赞成功提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '点赞成功', icon: 'success', duration: 1000 })
      } else {

        }
      } catch (error) {
        console.log('👍 点赞成功')
      }
      

    } catch (error) {
      console.error('❌ 点赞失败:', error)
      
      // 显示点赞失败提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '点赞失败', icon: 'error' })
        } else {
          console.error('点赞失败')
        }
      } catch (error) {
        console.error('点赞失败')
      }
    }
  }, [comments, saveCommentsToStorage])



  // 保存照片到本地存储
  const savePhotosToStorage = useCallback((newPhotos: Photo[]) => {
    try {
      const key = `photos_${currentStationId}`
            if (typeof Taro.setStorageSync === 'function') {
        Taro.setStorageSync(key, newPhotos)
      } else {
        localStorage.setItem(key, JSON.stringify(newPhotos))
      }

    } catch (error) {
      console.error('❌ 保存照片失败:', error)
      
      // 显示保存失败提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '保存失败', icon: 'error' })
        } else {
          alert('保存失败')
      }
    } catch (error) {
        alert('保存失败')
      }
    }
  }, [currentStationId])

  // 从本地存储加载照片 - 优化后的加载逻辑
  const loadPhotosFromStorage = useCallback(async () => {
    if (isDataLoading) {
      return
    }

    try {
      let storedPhotos: Photo[] = []
      const key = `photos_${currentStationId}`
      
      if (typeof Taro.getStorageSync === 'function') {
        storedPhotos = Taro.getStorageSync(key) || []
      } else {
        const raw = localStorage.getItem(key)
        if (raw) {
          try {
            storedPhotos = JSON.parse(raw)
          } catch (parseError) {
            storedPhotos = []
          }
        }
      }
      
      // 确保每个照片对象都有必要的属性
      const validPhotos = storedPhotos.filter(photo => 
        photo && photo.id && photo.url && photo.uploadTime
      )
      
      // 按上传时间排序，最新的在前面
      const sortedPhotos = validPhotos.sort((a, b) => {
        const timeA = new Date(a.uploadTime).getTime()
        const timeB = new Date(b.uploadTime).getTime()
        return timeB - timeA
      })
      
      setPhotos(sortedPhotos)
    } catch (error) {
      console.error('❌ 加载照片失败:', error)
      setPhotos([])
    }
  }, [currentStationId, isDataLoading])

  // 拍照功能
  const takePhoto = useCallback(() => {
    try {
      // 检查 Taro.chooseImage API
      if (typeof Taro.chooseImage === 'function') {
        Taro.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['camera'],
          success: (res) => {
            const tempFilePath = res.tempFilePaths[0]
            if (tempFilePath) {
              // 生成照片数据
              const newPhoto: Photo = {
                id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: tempFilePath,
                thumbnail: tempFilePath,
                uploadTime: new Date().toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                }),
                userId: 'current_user'
              }

              const newPhotos = [newPhoto, ...photos]
              setPhotos(newPhotos)
              savePhotosToStorage(newPhotos)
              
                            // 显示拍照成功提示
              try {
                if (typeof Taro.showToast === 'function') {
                  Taro.showToast({ title: '拍照成功', icon: 'success' })
            } else {
                  alert('拍照成功')
            }
              } catch (error) {
                alert('拍照成功')
          }
            }
          },
          fail: (error) => {
            console.error('❌ 拍照失败:', error)
          
            // 显示拍照失败提示
            try {
          if (typeof Taro.showToast === 'function') {
                Taro.showToast({ title: '拍照失败，请重试', icon: 'error' })
          } else {
                alert('拍照失败，请重试')
          }
            } catch (error) {
              alert('拍照失败，请重试')
        }
          }
        })
      } else {
        // Web环境降级处理
        handleWebCamera()
      }
    } catch (error) {
      console.error('❌ 拍照功能调用失败:', error)
      
      // 显示拍照功能不可用提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '拍照功能不可用', icon: 'error' })
        } else {
          alert('拍照功能不可用')
        }
      } catch (error) {
        alert('拍照功能不可用')
      }
    }
  }, [photos, savePhotosToStorage, mockStationData._id])

  // Web环境相机处理
  const handleWebCamera = useCallback(() => {
    try {
      // 创建文件输入元素
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
      input.capture = 'environment' // 使用后置摄像头
        
        input.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0]
          if (file) {
          // 创建文件URL
          const url = URL.createObjectURL(file)
          
          // 生成照片数据
          const newPhoto: Photo = {
            id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: url,
            thumbnail: url,
            uploadTime: new Date().toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }),
            userId: 'current_user'
          }

          const newPhotos = [newPhoto, ...photos]
          setPhotos(newPhotos)
          savePhotosToStorage(newPhotos)
          // 显示拍照成功提示
          try {
            if (typeof Taro.showToast === 'function') {
              Taro.showToast({ title: '拍照成功', icon: 'success' })
            } else {
              alert('拍照成功')
            }
          } catch (error) {
            alert('拍照成功')
          }
        }
      }
      
      // 模拟点击
        input.click()
    } catch (error) {
      console.error('❌ Web拍照失败:', error)
      
      // 显示拍照失败提示
      try {
      if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '拍照失败', icon: 'error' })
      } else {
          alert('拍照失败')
        }
      } catch (error) {
        alert('拍照失败')
      }
    }
  }, [photos, savePhotosToStorage])

  // 删除照片
  const deletePhoto = useCallback((photoId: string) => {
    try {
      // 执行删除逻辑的函数
      const performDelete = () => {
        const newPhotos = photos.filter(photo => photo.id !== photoId)
        
        setPhotos(newPhotos)
        savePhotosToStorage(newPhotos)
        
        // 显示删除成功提示
    try {
      if (typeof Taro.showToast === 'function') {
            Taro.showToast({ title: '删除成功', icon: 'success' })
          } else {
            // Web环境降级处理

            alert('照片删除成功')
          }
        } catch (toastError) {

          alert('照片删除成功')
        }
      }

      // 尝试使用Taro的模态框
      if (typeof Taro.showModal === 'function') {
        Taro.showModal({
          title: '确认删除',
          content: '确定要删除这张照片吗？',
          success: (res) => {
            if (res.confirm) {
              performDelete()
            }
          },
          fail: () => {
            console.error('❌ 显示删除确认框失败，直接删除')
            performDelete()
          }
        })
      } else {
        // Web环境降级处理 - 使用浏览器原生confirm
        try {
          const confirmed = window.confirm('确定要删除这张照片吗？')
          if (confirmed) {
            performDelete()
          }
        } catch (confirmError) {
          console.error('❌ 浏览器confirm不可用，直接删除')
          performDelete()
        }
      }
    } catch (error) {
      console.error('❌ 删除照片失败:', error)
      
      // 显示错误提示
    try {
      if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '删除失败', icon: 'error' })
      } else {
          console.error('删除失败:', error)
          alert('删除失败，请重试')
        }
      } catch (toastError) {
        console.error('删除失败:', error)
        alert('删除失败，请重试')
      }
    }
  }, [photos, savePhotosToStorage])

  // 预览照片
  const previewPhoto = useCallback((photoUrl: string, allPhotos: Photo[]) => {
    try {
      const urls = allPhotos.map(photo => photo.url)
      const current = photoUrl
      
      if (typeof Taro.previewImage === 'function') {
        Taro.previewImage({
          urls: urls,
          current: current,
          success: () => console.log('✅ 照片预览打开成功'),
          fail: (error) => {
            console.error('❌ 照片预览失败:', error)
            // 降级到新窗口打开
            window.open(photoUrl, '_blank')
          }
        })
      } else {
        // Web环境降级处理
        window.open(photoUrl, '_blank')
      }
    } catch (error) {
      console.error('❌ 预览照片失败:', error)
      
      // 显示预览失败提示
      try {
        if (typeof Taro.showToast === 'function') {
          Taro.showToast({ title: '预览失败', icon: 'error' })
        } else {
          alert('预览失败')
        }
      } catch (error) {
        alert('预览失败')
      }
    }
  }, [])

  // 分享充电站
  const shareStation = useCallback(() => {
    try {
      const shareData = {
        title: `${mockStationData.name} - 智能充电`,
        desc: `评分${mockStationData.rating}⭐ | ${mockStationData.operator}运营`,
        path: `/pages/index/xiangx?stationId=${mockStationData._id}`,
        imageUrl: 'https://via.placeholder.com/300x200/667eea/ffffff?text=充电站'
      }

      try {
        // @ts-ignore - Taro.share 在某些环境下可能不存在
        if (typeof Taro.share === 'function') {
          // @ts-ignore
          Taro.share(shareData)
        } else {
          // Web环境下的分享
          handleWebShare(shareData)
        }
      } catch (shareError) {
        console.warn('Taro.share API 不可用，使用Web分享')
        handleWebShare(shareData)
        }
      } catch (error) {
      console.error('❌ 分享失败:', error)
      Taro.showToast({ title: '分享失败', icon: 'error' })
    }
  }, [mockStationData])

  // Web环境分享处理
  const handleWebShare = useCallback((shareData: any) => {
    try {
      if (navigator.share) {
        navigator.share({
          title: shareData.title,
          text: shareData.desc,
          url: window.location.href
        })
      } else {
        // 复制到剪贴板
        navigator.clipboard?.writeText(`${shareData.title}\n${shareData.desc}\n${window.location.href}`)
        Taro.showToast({ title: '链接已复制到剪贴板', icon: 'success' })
      }
    } catch (webShareError) {
      console.error('Web分享失败:', webShareError)
      Taro.showToast({ title: '分享失败', icon: 'error' })
    }
  }, [])

  // 处理终端选择
  const handleSelectTerminal = (charger: any) => {
    const terminalInfo = {
      stationId: mockStationData._id,
      stationName: mockStationData.name,
      chargerId: charger.chargerId,
      chargerType: charger.type,
      chargerPower: charger.power,
      pricePerKwh: (charger.pricing.electricityFee + charger.pricing.serviceFee).toFixed(4),
      currentPeriod: `${mockStationData.operatingHours.open}-${mockStationData.operatingHours.close}`
    }

    try {
      if (typeof Taro.setStorageSync === 'function') {
        Taro.setStorageSync('selected_terminal', terminalInfo)
      } else {
        localStorage.setItem('selected_terminal', JSON.stringify(terminalInfo))
      }
      
      Taro.navigateTo({ url: '/pages/charging/start/index' })
    } catch (error) {
      console.error('选择终端失败:', error)
      Taro.showToast({ title: '选择失败，请重试', icon: 'none' })
    }
  }

  // 地图选择器数据
  const mapSelectorData: MapApp[] = useMemo(() => [
    {
      name: '高德地图',
      icon: '🗺️',
      action: () => handleMapSelection('gaode')
    },
    {
      name: '百度地图',
      icon: '📍',
      action: () => handleMapSelection('baidu')
    },
    {
      name: '腾讯地图',
      icon: '🎯',
      action: () => handleMapSelection('tencent')
    }
  ], [handleMapSelection])

  // 计算充电站统计信息
  const stationStats = useMemo(() => {
    const availableChargers = mockStationData.chargers.filter(c => c.status === TerminalStatus.AVAILABLE).length
    const fastChargers = mockStationData.chargers.filter(c => c.type === ChargerType.FAST).length
    const slowChargers = mockStationData.chargers.filter(c => c.type === ChargerType.SLOW).length
    const averagePrice = mockStationData.chargers.reduce((sum, c) => 
      sum + c.pricing.electricityFee + c.pricing.serviceFee, 0
    ) / mockStationData.chargers.length

    return {
      totalChargers: mockStationData.chargers.length,
      availableChargers,
      fastChargers,
      slowChargers,
      averagePrice: averagePrice.toFixed(4),
      occupancyRate: ((mockStationData.chargers.length - availableChargers) / mockStationData.chargers.length * 100).toFixed(1)
    }
  }, [mockStationData.chargers])

  // 格式化营业时间
  const formattedOperatingHours = useMemo(() => {
    const { open, close } = mockStationData.operatingHours
    if (open === '00:00' && close === '24:00') {
      return '24小时营业'
    }
    return `${open} - ${close}`
  }, [mockStationData.operatingHours])

  // 判断是否在营业时间内
  const isOperating = useMemo(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentTime = currentHour * 60 + currentMinute

    const { open, close } = mockStationData.operatingHours
    const [openHour, openMinute] = open.split(':').map(Number)
    const [closeHour, closeMinute] = close.split(':').map(Number)
    
    const openTime = openHour * 60 + openMinute
    const closeTime = closeHour * 60 + closeMinute

    if (open === '00:00' && close === '24:00') return true
    if (closeTime > openTime) {
      return currentTime >= openTime && currentTime <= closeTime
    } else {
      return currentTime >= openTime || currentTime <= closeTime
    }
  }, [mockStationData.operatingHours])

  // 加载状态组件
  const LoadingScreen = () => (
    <View className='loading-screen'>
      <View className='loading-content'>
        <View className='loading-spinner'></View>
        <Text className='loading-text'>加载中...</Text>
        </View>
        </View>
  )

  // 错误状态组件
  const ErrorScreen = () => (
    <View className='error-screen'>
      <View className='error-content'>
        <Text className='error-icon'>😕</Text>
        <Text className='error-text'>{pageState.error}</Text>
        <Button className='retry-btn' onClick={reloadData}>重试</Button>
          </View>
          </View>
  )

  if (pageState.isLoading) {
    return <LoadingScreen />
  }

  if (pageState.error) {
    return <ErrorScreen />
  }

  return (
    <View className='xiangx-page'>
            {/* 头部导航 */}
      <View className='header'>
        <View className='back-btn' onClick={handleGoBack}>
          <Text className='back-icon'>‹</Text>
          </View>
        <Text className='title'>充电站详情</Text>
        <View className='header-actions'>
          <View className='action-btn' onClick={shareStation}>
            <Text className='action-icon'>📤</Text>
          </View>
          <View className={`action-btn ${favorites ? 'favorited' : ''}`} onClick={toggleFavorite}>
            <Text className='action-icon'>{favorites ? '❤️' : '🤍'}</Text>
          </View>
        </View>
      </View>



      {/* 主要内容区域 */}
      <View className='main-content'>
      {/* 充电站信息卡片 */}
        <View className='station-card'>
        <View className='station-header'>
          <Text className='station-name'>{mockStationData.name}</Text>
          <View className='station-rating'>
            <Text className='rating-score'>{mockStationData.rating}</Text>
            <Text className='rating-star'>⭐</Text>
            <Text className='review-count'>({mockStationData.reviewCount}条评价)</Text>
          </View>
        </View>

        <View className='station-info'>
          <View className='info-item'>
            <Text className='info-label'>运营商</Text>
            <Text className='info-value'>{mockStationData.operator}</Text>
          </View>
          <View className='info-item'>
            <Text className='info-label'>营业时间</Text>
            <View className='info-value-with-status'>
              <Text className='info-value'>{formattedOperatingHours}</Text>
              <Text className={`status-badge ${isOperating ? 'operating' : 'closed'}`}>
                {isOperating ? '营业中' : '已关闭'}
              </Text>
            </View>
            </View>
          <View className='info-item'>
            <Text className='info-label'>停车费</Text>
            <Text className='info-value'>{mockStationData.parkingFee === 0 ? '免费' : `¥${mockStationData.parkingFee}/小时`}</Text>
          </View>
          <View className='info-item'>
            <Text className='info-label'>充电终端</Text>
            <Text className='info-value'>
              共{stationStats.totalChargers}个 (可用{stationStats.availableChargers}个)
            </Text>
          </View>
          <View className='info-item'>
            <Text className='info-label'>平均价格</Text>
            <Text className='info-value price-highlight'>¥{stationStats.averagePrice}/度</Text>
          </View>
        </View>

        <View className='station-actions'>
          <Button className='action-btn navigate-btn' onClick={openMapSelectorModal}>
            <Text className='btn-icon'>🧭</Text>
            <Text className='btn-text'>导航</Text>
          </Button>
          <View className='action-btn rating-section' onClick={openComments}>
            <Text className='btn-icon'>⭐</Text>
            <Text className='btn-text'>用户评价</Text>
          </View>
        </View>
      </View>

      {/* 标签页 */}
      <View className='tabs'>
          <View 
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
          >
          基本信息
          </View>
          <View 
            className={`tab ${activeTab === 'terminals' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminals')}
          >
            终端列表
          </View>
        <View 
          className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          用户评价
        </View>
        </View>

      {/* 标签页内容 */}
      <View className='tab-content'>
        {activeTab === 'info' && (
          <View className='info-content'>
            <View className='info-section'>
              <View className='section-header'>
                <Text className='section-title'>充电站照片</Text>
                <View className='photo-actions'>
                  <Button className='take-photo-btn' onClick={takePhoto}>
                    <Text className='btn-icon'>📸</Text>
                    <Text className='btn-text'>拍照</Text>
                  </Button>
                </View>
              </View>
              
              <View className='photos-grid'>
                {photos.length > 0 ? (
                  photos.map((photo) => (
                    <View key={photo.id} className='photo-item'>
                      <View className='photo-container'>
                        <img 
                          src={photo.thumbnail} 
                          alt='充电站照片'
                          className='photo-image'
                          onClick={() => previewPhoto(photo.url, photos)}
                        />
                        
                        {/* 右上角删除按钮 - 始终可见 */}
                        <View 
                          className='delete-btn-top-right'
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePhoto(photo.id)
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation()
                          }}
                          onTap={(e) => {
                            e.stopPropagation()
                            deletePhoto(photo.id)
                          }}
                        >
                          <Text className='delete-icon'>✕</Text>
                        </View>
                        
                        {/* 底部信息覆盖层 */}
                    <View className='photo-overlay'>
                          <View className='photo-time'>{photo.uploadTime}</View>
                    </View>
                  </View>
                    </View>
                  ))
                ) : (
                  <View className='no-photos'>
                    <Text className='no-photos-icon'>📷</Text>
                    <Text className='no-photos-text'>暂无照片</Text>
                    <Text className='no-photos-hint'>点击上方拍照按钮添加照片</Text>
                  </View>
                )}
                  </View>
              </View>
          </View>
        )}

        {activeTab === 'terminals' && (
          <View className='terminals-content'>
            <View className='terminals-list'>
              {mockStationData.chargers.map((charger, index) => (
                <View 
                  key={charger.chargerId} 
                  className='terminal-item'
                  onClick={() => handleSelectTerminal(charger)}
                >
                  <View className='terminal-header'>
                    <Text className='terminal-id'>终端 {index + 1}</Text>
                    <View className={`status-badge ${charger.status}`}>
                      {charger.status === 'available' ? '可用' : 
                       charger.status === 'busy' ? '使用中' : '离线'}
                    </View>
                  </View>
                  
                  <View className='terminal-info'>
                    <View className='info-row'>
                      <Text className='info-label'>类型</Text>
                      <Text className='info-value'>{charger.type === 'fast' ? '快充' : '慢充'}</Text>
                    </View>
                    <View className='info-row'>
                      <Text className='info-label'>功率</Text>
                      <Text className='info-value'>{charger.power}kW</Text>
                  </View>
                    <View className='info-row'>
                      <Text className='info-label'>价格</Text>
                      <Text className='info-value price'>
                        ¥{(charger.pricing.electricityFee + charger.pricing.serviceFee).toFixed(4)}/度
                      </Text>
              </View>
            </View>

                  <View className='terminal-actions'>
                    <Button className='select-btn'>选择此终端</Button>
                </View>
                </View>
              ))}
              </View>
          </View>
        )}

        {activeTab === 'reviews' && (
          <View className='reviews-content'>
            <View className='reviews-list'>
              {comments.map((comment) => (
                <View key={comment.id} className='review-item'>
                  <View className='review-header'>
                    <View className='user-info'>
                      <Text className='user-avatar'>{comment.avatar}</Text>
                      <Text className='user-name'>{comment.user}</Text>
                    </View>
                    <View className='review-rating'>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Text key={i} className={`star ${i < comment.rating ? 'filled' : ''}`}>
                          {i < comment.rating ? '⭐' : '☆'}
                  </Text>
                ))}
              </View>
            </View>

                  <Text className='review-content'>{comment.content}</Text>
                  
                  <View className='review-footer'>
                    <Text className='review-time'>{comment.time}</Text>
                    <View className='like-btn' onClick={() => likeComment(comment.id)}>
                      <Text className='like-icon'>👍</Text>
                      <Text className='like-count'>{comment.likes}</Text>
              </View>
                </View>
                </View>
              ))}
                </View>
              </View>
        )}
            </View>

      {/* 地图选择器模态框 */}
      {showMapSelectorModal && (
        <View className='map-selector-modal'>
          <View className='map-panel'>
            <View className='map-header'>
              <Text className='title'>选择导航方式</Text>
              <View className='close-btn' onClick={closeMapSelector}>
                <Text className='close-icon'>✕</Text>
              </View>
                </View>
            
            <View className='map-content'>
              <View className='map-options'>
                {mapSelectorData.map((mapApp, index) => (
                  <View key={index} className='map-option' onClick={mapApp.action}>
                    <Text className='map-icon'>{mapApp.icon}</Text>
                    <View className='map-info'>
                      <Text className='map-name'>{mapApp.name}</Text>
                      <Text className='map-desc'>点击使用{mapApp.name}导航</Text>
                </View>
                    <Text className='arrow-icon'>›</Text>
                </View>
                ))}
            </View>

              <View className='coordinate-info' onClick={showCoordinateInfo}>
                <Text className='coordinate-text'>📍 点击查看坐标信息</Text>
              </View>
                </View>
                </View>
                </View>
      )}

      {/* 评论区模态框 */}
      {showComments && (
        <View className='comments-modal'>
          <View className='comments-panel'>
            <View className='comments-header'>
              <View className='close-btn' onClick={closeComments}>
                <Text className='close-icon'>✕</Text>
                </View>
              <Text className='title'>用户评价</Text>
              </View>
            
            <View className='comments-content'>
              <View className='comment-input'>
                <View className='input-header'>
                  <View className='rating-selector'>
                    <Text className='rating-label'>评分:</Text>
                    <View className='stars'>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Text 
                          key={i} 
                          className={`star ${i < userRating ? 'selected' : ''}`}
                          onClick={() => setUserRating(i + 1)}
                        >
                          {i < userRating ? '★' : '☆'}
                        </Text>
                      ))}
            </View>
          </View>
                  
                  <Text className='char-count'>{commentText.length}/200</Text>
                    </View>
                
                <View className='input-container'>
                  <textarea
                    className='comment-input'
                    placeholder='请输入您的评价...'
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={200}
                  />
                  </View>

                <View className='input-footer'>
                  <Text className='char-count'>{commentText.length}/200</Text>
                  <Button className='submit-btn' onClick={submitComment}>
                    发布评价
                  </Button>
                  </View>
                </View>
              
              <View className='comments-list'>
                <Text className='list-title'>全部评价 ({comments.length})</Text>
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <View key={comment.id} className='comment-item'>
                      <View className='comment-header'>
                        <View className='user-info'>
                          <Text className='user-avatar'>{comment.avatar}</Text>
                          <Text className='user-name'>{comment.user}</Text>
                        </View>
                        <View className='comment-rating'>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Text key={i} className={`star ${i < comment.rating ? 'filled' : ''}`}>
                              {i < comment.rating ? '★' : '☆'}
                            </Text>
              ))}
            </View>
      </View>

                      <Text className='comment-content'>{comment.content}</Text>
                      
                      <View className='comment-footer'>
                        <Text className='comment-time'>{comment.time}</Text>
                        <View className='like-btn' onClick={() => likeComment(comment.id)}>
                          <Text className='like-icon'>👍</Text>
                          <Text className='like-count'>{comment.likes}</Text>
        </View>
          </View>
          </View>
                  ))
                ) : (
                  <View className='empty-comments'>
                    <Text className='empty-icon'>💬</Text>
                    <Text className='empty-text'>还没有评价，快来发表第一条评价吧！</Text>
          </View>
                )}
        </View>
        </View>
      </View>
        </View>
      )}
      </View>
    </View>
  )
}
