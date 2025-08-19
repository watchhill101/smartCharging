import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { showSafeToast, safeNavigateBack, showSafeActionSheet } from '../../utils/taroUtils'
import { logEnvironmentInfo } from '../../utils/environment'
import couponService, { Coupon, CouponCounts } from '../../services/couponService'
import './coupons.scss'

// 使用数据服务管理优惠券数据

export default function Coupons() {
  const [activeTab, setActiveTab] = useState<'unused' | 'used' | 'expired'>('unused')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [counts, setCounts] = useState<CouponCounts>({ unused: 0, used: 0, expired: 0 })
  const [loading, setLoading] = useState(false)
  const [showUseConfirm, setShowUseConfirm] = useState(false)
  const [couponToUse, setCouponToUse] = useState<Coupon | null>(null)

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
      // 使用数据服务加载数据
      const allCoupons = couponService.getAllCoupons()
      const allCounts = couponService.getCounts()
      
      setCoupons(allCoupons)
      setCounts(allCounts)
      console.log('✅ 从数据服务加载优惠券数据:', allCoupons.length, '张')
    } catch (error) {
      console.error('加载模拟数据失败:', error)
      // 降级到空数据
      setCoupons([])
      setCounts({ unused: 0, used: 0, expired: 0 })
    }
  }

  // 显示使用确认对话框
  const showUseConfirmDialog = (coupon: Coupon) => {
    setCouponToUse(coupon)
    setShowUseConfirm(true)
  }

  // 确认使用优惠券
  const confirmUseCoupon = () => {
    if (!couponToUse) return
    
    try {
      // 使用数据服务更新优惠券状态
      const usedCoupon = couponService.useCoupon(couponToUse._id)
      
      if (usedCoupon) {
        // 重新加载数据
        loadMockData()
        showSafeToast('优惠券使用成功！', 'success')
        console.log('✅ 优惠券使用成功:', usedCoupon.title)
      } else {
        showSafeToast('优惠券使用失败，请重试', 'error')
        console.error('❌ 优惠券使用失败')
      }
    } catch (error) {
      console.error('使用优惠券时发生错误:', error)
      showSafeToast('使用优惠券时发生错误', 'error')
    } finally {
      // 关闭确认对话框
      setShowUseConfirm(false)
      setCouponToUse(null)
    }
  }

  // 取消使用优惠券
  const cancelUseCoupon = () => {
    setShowUseConfirm(false)
    setCouponToUse(null)
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
      // checkExpiredCoupons() // Removed
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
      // checkExpiredCoupons() // Removed
      
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
                  
                  {/* 使用按钮 - 只在未使用的优惠券上显示 */}
                  {coupon.status === 'unused' && (
                    <View className='use-button-container'>
                      <View className='use-button' onClick={() => showUseConfirmDialog(coupon)}>
                        <Text className='use-button-text'>使用优惠券</Text>
                      </View>
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

      {/* 添加/编辑优惠券模态框 */}
      {/* Removed Add/Edit Modal */}

      {/* 使用优惠券确认对话框 */}
      {showUseConfirm && couponToUse && (
        <View className='modal-overlay' onClick={cancelUseCoupon}>
          <View className='modal-content use-confirm-modal' onClick={(e) => e.stopPropagation()}>
            <View className='modal-header'>
              <Text className='modal-title'>使用优惠券</Text>
              <View className='modal-close' onClick={cancelUseCoupon}>
                <Text className='close-icon'>×</Text>
              </View>
            </View>
            
            <View className='modal-body'>
              <View className='coupon-preview'>
                <View className='coupon-preview-header'>
                  <Text className='coupon-preview-title'>{couponToUse.title}</Text>
                  <View className='coupon-preview-value'>
                    <Text className='value-text'>{formatCouponValue(couponToUse)}</Text>
                  </View>
                </View>
                
                <Text className='coupon-preview-desc'>{couponToUse.description}</Text>
                
                {couponToUse.minAmount && (
                  <Text className='coupon-preview-condition'>
                    满¥{couponToUse.minAmount}可用
                  </Text>
                )}
                
                <Text className='coupon-preview-validity'>
                  有效期至: {formatDate(couponToUse.validUntil)}
                </Text>
              </View>
              
              <View className='use-notice'>
                <Text className='notice-title'>使用须知：</Text>
                <Text className='notice-text'>• 使用后优惠券将标记为已使用</Text>
                <Text className='notice-text'>• 使用后不可撤销或重复使用</Text>
                <Text className='notice-text'>• 请在有效期内使用</Text>
              </View>
            </View>
            
            <View className='modal-footer'>
              <View className='modal-button cancel' onClick={cancelUseCoupon}>
                <Text className='button-text'>取消</Text>
              </View>
              <View className='modal-button confirm use' onClick={confirmUseCoupon}>
                <Text className='button-text'>确认使用</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
