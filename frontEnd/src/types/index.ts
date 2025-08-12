// 通用类型定义

// 用户信息
export interface User {
  _id: string
  phone: string
  nickName?: string
  avatarUrl?: string
  balance: number
  verificationLevel: 'basic' | 'face_verified'
  vehicles: Vehicle[]
  createdAt: string
  updatedAt: string
}

// 车辆信息
export interface Vehicle {
  brand: string
  model: string
  licensePlate: string
  batteryCapacity?: number
}

// 充电站信息
export interface ChargingStation {
  _id: string
  name: string
  address: string
  location: {
    type: 'Point'
    coordinates: [number, number] // [经度, 纬度]
  }
  operator: string
  operatingHours: {
    open: string
    close: string
  }
  parkingFee: number
  photos: string[]
  chargers: Charger[]
  rating: number
  reviewCount: number
  distance?: number // 距离用户的距离（米）
  createdAt: string
  updatedAt: string
}

// 充电桩信息
export interface Charger {
  chargerId: string
  type: 'fast' | 'slow'
  power: number // kW
  status: 'available' | 'busy' | 'offline'
  pricing: {
    electricityFee: number // 电费
    serviceFee: number     // 服务费
  }
}

// 充电会话
export interface ChargingSession {
  _id: string
  sessionId: string
  userId: string
  stationId: string
  chargerId: string
  status: 'active' | 'completed' | 'cancelled' | 'error'
  startTime: string
  endTime?: string
  duration: number // 秒
  energyDelivered: number // kWh
  startPowerLevel?: number // 开始时电量百分比
  endPowerLevel?: number   // 结束时电量百分比
  totalCost: number
  paymentStatus: 'pending' | 'paid' | 'failed'
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

// 订单信息
export interface Order {
  _id: string
  orderId: string
  userId: string
  type: 'charging' | 'recharge'
  amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  paymentMethod: 'balance' | 'alipay'
  sessionId?: string
  thirdPartyOrderId?: string
  description?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 地理位置
export interface Location {
  latitude: number
  longitude: number
  accuracy?: number
  altitude?: number
  speed?: number
}

// 地图标记点
export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  title?: string
  iconPath?: string
  width?: number
  height?: number
  callout?: {
    content: string
    color?: string
    fontSize?: number
    borderRadius?: number
    bgColor?: string
    padding?: number
    display?: 'BYCLICK' | 'ALWAYS'
    textAlign?: 'left' | 'right' | 'center'
  }
}

// 搜索筛选条件
export interface SearchFilter {
  keyword?: string
  type?: 'fast' | 'slow' | 'all'
  status?: 'available' | 'all'
  operator?: string
  distance?: number // 搜索半径（米）
  sortBy?: 'distance' | 'rating' | 'price'
  sortOrder?: 'asc' | 'desc'
}

// 分页参数
export interface PaginationParams {
  page: number
  limit: number
}

// 分页响应
export interface PaginationResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// 统计信息
export interface Statistics {
  totalSessions: number
  totalEnergy: number // kWh
  totalCost: number
  totalDuration: number // 秒
  completedSessions: number
}

// 支付信息
export interface PaymentInfo {
  orderId: string
  amount: number
  paymentMethod: 'balance' | 'alipay'
  description?: string
}

// 文件上传响应
export interface UploadResponse {
  url: string
  filename: string
  size: number
  type: string
}

// 验证结果
export interface VerificationResult {
  success: boolean
  token?: string
  message?: string
  confidence?: number
}

// 滑块验证
export interface SliderVerification extends VerificationResult {
  slideDistance?: number
  timestamp?: number
}

// 人脸验证
export interface FaceVerification extends VerificationResult {
  liveDetectionPassed?: boolean
}

// 通知消息
export interface Notification {
  id: string
  type: 'charging' | 'payment' | 'system' | 'promotion'
  title: string
  content: string
  data?: any
  read: boolean
  createdAt: string
}

// 优惠券
export interface Coupon {
  id: string
  name: string
  description: string
  type: 'discount' | 'cashback'
  value: number // 折扣金额或比例
  minAmount?: number // 最小使用金额
  maxDiscount?: number // 最大折扣金额
  validFrom: string
  validTo: string
  used: boolean
  usedAt?: string
}

// 评论
export interface Review {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  stationId: string
  rating: number
  content: string
  photos?: string[]
  createdAt: string
}

// 系统配置
export interface SystemConfig {
  version: string
  updateRequired: boolean
  updateUrl?: string
  maintenanceMode: boolean
  maintenanceMessage?: string
  features: {
    faceVerification: boolean
    sliderVerification: boolean
    onlinePayment: boolean
    couponSystem: boolean
  }
}