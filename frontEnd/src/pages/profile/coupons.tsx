import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import request from '../../utils/request'
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

export default function Coupons() {
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [counts, setCounts] = useState<CouponCounts>({ unused: 0, used: 0, expired: 0 })
  const [loading, setLoading] = useState(false)

  // 处理返回功能
  const handleGoBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack()
      } else if (typeof Taro.switchTab === 'function') {
        Taro.switchTab({ url: '/pages/profile/index' })
      } else {
        window.history.back()
      }
    } catch (error) {
      console.error('返回失败:', error)
      try {
        window.history.back()
      } catch (fallbackError) {
        console.error('备选返回方案也失败了:', fallbackError)
        if (typeof Taro.switchTab === 'function') {
          Taro.switchTab({ url: '/pages/profile/index' })
        } else {
          window.location.hash = '#/pages/profile/index'
        }
      }
    }
  }

  // 处理更多操作
  const handleMoreOptions = () => {
    try {
      if (typeof Taro.showActionSheet === 'function') {
        Taro.showActionSheet({
          itemList: ['分享', '收藏', '举报', '联系客服'],
          success: (res) => {
            console.log('选择了操作:', res.tapIndex)
          }
        })
      } else {
        const action = prompt('选择操作: 1-分享, 2-收藏, 3-举报, 4-联系客服')
        console.log('选择了操作:', action)
      }
    } catch (error) {
      console.error('显示操作菜单失败:', error)
    }
  }

  // 获取优惠券数据
  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await request({
        url: '/v1_0/auth/api/coupons',
        method: 'GET'
      })

      if (response.data.success) {
        setCoupons(response.data.data.coupons)
        setCounts(response.data.data.counts)
      } else {
        console.error('获取优惠券失败:', response.data.message)
        // 使用更安全的错误提示方式
        if (typeof Taro !== 'undefined' && Taro.showToast) {
          Taro.showToast({
            title: '获取优惠券失败',
            icon: 'error'
          })
        } else {
          console.error('获取优惠券失败:', response.data.message)
        }
      }
    } catch (error) {
      console.error('获取优惠券失败:', error)
      // 使用更安全的错误提示方式
      if (typeof Taro !== 'undefined' && Taro.showToast) {
        Taro.showToast({
          title: '网络错误，请重试',
          icon: 'error'
        })
      } else {
        console.error('网络错误，请重试:', error)
      }
    } finally {
      setLoading(false)
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
    fetchCoupons()
  })

  // 标签页切换时重新获取数据
  useEffect(() => {
    fetchCoupons()
  }, [activeTab])

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
    </View>
  )
}
