import mongoose, { Document, Schema } from 'mongoose';

// 充电会话接口
export interface IChargingSession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  stationId: mongoose.Types.ObjectId;
  chargerId: string;
  status: 'active' | 'completed' | 'cancelled' | 'error';
  startTime: Date;
  endTime?: Date;
  duration: number; // 秒
  energyDelivered: number; // kWh
  startPowerLevel?: number; // 开始时电量百分比
  endPowerLevel?: number;   // 结束时电量百分比
  totalCost: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 充电会话Schema
const ChargingSessionSchema = new Schema<IChargingSession>({
  sessionId: {
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
  stationId: {
    type: Schema.Types.ObjectId,
    ref: 'ChargingStation',
    required: true
  },
  chargerId: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'error'],
    default: 'active'
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0,
    min: 0
  },
  energyDelivered: {
    type: Number,
    default: 0,
    min: 0
  },
  startPowerLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  endPowerLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  totalCost: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String,
    trim: true
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
ChargingSessionSchema.index({ sessionId: 1 });
ChargingSessionSchema.index({ userId: 1, createdAt: -1 });
ChargingSessionSchema.index({ userId: 1, status: 1 });
ChargingSessionSchema.index({ stationId: 1, status: 1 });
ChargingSessionSchema.index({ chargerId: 1, status: 1 });
ChargingSessionSchema.index({ status: 1, startTime: -1 });
ChargingSessionSchema.index({ paymentStatus: 1, createdAt: -1 });
ChargingSessionSchema.index({ startTime: -1 });
ChargingSessionSchema.index({ createdAt: -1 }); // 用于统计和清理

// 实例方法
ChargingSessionSchema.methods.calculateDuration = function() {
  if (this.endTime) {
    this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
  } else {
    this.duration = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
  return this.duration;
};

ChargingSessionSchema.methods.calculateCost = function(electricityFee: number, serviceFee: number) {
  const totalFee = electricityFee + serviceFee;
  this.totalCost = this.energyDelivered * totalFee;
  return this.totalCost;
};

ChargingSessionSchema.methods.complete = function(endPowerLevel?: number) {
  this.status = 'completed';
  this.endTime = new Date();
  this.calculateDuration();
  if (endPowerLevel !== undefined) {
    this.endPowerLevel = endPowerLevel;
  }
  return this.save();
};

ChargingSessionSchema.methods.cancel = function(reason?: string) {
  this.status = 'cancelled';
  this.endTime = new Date();
  this.calculateDuration();
  if (reason) {
    this.errorMessage = reason;
  }
  return this.save();
};

ChargingSessionSchema.methods.setError = function(errorMessage: string) {
  this.status = 'error';
  this.endTime = new Date();
  this.calculateDuration();
  this.errorMessage = errorMessage;
  return this.save();
};

// 静态方法
ChargingSessionSchema.statics.findActiveByUser = function(userId: string) {
  return this.findOne({ 
    userId, 
    status: 'active' 
  }).populate('stationId', 'name address');
};

ChargingSessionSchema.statics.findByCharger = function(chargerId: string) {
  return this.find({ chargerId }).populate('userId', 'phone nickName');
};

ChargingSessionSchema.statics.getSessionStats = function(userId: string, startDate?: Date, endDate?: Date) {
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
        _id: null,
        totalSessions: { $sum: 1 },
        totalEnergy: { $sum: '$energyDelivered' },
        totalCost: { $sum: '$totalCost' },
        totalDuration: { $sum: '$duration' },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    }
  ]);
};

export default mongoose.model<IChargingSession>('ChargingSession', ChargingSessionSchema);