
import mongoose, { Document, Schema } from 'mongoose';

// 车辆信息接口
interface IVehicle {
  brand: string;
  model: string;
  licensePlate: string;
  batteryCapacity?: number;
}

// 用户接口
export interface IUser extends Document {
  phone: string;
  nickName?: string;
  avatarUrl?: string;
  balance: number;
  faceFeatures?: string;
  verificationLevel: 'basic' | 'face_verified';
  vehicles: IVehicle[];
  createdAt: Date;
  updatedAt: Date;
}

// 车辆Schema
const VehicleSchema = new Schema<IVehicle>({
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  licensePlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  batteryCapacity: {
    type: Number,
    min: 0
  }
}, { _id: false });

// 用户Schema
const UserSchema = new Schema<IUser>({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^1[3-9]\d{9}$/
  },
  nickName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  avatarUrl: {
    type: String,
    trim: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  faceFeatures: {
    type: String,
    select: false // 默认不返回敏感数据
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'face_verified'],
    default: 'basic'
  },
  vehicles: [VehicleSchema]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.faceFeatures;
      return ret;
    }
  }
});

// 索引
UserSchema.index({ phone: 1 });
UserSchema.index({ createdAt: -1 });

// 实例方法
UserSchema.methods.addVehicle = function(vehicle: IVehicle) {
  this.vehicles.push(vehicle);
  return this.save();
};

UserSchema.methods.removeVehicle = function(licensePlate: string) {
  this.vehicles = this.vehicles.filter(v => v.licensePlate !== licensePlate);
  return this.save();
};

UserSchema.methods.updateBalance = function(amount: number) {
  this.balance += amount;
  return this.save();
};

export default mongoose.model<IUser>('User', UserSchema);