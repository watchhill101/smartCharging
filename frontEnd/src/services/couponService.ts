// 优惠券服务 - 模拟数据服务

export interface Coupon {
  id: string
  type: 'charging' | 'service' | 'general'
  title: string
  description: string
  discount: number
  minAmount: number
  validFrom: string
  validTo: string
  status: 'unused' | 'used' | 'expired'
  usedAt?: string
  stationRestriction?: string
  maxDiscount?: number
}

export interface CouponCounts {
  unused: number
  used: number
  expired: number
}

class CouponService {
  private mockCoupons: Coupon[] = [
    {
      id: 'coupon_001',
      type: 'charging',
      title: '充电优惠券',
      description: '充电满100元可用',
      discount: 20,
      minAmount: 100,
      validFrom: '2024-01-01',
      validTo: '2024-12-31',
      status: 'unused',
      maxDiscount: 50
    },
    {
      id: 'coupon_002',
      type: 'service',
      title: '服务费优惠券',
      description: '免服务费券',
      discount: 100,
      minAmount: 0,
      validFrom: '2024-01-01',
      validTo: '2024-06-30',
      status: 'expired'
    },
    {
      id: 'coupon_003',
      type: 'general',
      title: '通用优惠券',
      description: '全场通用',
      discount: 15,
      minAmount: 50,
      validFrom: '2024-01-01',
      validTo: '2024-12-31',
      status: 'used',
      usedAt: '2024-01-15'
    }
  ]

  private getStorageKey = (status: string) => `coupons_${status}`

  // 获取所有优惠券
  async getAllCoupons(): Promise<Coupon[]> {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 合并本地数据和服务器数据
      const allCoupons = [...this.mockCoupons]
      return allCoupons
    } catch (error) {
      console.error('获取优惠券失败:', error)
      return this.mockCoupons
    }
  }

  // 根据状态获取优惠券
  async getCouponsByStatus(status: 'unused' | 'used' | 'expired'): Promise<Coupon[]> {
    const allCoupons = await this.getAllCoupons()
    return allCoupons.filter(coupon => coupon.status === status)
  }

  // 获取优惠券统计
  async getCouponCounts(): Promise<CouponCounts> {
    const allCoupons = await this.getAllCoupons()
    
    const counts = {
      unused: allCoupons.filter(c => c.status === 'unused').length,
      used: allCoupons.filter(c => c.status === 'used').length,
      expired: allCoupons.filter(c => c.status === 'expired').length
    }

    return counts
  }

  // 使用优惠券
  async useCoupon(couponId: string): Promise<boolean> {
    try {
      // 模拟网络请求
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const couponIndex = this.mockCoupons.findIndex(c => c.id === couponId)
      if (couponIndex >= 0 && this.mockCoupons[couponIndex].status === 'unused') {
        this.mockCoupons[couponIndex].status = 'used'
        this.mockCoupons[couponIndex].usedAt = new Date().toISOString().split('T')[0]
        return true
      }
      
      return false
    } catch (error) {
      console.error('使用优惠券失败:', error)
      return false
    }
  }

  // 检查优惠券是否可用
  async canUseCoupon(couponId: string, amount: number): Promise<boolean> {
    const allCoupons = await this.getAllCoupons()
    const coupon = allCoupons.find(c => c.id === couponId)
    
    if (!coupon || coupon.status !== 'unused') {
      return false
    }

    // 检查金额限制
    if (amount < coupon.minAmount) {
      return false
    }

    // 检查有效期
    const now = new Date()
    const validFrom = new Date(coupon.validFrom)
    const validTo = new Date(coupon.validTo)
    
    return now >= validFrom && now <= validTo
  }

  // 计算优惠金额
  async calculateDiscount(couponId: string, amount: number): Promise<number> {
    const allCoupons = await this.getAllCoupons()
    const coupon = allCoupons.find(c => c.id === couponId)
    
    if (!coupon || !(await this.canUseCoupon(couponId, amount))) {
      return 0
    }

    if (coupon.type === 'charging' || coupon.type === 'general') {
      const discount = (amount * coupon.discount) / 100
      return coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount
    }
    
    if (coupon.type === 'service') {
      // 服务费券通常有固定金额
      return coupon.discount
    }

    return 0
  }

  // 领取优惠券
  async claimCoupon(couponId: string): Promise<boolean> {
    try {
      // 模拟网络请求
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 模拟成功领取
      const newCoupon: Coupon = {
        id: `claimed_${Date.now()}`,
        type: 'general',
        title: '新用户优惠券',
        description: '欢迎使用智能充电',
        discount: 10,
        minAmount: 30,
        validFrom: new Date().toISOString().split('T')[0],
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'unused'
      }
      
      this.mockCoupons.push(newCoupon)
      return true
    } catch (error) {
      console.error('领取优惠券失败:', error)
      return false
    }
  }
}

// 导出单例
const couponService = new CouponService()
export default couponService
