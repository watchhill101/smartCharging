import couponData from '../data/coupons.json'
import { safeGetStorage, safeSetStorage } from '../utils/taroUtils'

// 优惠券接口
export interface Coupon {
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
export interface CouponCounts {
  unused: number
  used: number
  expired: number
  total: number
}

// 查询选项接口
export interface CouponQueryOptions {
  status?: 'unused' | 'used' | 'expired' | 'all'
  type?: 'discount' | 'amount' | 'free_charge' | 'points'
  minValue?: number
  maxValue?: number
  validFrom?: Date
  validUntil?: Date
  search?: string
  userId?: string
  sortBy?: 'createdAt' | 'validUntil' | 'value' | 'title'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
  includingExpired?: boolean
  expiringSoon?: boolean // 即将过期的优惠券（3天内）
}

// 分页结果接口
export interface PaginatedCoupons {
  coupons: Coupon[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 批量操作结果接口
export interface BatchOperationResult {
  success: number
  failed: number
  results: { id: string; success: boolean; error?: string }[]
}

// 本地存储键名
const STORAGE_KEYS = {
  COUPONS: 'mock_coupons_data',
  LAST_UPDATE: 'mock_coupons_last_update'
}

// 优惠券数据服务类
export class CouponService {
  private static instance: CouponService
  private coupons: Coupon[] = []
  private counts: CouponCounts = { unused: 0, used: 0, expired: 0, total: 0 }

  private constructor() {
    this.loadData()
  }

  // 单例模式
  public static getInstance(): CouponService {
    if (!CouponService.instance) {
      CouponService.instance = new CouponService()
    }
    return CouponService.instance
  }

  // 加载数据
  private loadData(): void {
    try {
      // 尝试从本地存储加载数据
      const savedCoupons = safeGetStorage(STORAGE_KEYS.COUPONS, null)
      const lastUpdate = safeGetStorage(STORAGE_KEYS.LAST_UPDATE, null)
      
      console.log('🔍 检查本地存储数据:', { savedCoupons, lastUpdate })
      
      if (savedCoupons && Array.isArray(savedCoupons) && lastUpdate) {
        // 检查数据是否过期（7天）
        const daysSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceUpdate < 7) {
          this.coupons = savedCoupons
          this.updateCounts()
          console.log('✅ 从本地存储加载优惠券数据:', this.coupons.length, '张')
          return
        } else {
          console.log('⚠️ 本地存储数据已过期，使用JSON文件数据')
        }
      } else {
        console.log('⚠️ 本地存储数据不存在或格式错误，使用JSON文件数据')
      }
      
      // 如果没有保存的数据或数据过期，使用JSON文件数据
      if (couponData && couponData.coupons && Array.isArray(couponData.coupons)) {
        this.coupons = [...couponData.coupons] as Coupon[] // 创建副本并添加类型断言
        this.updateCounts()
        console.log('✅ 从JSON文件加载优惠券数据:', this.coupons.length, '张')
        
        // 立即保存到本地存储
        this.saveData()
      } else {
        console.error('❌ JSON文件数据格式错误')
        this.coupons = []
        this.updateCounts()
      }
    } catch (error) {
      console.error('❌ 加载优惠券数据失败:', error)
      // 降级到空数组
      this.coupons = []
      this.updateCounts()
    }
  }

  // 保存数据到本地存储
  private saveData(): void {
    try {
      if (!Array.isArray(this.coupons)) {
        console.error('❌ 尝试保存的数据不是数组类型:', typeof this.coupons)
        return
      }
      
      const success1 = safeSetStorage(STORAGE_KEYS.COUPONS, this.coupons)
      const success2 = safeSetStorage(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString())
      
      if (success1 && success2) {
        console.log('💾 优惠券数据已保存到本地存储:', this.coupons.length, '张')
      } else {
        console.error('❌ 数据保存失败')
      }
    } catch (error) {
      console.error('❌ 保存数据失败:', error)
    }
  }

  // 更新统计数据
  private updateCounts(): void {
    if (!Array.isArray(this.coupons)) {
      console.error('❌ 无法更新统计，coupons不是数组:', typeof this.coupons)
      this.counts = { unused: 0, used: 0, expired: 0, total: 0 }
      return
    }
    
    this.counts = {
      unused: this.coupons.filter(c => c.status === 'unused').length,
      used: this.coupons.filter(c => c.status === 'used').length,
      expired: this.coupons.filter(c => c.status === 'expired').length,
      total: this.coupons.length
    }
    
    console.log('📊 统计数据已更新:', this.counts)
  }

  // ====== 基础查询方法 ======

  // 获取所有优惠券
  public getAllCoupons(): Coupon[] {
    return [...this.coupons]
  }

  // 获取统计数据
  public getCounts(): CouponCounts {
    return { ...this.counts }
  }

  // 根据状态获取优惠券（保持兼容性）
  public getCouponsByStatus(status: string): Coupon[] {
    return this.coupons.filter(coupon => coupon.status === status)
  }

  // 根据ID获取优惠券
  public getCouponById(id: string): Coupon | null {
    return this.coupons.find(c => c._id === id) || null
  }

  // ====== 高级查询方法 ======

  // 灵活查询优惠券
  public queryCoupons(options: CouponQueryOptions = {}): Coupon[] {
    let result = [...this.coupons]

    // 状态过滤
    if (options.status && options.status !== 'all') {
      result = result.filter(c => c.status === options.status)
    }

    // 类型过滤
    if (options.type) {
      result = result.filter(c => c.type === options.type)
    }

    // 用户ID过滤
    if (options.userId) {
      result = result.filter(c => c.userId === options.userId)
    }

    // 值范围过滤
    if (options.minValue !== undefined) {
      result = result.filter(c => c.value >= options.minValue!)
    }
    if (options.maxValue !== undefined) {
      result = result.filter(c => c.value <= options.maxValue!)
    }

    // 有效期过滤
    if (options.validFrom) {
      result = result.filter(c => new Date(c.validFrom) >= options.validFrom!)
    }
    if (options.validUntil) {
      result = result.filter(c => new Date(c.validUntil) <= options.validUntil!)
    }

    // 即将过期过滤
    if (options.expiringSoon) {
      const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      result = result.filter(c => {
        const expireDate = new Date(c.validUntil)
        return c.status === 'unused' && expireDate <= threeDaysLater && expireDate > new Date()
      })
    }

    // 搜索过滤
    if (options.search) {
      const searchTerm = options.search.toLowerCase()
      result = result.filter(c => 
        c.title.toLowerCase().includes(searchTerm) ||
        c.description.toLowerCase().includes(searchTerm) ||
        (c.conditions && c.conditions.some(cond => cond.toLowerCase().includes(searchTerm)))
      )
    }

    // 排序
    if (options.sortBy) {
      result.sort((a, b) => {
        let aVal: any, bVal: any
        
        switch (options.sortBy) {
          case 'createdAt':
            aVal = new Date(a.createdAt).getTime()
            bVal = new Date(b.createdAt).getTime()
            break
          case 'validUntil':
            aVal = new Date(a.validUntil).getTime()
            bVal = new Date(b.validUntil).getTime()
            break
          case 'value':
            aVal = a.value
            bVal = b.value
            break
          case 'title':
            aVal = a.title.toLowerCase()
            bVal = b.title.toLowerCase()
            break
          default:
            return 0
        }

        if (options.sortOrder === 'desc') {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        }
      })
    }

    // 分页
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0
      const limit = options.limit || result.length
      result = result.slice(offset, offset + limit)
    }

    return result
  }

