import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import request from '../../utils/request'
import { showSafeToast, safeNavigateBack, showSafeActionSheet, safeGetStorage, safeSetStorage } from '../../utils/taroUtils'
import { logEnvironmentInfo } from '../../utils/environment'
import './coupons.scss'

// 优惠券接口
interface Coupon {
  _id: string
  userId: string
  type: 'discount' | 'amount' | 'free_charge' | 'points'
  title: string
  description: string
  value: number
  minAmount?: number
  maxDiscount?: number
  validFrom: string
  validUntil: string
  status: 'unused' | 'used' | 'expired'
  usedAt?: string
  usedInOrder?: string
  conditions?: string[]
  applicableStations?: string[]
  applicableChargers?: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 优惠券统计
interface CouponCounts {
  unused: number
  used: number
  expired: number
}

// 模拟优惠券数据
const MOCK_COUPONS: Coupon[] = [
  {
    _id: 'mock_001',
    userId: 'demo_user_001',
    type: 'discount',
    title: '新用户专享8.5折券',
    description: '新用户首次充电享受8.5折优惠，最高可省20元',
    value: 0.85,
    minAmount: 0,
    maxDiscount: 20,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unused',
    conditions: ['仅限新用户', '首次充电使用'],
    applicableStations: [],
    applicableChargers: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'mock_002',
    userId: 'demo_user_001',
    type: 'amount',
    title: '满50减10元券',
    description: '单次充电满50元即可使用，立减10元',
    value: 10,
    minAmount: 50,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unused',
    conditions: ['满50元可用', '仅限单次使用'],
    applicableStations: [],
    applicableChargers: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'mock_003',
    userId: 'demo_user_001',
    type: 'free_charge',
    title: '免费充电1小时券',
    description: '享受1小时免费充电服务',
    value: 1,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unused',
    conditions: ['限时使用', '不可与其他优惠叠加'],
    applicableStations: [],
    applicableChargers: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'mock_004',
    userId: 'demo_user_001',
    type: 'points',
    title: '积分兑换券',
    description: '使用100积分兑换充电优惠',
    value: 100,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unused',
    conditions: ['需要100积分', '可重复使用'],
    applicableStations: [],
    applicableChargers: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'mock_005',
    userId: 'demo_user_001',
    type: 'discount',
    title: '周末特惠9折券',
    description: '周末充电享受9折优惠',
    value: 0.9,
    minAmount: 30,
    maxDiscount: 15,
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'unused',
    conditions: ['仅限周末使用', '满30元可用'],
    applicableStations: [],
    applicableChargers: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// 本地存储键名
const STORAGE_KEYS = {
  COUPONS: 'mock_coupons_data',
  LAST_UPDATE: 'mock_coupons_last_update'
}

export default function Coupons() {
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [counts, setCounts] = useState<CouponCounts>({ unused: 0, used: 0, expired: 0 })
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)

  // 处理返回功能
  const handleGoBack = () => {
    safeNavigateBack()
  }

  // 处理更多操作
  const handleMoreOptions = () => {
    showSafeActionSheet(
      ['分享', '收藏', '举报', '联系客服'],
      (res) => {
        console.log('选择了操作:', res.tapIndex)
        // 根据选择执行相应操作
        switch (res.tapIndex) {
          case 0:
            showSafeToast('分享功能开发中', 'none')
            break
          case 1:
            showSafeToast('收藏功能开发中', 'none')
            break
          case 2:
            showSafeToast('举报功能开发中', 'none')
            break
          case 3:
            showSafeToast('联系客服功能开发中', 'none')
            break
          default:
            break
        }
      },
      (error) => {
        console.error('显示操作菜单失败:', error)
        showSafeToast('操作菜单显示失败', 'error')
      }
    )
  }

  // 加载模拟数据
  const loadMockData = () => {
    try {
      // 尝试从本地存储加载数据
      const savedCoupons = safeGetStorage(STORAGE_KEYS.COUPONS, null)
      const lastUpdate = safeGetStorage(STORAGE_KEYS.LAST_UPDATE, null)
      
      if (savedCoupons && lastUpdate) {
        // 检查数据是否过期（7天）
        const daysSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceUpdate < 7) {
          setCoupons(savedCoupons)
          updateCounts(savedCoupons)
          console.log('✅ 从本地存储加载优惠券数据:', savedCoupons.length, '张')
          return
        }
      }
      
      // 如果没有保存的数据或数据过期，使用默认模拟数据
      setCoupons(MOCK_COUPONS)
      updateCounts(MOCK_COUPONS)
      console.log('✅ 使用默认模拟数据:', MOCK_COUPONS.length, '张')
      
      // 保存到本地存储
      saveMockData(MOCK_COUPONS)
    } catch (error) {
      console.error('加载模拟数据失败:', error)
      // 降级到默认数据
      setCoupons(MOCK_COUPONS)
      updateCounts(MOCK_COUPONS)
    }
  }

  // 保存模拟数据到本地存储
  const saveMockData = (couponsData: Coupon[]) => {
    try {
      safeSetStorage(STORAGE_KEYS.COUPONS, couponsData)
      safeSetStorage(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString())
      console.log('💾 优惠券数据已保存到本地存储')
    } catch (error) {
      console.error('保存数据失败:', error)
    }
  }

  // 更新统计数据
  const updateCounts = (couponsData: Coupon[]) => {
    const counts = {
      unused: couponsData.filter(c => c.status === 'unused').length,
      used: couponsData.filter(c => c.status === 'used').length,
      expired: couponsData.filter(c => c.status === 'expired').length
    }
    setCounts(counts)
  }

  // 添加新优惠券
  const addCoupon = (couponData: Partial<Coupon>) => {
    const newCoupon: Coupon = {
      _id: `mock_${Date.now()}`,
      userId: 'demo_user_001',
      type: 'discount',
      title: '新优惠券',
      description: '新添加的优惠券',
      value: 0.9,
      minAmount: 0,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'unused',
      conditions: [],
      applicableStations: [],
      applicableChargers: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...couponData
    }
    
    const updatedCoupons = [newCoupon, ...coupons]
    setCoupons(updatedCoupons)
    updateCounts(updatedCoupons)
    saveMockData(updatedCoupons)
    
    showSafeToast('优惠券添加成功', 'success')
    setShowAddModal(false)
  }

  // 编辑优惠券
  const editCoupon = (couponId: string, updates: Partial<Coupon>) => {
    const updatedCoupons = coupons.map(coupon => 
      coupon._id === couponId 
        ? { ...coupon, ...updates, updatedAt: new Date().toISOString() }
        : coupon
    )
    
    setCoupons(updatedCoupons)
    updateCounts(updatedCoupons)
    saveMockData(updatedCoupons)
    
    showSafeToast('优惠券更新成功', 'success')
    setEditingCoupon(null)
  }

  // 删除优惠券
  const deleteCoupon = (couponId: string) => {
    const updatedCoupons = coupons.filter(coupon => coupon._id !== couponId)
    setCoupons(updatedCoupons)
    updateCounts(updatedCoupons)
    saveMockData(updatedCoupons)
    
    showSafeToast('优惠券删除成功', 'success')
  }

  // 使用优惠券
  const useCoupon = (couponId: string) => {
    const updatedCoupons = coupons.map(coupon => 
      coupon._id === couponId 
        ? { 
            ...coupon, 
            status: 'used' as const, 
            usedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        : coupon
    )
    
    setCoupons(updatedCoupons)
    updateCounts(updatedCoupons)
    saveMockData(updatedCoupons)
    
    showSafeToast('优惠券使用成功', 'success')
  }

  // 检查并更新过期优惠券
  const checkExpiredCoupons = () => {
    const now = new Date()
    const updatedCoupons = coupons.map(coupon => {
      if (coupon.status === 'unused' && new Date(coupon.validUntil) < now) {
        return { ...coupon, status: 'expired' as const, updatedAt: new Date().toISOString() }
      }
      return coupon
    })
    
    if (updatedCoupons.some(c => c.status === 'expired')) {
      setCoupons(updatedCoupons)
      updateCounts(updatedCoupons)
      saveMockData(updatedCoupons)
      showSafeToast('发现过期优惠券，已自动更新状态', 'none')
    }
  }

  // 获取指定状态的优惠券
  const getCouponsByStatus = (status: string) => {
    return coupons.filter(coupon => coupon.status === status)
  }

  // 格式化优惠券值显示
  const formatCouponValue = (coupon: Coupon) => {
    switch (coupon.type) {
      case 'discount':
        return `${(coupon.value * 10).toFixed(1)}折`
      case 'amount':
        return `¥${coupon.value}`
      case 'free_charge':
        return `${coupon.value}小时`
      case 'points':
        return `${coupon.value}积分`
      default:
        return coupon.value.toString()
    }
  }

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN')
  }

  // 检查优惠券是否即将过期
  const isExpiringSoon = (validUntil: string) => {
    const now = new Date()
    const expireDate = new Date(validUntil)
    const diffDays = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 3 && diffDays > 0
  }

  useLoad(() => {
    console.log('优惠券页面加载中...')
    
    // 检测当前运行环境
    logEnvironmentInfo()
    
    // 使用模拟数据系统
    loadMockData()
    
    // 检查过期优惠券
    setTimeout(() => {
      checkExpiredCoupons()
    }, 1000)
  })

  // 获取优惠券数据（现在使用模拟数据）
  const fetchCoupons = async () => {
    try {
      setLoading(true)
      console.log('🔄 开始加载优惠券数据...')
      
      // 重新加载模拟数据
      loadMockData()
      
      // 检查过期优惠券
      checkExpiredCoupons()
      
      showSafeToast('数据已刷新', 'success')
    } catch (error) {
      console.error('❌ 加载优惠券数据失败:', error)
      showSafeToast('数据加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 移除重复调用，只在标签页切换时过滤数据，不重新获取
  // useEffect(() => {
  //   fetchCoupons()
  // }, [activeTab])

  return (
    <View className='coupons-page'>
      {/* 头部导航栏 */}
      <View className='header-navbar'>
        <View className='navbar-left' onClick={handleGoBack}>
          <Text className='back-icon'>‹</Text>
        </View>
        <View className='navbar-center'>
          <Text className='navbar-title'>我的优惠券</Text>
        </View>
        <View className='navbar-right'>
          <View className='add-button' onClick={() => setShowAddModal(true)}>
            <Text className='add-icon'>+</Text>
          </View>
          <View className='refresh-button' onClick={() => fetchCoupons()}>
            <Text className='refresh-icon'>🔄</Text>
          </View>
          <View className='more-button' onClick={handleMoreOptions}>
            <Text className='more-icon'>⋯</Text>
          </View>
        </View>
      </View>

      {/* 导航标签页 */}
      <View className='tabs-section'>
        <View className='tabs-header'>
          <View 
            className={`tab ${activeTab === 'unused' ? 'active' : ''}`}
            onClick={() => setActiveTab('unused')}
          >
            待使用({counts.unused})
          </View>
          <View 
            className={`tab ${activeTab === 'used' ? 'active' : ''}`}
            onClick={() => setActiveTab('used')}
          >
            已使用({counts.used})
          </View>
          <View 
            className={`tab ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveTab('expired')}
          >
            已过期({counts.expired})
          </View>
        </View>
      </View>

      {/* 主要内容区域 */}
      <View className='main-content'>
        {loading ? (
          <View className='loading-state'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        ) : getCouponsByStatus(activeTab).length > 0 ? (
          <View className='coupons-list'>
            {getCouponsByStatus(activeTab).map((coupon) => (
              <View key={coupon._id} className='coupon-item'>
                <View className='coupon-header'>
                  <View className='coupon-type'>
                    <Text className='type-icon'>
                      {coupon.type === 'discount' ? '🏷️' : 
                       coupon.type === 'amount' ? '💰' : 
                       coupon.type === 'free_charge' ? '⚡' : '🎯'}
                    </Text>
                    <Text className='type-text'>
                      {coupon.type === 'discount' ? '折扣券' : 
                       coupon.type === 'amount' ? '满减券' : 
                       coupon.type === 'free_charge' ? '免费券' : '积分券'}
                    </Text>
                  </View>
                  <View className='coupon-value'>
                    <Text className='value-text'>{formatCouponValue(coupon)}</Text>
                  </View>
                </View>
                
                <View className='coupon-content'>
                  <Text className='coupon-title'>{coupon.title}</Text>
                  <Text className='coupon-desc'>{coupon.description}</Text>
                  
                  {coupon.minAmount && (
                    <Text className='coupon-condition'>
                      满¥{coupon.minAmount}可用
                    </Text>
                  )}
                  
                  {coupon.conditions && coupon.conditions.length > 0 && (
                    <View className='coupon-conditions'>
                      {coupon.conditions.map((condition, index) => (
                        <Text key={index} className='condition-item'>• {condition}</Text>
                      ))}
                    </View>
                  )}
                </View>
                
                <View className='coupon-footer'>
                  <Text className='valid-date'>
                    有效期至: {formatDate(coupon.validUntil)}
                  </Text>
                  {isExpiringSoon(coupon.validUntil) && (
                    <View className='expiring-soon'>
                      <Text className='expiring-text'>即将过期</Text>
                    </View>
                  )}
                  
                  {/* 操作按钮 */}
                  <View className='coupon-actions'>
                    {coupon.status === 'unused' && (
                      <View className='action-button use-button' onClick={() => useCoupon(coupon._id)}>
                        <Text className='action-text'>使用</Text>
                      </View>
                    )}
                    
                    <View className='action-button edit-button' onClick={() => setEditingCoupon(coupon)}>
                      <Text className='action-text'>编辑</Text>
                    </View>
                    
                    <View className='action-button delete-button' onClick={() => deleteCoupon(coupon._id)}>
                      <Text className='action-text'>删除</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className='empty-state'>
            <View className='wallet-illustration'>
              <View className='wallet-icon'>💼</View>
              <View className='money-symbol'>¥</View>
              <View className='paper-stack'></View>
            </View>
            <Text className='empty-text'>
              {activeTab === 'unused' ? '暂无可用优惠券' :
               activeTab === 'used' ? '暂无已使用优惠券' : '暂无已过期优惠券'}
            </Text>
          </View>
        )}
      </View>

      {/* 添加/编辑优惠券模态框 */}
      {(showAddModal || editingCoupon) && (
        <View className='modal-overlay' onClick={() => {
          setShowAddModal(false)
          setEditingCoupon(null)
        }}>
          <View className='modal-content' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>
                {editingCoupon ? '编辑优惠券' : '添加优惠券'}
              </Text>
              <View className='modal-close' onClick={() => {
                setShowAddModal(false)
                setEditingCoupon(null)
              }}>
                <Text className='close-icon'>×</Text>
              </View>
            </View>
            
            <View className='modal-body'>
              <View className='form-group'>
                <Text className='form-label'>优惠券类型</Text>
                <View className='form-select'>
                  <View 
                    className={`select-option ${(!editingCoupon || editingCoupon.type === 'discount') ? 'active' : ''}`}
                    onClick={() => setEditingCoupon(prev => prev ? {...prev, type: 'discount'} : null)}
                  >
                    折扣券
                  </View>
                  <View 
                    className={`select-option ${editingCoupon?.type === 'amount' ? 'active' : ''}`}
                    onClick={() => setEditingCoupon(prev => prev ? {...prev, type: 'amount'} : null)}
                  >
                    满减券
                  </View>
                  <View 
                    className={`select-option ${editingCoupon?.type === 'free_charge' ? 'active' : ''}`}
                    onClick={() => setEditingCoupon(prev => prev ? {...prev, type: 'free_charge'} : null)}
                  >
                    免费券
                  </View>
                </View>
              </View>
              
              <View className='form-group'>
                <Text className='form-label'>标题</Text>
                <View className='form-input'>
                  {editingCoupon?.title || '新优惠券'}
                </View>
              </View>
              
              <View className='form-group'>
                <Text className='form-label'>描述</Text>
                <View className='form-input'>
                  {editingCoupon?.description || '新添加的优惠券'}
                </View>
              </View>
              
              <View className='form-group'>
                <Text className='form-label'>有效期（天）</Text>
                <View className='form-input'>
                  {editingCoupon ? 
                    Math.ceil((new Date(editingCoupon.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)).toString() :
                    '30'
                  }
                </View>
              </View>
            </View>
            
            <View className='modal-footer'>
              <View className='modal-button cancel' onClick={() => {
                setShowAddModal(false)
                setEditingCoupon(null)
              }}>
                <Text className='button-text'>取消</Text>
              </View>
              <View className='modal-button confirm' onClick={() => {
                if (editingCoupon) {
                  // 编辑模式
                  editCoupon(editingCoupon._id, {
                    title: '已编辑的优惠券',
                    description: '优惠券已更新'
                  })
                } else {
                  // 添加模式
                  addCoupon({
                    title: '新添加的优惠券',
                    description: '新添加的优惠券描述',
                    type: 'discount',
                    value: 0.9
                  })
                }
              }}>
                <Text className='button-text'>确定</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
