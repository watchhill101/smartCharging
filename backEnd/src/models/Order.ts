import mongoose, { Document, Schema } from 'mongoose';

// 订单接口
export interface IOrder extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId;
  type: 'charging' | 'recharge';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  paymentMethod: 'balance' | 'alipay';
  sessionId?: mongoose.Types.ObjectId; // 关联充电会话
  thirdPartyOrderId?: string; // 第三方支付订单号
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 订单Schema
const OrderSchema = new Schema<IOrder>({
  orderId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['charging', 'recharge'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['balance', 'alipay'],
    required: true
  },
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'ChargingSession'
  },
  thirdPartyOrderId: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  metadata: {
    type: Schema.Types.Mixed
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
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ type: 1 });
OrderSchema.index({ paymentMethod: 1 });
OrderSchema.index({ thirdPartyOrderId: 1 });
OrderSchema.index({ sessionId: 1 });

// 实例方法
OrderSchema.methods.markAsPaid = function(thirdPartyOrderId?: string) {
  this.status = 'paid';
  if (thirdPartyOrderId) {
    this.thirdPartyOrderId = thirdPartyOrderId;
  }
  return this.save();
};

OrderSchema.methods.markAsCancelled = function(reason?: string) {
  this.status = 'cancelled';
  if (reason) {
    this.metadata = { ...this.metadata, cancelReason: reason };
  }
  return this.save();
};

OrderSchema.methods.markAsRefunded = function(refundAmount?: number, reason?: string) {
  this.status = 'refunded';
  this.metadata = { 
    ...this.metadata, 
    refundAmount: refundAmount || this.amount,
    refundReason: reason 
  };
  return this.save();
};

// 静态方法
OrderSchema.statics.generateOrderId = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `ORD${timestamp}${random}`.toUpperCase();
};

OrderSchema.statics.findByUser = function(
  userId: string, 
  type?: string, 
  status?: string,
  limit: number = 20,
  skip: number = 0
) {
  const query: any = { userId };
  if (type) query.type = type;
  if (status) query.status = status;

  return this.find(query)
    .populate('sessionId', 'sessionId stationId chargerId startTime endTime')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

OrderSchema.statics.getOrderStats = function(userId: string, startDate?: Date, endDate?: Date) {
  const matchQuery: any = { userId };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = startDate;
    if (endDate) matchQuery.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$type',
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        paidOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        paidAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
        }
      }
    }
  ]);
};

OrderSchema.statics.findPendingOrders = function(olderThanMinutes: number = 30) {
  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  return this.find({
    status: 'pending',
    createdAt: { $lt: cutoffTime }
  });
};

export default mongoose.model<IOrder>('Order', OrderSchema);