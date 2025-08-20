import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  couponId: string;
  name: string;
  description: string;
  type: 'discount' | 'cashback' | 'free_charging' | 'percentage';
  value: number; // 优惠金额或折扣百分比
  minAmount?: number; // 最小使用金额
  maxDiscount?: number; // 最大优惠金额（用于百分比折扣）
  validFrom: Date;
  validTo: Date;
  totalQuantity: number;
  usedQuantity: number;
  remainingQuantity: number;
  isActive: boolean;
  applicableScenarios: string[]; // 适用场景：charging, recharge, membership
  targetUsers?: string[]; // 目标用户群体
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>({
  couponId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['discount', 'cashback', 'free_charging', 'percentage'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minAmount: {
    type: Number,
    min: 0
  },
  maxDiscount: {
    type: Number,
    min: 0
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTo: {
    type: Date,
    required: true
  },
  totalQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  usedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableScenarios: [{
    type: String,
    enum: ['charging', 'recharge', 'membership']
  }],
  targetUsers: [{
    type: String
  }],
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// 创建索引
CouponSchema.index({ couponId: 1 });
CouponSchema.index({ validFrom: 1, validTo: 1 });
CouponSchema.index({ isActive: 1, validTo: 1 });
CouponSchema.index({ isActive: 1, remainingQuantity: 1 });
CouponSchema.index({ type: 1, applicableScenarios: 1 });
CouponSchema.index({ createdBy: 1, createdAt: -1 });
CouponSchema.index({ createdAt: -1 }); // 用于管理和统计

// 虚拟字段：是否已过期
CouponSchema.virtual('isExpired').get(function() {
  return new Date() > this.validTo;
});

// 虚拟字段：是否可用
CouponSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validTo && 
         this.remainingQuantity > 0;
});

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);