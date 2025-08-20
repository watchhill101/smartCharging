import { View, Text, ScrollView, Button } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import request from '../../utils/request'
import { STORAGE_KEYS } from '../../utils/constants'
import './index.scss'
import { TaroHelper } from '../../utils/taroHelpers'
// import { showToast } from '../../utils/toast'
import { TaroSafe } from '../../utils/taroSafe'

interface CouponInfo {
  _id: string
  couponId: string
  name: string
  description: string
  type: 'discount' | 'cashback' | 'free_charging' | 'percentage'
  value: number
  minAmount?: number
  maxDiscount?: number
  validFrom: string
  validTo: string
  applicableScenarios: string[]
}

interface UserCoupon {
  _id: string
  couponCode: string
  status: 'available' | 'used' | 'expired'
  receivedAt: string
  usedAt?: string
  expiredAt: string
  couponInfo: CouponInfo
  calculatedDiscount?: number
}

const CouponCenter = () => {
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available')
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    available: 0,
    used: 0,
    expired: 0
  })

  const tabOptions = [
    { key: 'available', label: '可使用', icon: '🎫' },
    { key: 'used', label: '已使用', icon: '✅' },
    { key: 'expired', label: '已过期', icon: '⏰' }
  ]

  const couponTypeLabels = {
    discount: '立减券',
    percentage: '折扣券',
    cashback: '返现券',
    free_charging: '免费券'
  }

  const scenarioLabels = {
    charging: '充电',
    recharge: '充值',
    membership: '会员'
  }

  useEffect(() => {
    loadUserCoupons()
    loadCouponStats()
  }, [activeTab])

  const loadUserCoupons = async () => {
    try {
      setIsLoading(true)
      
      const response = await request({
        url: '/coupon/my-coupons',
        method: 'GET',
        data: {
          status: activeTab,
          limit: 50
        }
      })

      if (response.data.success) {
        setCoupons(response.data.data.coupons || [])
      } else {
        throw new Error(response.data.message || '获取优惠券失败')
      }
    } catch (error: any) {
      console.error('获取优惠券失败:', error)
      
      // 使用模拟数据作为后备
      const mockCoupons: UserCoupon[] = [
        {
          _id: '1',
          couponCode: 'CHARGE001',
          status: 'available',
          receivedAt: '2024-01-15T10:00:00Z',
          expiredAt: '2024-02-15T23:59:59Z',
          couponInfo: {
            _id: 'c1',
            couponId: 'CPN001',
            name: '新用户充电优惠券',
            description: '首次充电立减10元，满20元可用',
            type: 'discount',
            value: 10,
            minAmount: 20,
            validFrom: '2024-01-01T00:00:00Z',
            validTo: '2024-02-15T23:59:59Z',
            applicableScenarios: ['charging']
          }
        },
        {
          _id: '2',
          couponCode: 'MEMBER002',
          status: 'available',
          receivedAt: '2024-01-10T15:30:00Z',
          expiredAt: '2024-01-31T23:59:59Z',
          couponInfo: {
            _id: 'c2',
            couponId: 'CPN002',
            name: '会员专享9折券',
            description: '充电享9折优惠，最高优惠50元',
            type: 'percentage',
            value: 10,
            maxDiscount: 50,
            validFrom: '2024-01-01T00:00:00Z',
            validTo: '2024-01-31T23:59:59Z',
            applicableScenarios: ['charging']
          }
        }
      ].filter(coupon => coupon.status === activeTab)
      
      setCoupons(mockCoupons)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCouponStats = async () => {
    try {
      // 模拟统计数据
      setStats({
        available: 3,
        used: 5,
        expired: 2
      })
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`
  }

  const formatCouponValue = (coupon: CouponInfo) => {
    switch (coupon.type) {
      case 'discount':
        return `¥${coupon.value}`
      case 'percentage':
        return `${coupon.value}折`
      case 'cashback':
        return `返¥${coupon.value}`
      case 'free_charging':
        return '免费'
      default:
        return `¥${coupon.value}`
    }
  }

  const getUsageCondition = (coupon: CouponInfo) => {
    if (coupon.minAmount) {
      return `满${coupon.minAmount}元可用`
    }
    return '无门槛'
  }

  const getCouponStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#52c41a'
      case 'used':
        return '#999'
      case 'expired':
        return '#ff4d4f'
      default:
        return '#999'
    }
  }

  const handleUseCoupon = (coupon: UserCoupon) => {
    if (coupon.status !== 'available') return

    TaroHelper.showModal({
      title: '使用优惠券',
      content: `确定要在充电时使用"${coupon.couponInfo.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // 跳转到充电页面，携带优惠券信息
          Taro.switchTab({
            url: '/pages/charging/index'
          })
          
          // 将优惠券信息存储到本地，供充电页面使用
          try {
            TaroSafe.setStorageSync('selectedCoupon', {
              couponCode: coupon.couponCode,
              name: coupon.couponInfo.name,
              value: coupon.couponInfo.value,
              type: coupon.couponInfo.type
            })
          } catch (error) {
            console.error('存储优惠券信息失败:', error)
          }
        }
      }
    })
  }

  const handleCopyCouponCode = (couponCode: string) => {
    Taro.setClipboardData({
      data: couponCode,
      success: () => {
        showToast({
          title: '优惠券码已复制',
          icon: 'success'
        })
      }
    })
  }

  const renderCouponItem = (coupon: UserCoupon) => (
    <View key={coupon._id} className='coupon-item'>
      <View className='coupon-main'>
        <View className='coupon-left'>
          <View className='coupon-value'>
            <Text className='value-text'>{formatCouponValue(coupon.couponInfo)}</Text>
            <Text className='value-label'>{couponTypeLabels[coupon.couponInfo.type]}</Text>
          </View>
          <View className={`coupon-status ${coupon.status}`}>
            <Text className='status-text'>
              {coupon.status === 'available' ? '可使用' : 
               coupon.status === 'used' ? '已使用' : '已过期'}
            </Text>
          </View>
        </View>

        <View className='coupon-right'>
          <Text className='coupon-name'>{coupon.couponInfo.name}</Text>
          <Text className='coupon-desc'>{coupon.couponInfo.description}</Text>
          
          <View className='coupon-info'>
            <Text className='info-item'>
              使用条件：{getUsageCondition(coupon.couponInfo)}
            </Text>
            <Text className='info-item'>
              适用场景：{coupon.couponInfo.applicableScenarios.map(s => scenarioLabels[s]).join('、')}
            </Text>
            <Text className='info-item'>
              有效期至：{formatDate(coupon.expiredAt)}
            </Text>
          </View>

          <View className='coupon-actions'>
            <Button 
              className='action-btn copy-btn'
              size='mini'
              onClick={() => handleCopyCouponCode(coupon.couponCode)}
            >
              复制券码
            </Button>
            
            {coupon.status === 'available' && (
              <Button 
                className='action-btn use-btn'
                size='mini'
                type='primary'
                onClick={() => handleUseCoupon(coupon)}
              >
                立即使用
              </Button>
            )}
          </View>
        </View>
      </View>

      <View className='coupon-code'>
        <Text className='code-label'>券码：</Text>
        <Text className='code-text'>{coupon.couponCode}</Text>
      </View>
    </View>
  )

  const renderEmptyState = () => (
    <View className='empty-state'>
      <Text className='empty-icon'>
        {activeTab === 'available' ? '🎫' : 
         activeTab === 'used' ? '✅' : '⏰'}
      </Text>
      <Text className='empty-text'>
        {activeTab === 'available' ? '暂无可用优惠券' : 
         activeTab === 'used' ? '暂无已使用优惠券' : '暂无过期优惠券'}
      </Text>
      <Text className='empty-tip'>
        {activeTab === 'available' ? '快去领取优惠券吧' : ''}
      </Text>
    </View>
  )

  return (
    <View className='coupon-center'>
      {/* 头部统计 */}
      <View className='coupon-header'>
        <Text className='header-title'>我的优惠券</Text>
        <View className='stats-row'>
          <View className='stat-item'>
            <Text className='stat-number'>{stats.available}</Text>
            <Text className='stat-label'>可使用</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-number'>{stats.used}</Text>
            <Text className='stat-label'>已使用</Text>
          </View>
          <View className='stat-item'>
            <Text className='stat-number'>{stats.expired}</Text>
            <Text className='stat-label'>已过期</Text>
          </View>
        </View>
      </View>

      {/* 标签页导航 */}
      <View className='tab-navigation'>
        {tabOptions.map(tab => (
          <View
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            <Text className='tab-icon'>{tab.icon}</Text>
            <Text className='tab-text'>{tab.label}</Text>
            <View className='tab-badge'>
              <Text className='badge-text'>{stats[tab.key]}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 优惠券列表 */}
      <ScrollView className='coupon-list' scrollY>
        {isLoading ? (
          <View className='loading-state'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        ) : coupons.length > 0 ? (
          <View className='coupon-items'>
            {coupons.map(renderCouponItem)}
          </View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {/* 底部提示 */}
      <View className='coupon-footer'>
        <View className='footer-tips'>
          <Text className='tips-title'>💡 使用提示</Text>
          <Text className='tips-text'>• 优惠券仅限本人使用，不可转让</Text>
          <Text className='tips-text'>• 每笔订单仅可使用一张优惠券</Text>
          <Text className='tips-text'>• 优惠券过期后将自动失效</Text>
        </View>
        
        <Button 
          className='get-more-btn'
          onClick={() => {
            showToast({
              title: '更多优惠券敬请期待',
              icon: 'none'
            })
          }}
        >
          获取更多优惠券
        </Button>
      </View>
    </View>
  )
}

export default CouponCenter