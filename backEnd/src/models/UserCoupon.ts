import mongoose, { Document, Schema } from 'mongoose';

export interface IUserCoupon extends Document {
  userId: string;
  couponId: string;
  couponCode: string;
  status: 'available' | 'used' | 'expired';
  receivedAt: Date;
  usedAt?: Date;
  usedOrderId?: string;
  expiredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserCouponSchema = new Schema<IUserCoupon>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  couponId: {
    type: String,
    required: true,
    index: true
  },
  couponCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'used', 'expired'],
    default: 'available'
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  usedAt: {
    type: Date
  },
  usedOrderId: {
    type: String
  },
  expiredAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// 创建复合索引
UserCouponSchema.index({ userId: 1, status: 1 });
UserCouponSchema.index({ userId: 1, expiredAt: 1 });
UserCouponSchema.index({ couponCode: 1 }, { unique: true });
UserCouponSchema.index({ status: 1, expiredAt: 1 });

// 虚拟字段：是否已过期
UserCouponSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiredAt;
});

// 虚拟字段：是否可用
UserCouponSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && new Date() <= this.expiredAt;
});

export const UserCoupon = mongoose.model<IUserCoupon>('UserCoupon', UserCouponSchema);