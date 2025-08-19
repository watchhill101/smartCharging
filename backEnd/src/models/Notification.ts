import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: string;
  type: 'charging' | 'payment' | 'system' | 'coupon' | 'maintenance';
  subType: string;
  title: string;
  content: string;
  data?: any;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('websocket' | 'push' | 'sms' | 'email')[];
  scheduledAt?: Date;
  sentAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['charging', 'payment', 'system', 'coupon', 'maintenance'],
    required: true
  },
  subType: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: Schema.Types.Mixed
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  channels: [{
    type: String,
    enum: ['websocket', 'push', 'sms', 'email']
  }],
  scheduledAt: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 创建索引
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ type: 1, subType: 1 });
NotificationSchema.index({ scheduledAt: 1 });
NotificationSchema.index({ expiresAt: 1 });
NotificationSchema.index({ priority: 1, createdAt: -1 });

// 虚拟字段：是否已过期
NotificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);