  // 分页查询优惠券
  public getCouponsPaginated(page: number = 1, pageSize: number = 10, options: CouponQueryOptions = {}): PaginatedCoupons {
    const offset = (page - 1) * pageSize
    const queryOptions = { ...options, offset, limit: pageSize }
    
    // 获取总数（不包含分页）
    const totalOptions = { ...options }
    delete totalOptions.offset
    delete totalOptions.limit
    const total = this.queryCoupons(totalOptions).length
    
    // 获取分页数据
    const coupons = this.queryCoupons(queryOptions)
    
    return {
      coupons,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total
    }
  }

  // 获取即将过期的优惠券
  public getExpiringSoonCoupons(days: number = 3): Coupon[] {
    return this.queryCoupons({ 
      status: 'unused',
      expiringSoon: true
    })
  }

  // 按类型分组获取优惠券
  public getCouponsByType(): Record<string, Coupon[]> {
    const grouped: Record<string, Coupon[]> = {}
    
    this.coupons.forEach(coupon => {
      if (!grouped[coupon.type]) {
        grouped[coupon.type] = []
      }
      grouped[coupon.type].push(coupon)
    })
    
    return grouped
  }

  // ====== 数据操作方法 ======

  // 添加新优惠券
  public addCoupon(couponData: Partial<Coupon>): Coupon {
    const newCoupon: Coupon = {
      _id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    
    this.coupons.unshift(newCoupon)
    this.updateCounts()
    this.saveData()
    
    return newCoupon
  }

  // 编辑优惠券
  public editCoupon(couponId: string, updates: Partial<Coupon>): Coupon | null {
    const index = this.coupons.findIndex(c => c._id === couponId)
    if (index === -1) return null
    
    this.coupons[index] = { 
      ...this.coupons[index], 
      ...updates, 
      updatedAt: new Date().toISOString() 
    }
    
    this.updateCounts()
    this.saveData()
    
    return this.coupons[index]
  }

  // 删除优惠券
  public deleteCoupon(couponId: string): boolean {
    const index = this.coupons.findIndex(c => c._id === couponId)
    if (index === -1) return false
    
    this.coupons.splice(index, 1)
    this.updateCounts()
    this.saveData()
    
    return true
  }

  // 使用优惠券
  public useCoupon(couponId: string): Coupon | null {
    const coupon = this.coupons.find(c => c._id === couponId)
    if (!coupon || coupon.status !== 'unused') return null
    
    coupon.status = 'used'
    coupon.usedAt = new Date().toISOString()
    coupon.updatedAt = new Date().toISOString()
    
    this.updateCounts()
    this.saveData()
    
    return coupon
  }

  // 检查并更新过期优惠券
  public checkExpiredCoupons(): number {
    const now = new Date()
    let expiredCount = 0
    
    this.coupons.forEach(coupon => {
      if (coupon.status === 'unused' && new Date(coupon.validUntil) < now) {
        coupon.status = 'expired'
        coupon.updatedAt = new Date().toISOString()
        expiredCount++
      }
    })
    
    if (expiredCount > 0) {
      this.updateCounts()
      this.saveData()
    }
    
    return expiredCount
  }

  // 重置为默认数据
  public resetToDefault(): void {
    this.coupons = couponData.coupons as Coupon[]
    this.updateCounts()
    this.saveData()
    console.log('🔄 已重置为默认数据')
  }

  // 导出数据
  public exportData(): string {
    return JSON.stringify({
      coupons: this.coupons,
      metadata: {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        totalCount: this.coupons.length,
        description: "导出的优惠券数据"
      }
    }, null, 2)
  }

  // 导入数据
  public importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString)
      if (data.coupons && Array.isArray(data.coupons)) {
        this.coupons = data.coupons
        this.updateCounts()
        this.saveData()
        console.log('📥 数据导入成功:', this.coupons.length, '张优惠券')
        return true
      }
      return false
    } catch (error) {
      console.error('数据导入失败:', error)
      return false
    }
  }
}

// 导出默认实例
export default CouponService.getInstance() 