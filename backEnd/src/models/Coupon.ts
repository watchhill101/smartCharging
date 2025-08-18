import mongoose, { Document, Schema } from 'mongoose';

// 优惠券类型枚举
export enum CouponType {
  DISCOUNT = 'discount',      // 折扣券
  AMOUNT = 'amount',          // 满减券
  FREE_CHARGE = 'free_charge', // 免费充电券
  POINTS = 'points'           // 积分券
}

// 优惠券状态枚举
export enum CouponStatus {
  UNUSED = 'unused',          // 未使用
  USED = 'used',              // 已使用
  EXPIRED = 'expired'         // 已过期
}

// 优惠券接口
export interface ICoupon extends Document {
  userId: string;              // 用户ID
  type: CouponType;           // 优惠券类型
  title: string;              // 优惠券标题
  description: string;        // 优惠券描述
  value: number;              // 优惠券面值（折扣率、金额等）
  minAmount?: number;         // 最低消费金额（满减券使用）
  maxDiscount?: number;       // 最大优惠金额（折扣券使用）
  validFrom: Date;            // 生效时间
  validUntil: Date;           // 过期时间
  status: CouponStatus;       // 优惠券状态
  usedAt?: Date;              // 使用时间
  usedInOrder?: string;       // 使用的订单ID
  conditions?: string[];      // 使用条件
  applicableStations?: string[]; // 适用充电站ID列表
  applicableChargers?: string[]; // 适用充电桩类型
  isActive: boolean;          // 是否激活
  createdAt: Date;            // 创建时间
  updatedAt: Date;            // 更新时间
}

// 优惠券Schema
const CouponSchema = new Schema<ICoupon>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(CouponType),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  maxDiscount: {
    type: Number,
    min: 0
  },
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(CouponStatus),
    default: CouponStatus.UNUSED
  },
  usedAt: {
    type: Date
  },
  usedInOrder: {
    type: String
  },
  conditions: [{
    type: String,
    trim: true
  }],
  applicableStations: [{
    type: String
  }],
  applicableChargers: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// 索引
CouponSchema.index({ userId: 1, status: 1 });
CouponSchema.index({ userId: 1, validUntil: 1 });
CouponSchema.index({ status: 1, validUntil: 1 });
CouponSchema.index({ type: 1, isActive: 1 });

// 实例方法
CouponSchema.methods.isValid = function(): boolean {
  const now = new Date();
  return this.isActive && 
         this.status === CouponStatus.UNUSED && 
         now >= this.validFrom && 
         now <= this.validUntil;
};

CouponSchema.methods.use = function(orderId: string) {
  this.status = CouponStatus.USED;
  this.usedAt = new Date();
  this.usedInOrder = orderId;
  return this.save();
};

CouponSchema.methods.expire = function() {
  this.status = CouponStatus.EXPIRED;
  return this.save();
};

// 静态方法
CouponSchema.statics.findValidCoupons = function(userId: string) {
  const now = new Date();
  return this.find({
    userId,
    isActive: true,
    status: CouponStatus.UNUSED,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  }).sort({ validUntil: 1 });
};

CouponSchema.statics.findExpiredCoupons = function(userId: string) {
  const now = new Date();
  return this.find({
    userId,
    validUntil: { $lt: now },
    status: { $ne: CouponStatus.USED }
  });
};

CouponSchema.statics.updateExpiredStatus = function() {
  const now = new Date();
  return this.updateMany(
    {
      validUntil: { $lt: now },
      status: CouponStatus.UNUSED
    },
    {
      $set: { status: CouponStatus.EXPIRED }
    }
  );
};

export default mongoose.model<ICoupon>('Coupon', CouponSchema);
