
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
  password?: string;
  nickName?: string;
  avatarUrl?: string;
  balance: number;
  vehicles: IVehicle[];
  lastLoginAt?: Date;
  faceEnabled: boolean; // 是否启用人脸登录
  faceProfileCount: number; // 人脸档案数量
  createdAt: Date;
  updatedAt: Date;
}

// 车辆Schema
const VehicleSchema = new Schema<IVehicle>({
  brand: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  licensePlate: {
    type: String,
    required: true,
    unique: true
  },
  batteryCapacity: {
    type: Number,
    default: 60
  }
});

// 用户Schema
const UserSchema = new Schema<IUser>({
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^1[3-9]\d{9}$/
  },
  password: {
    type: String,
    required: false
  },
  nickName: {
    type: String,
    default: function () {
      return `用户${(this as any).phone?.slice(-4) || '0000'}`;
    }
  },
  avatarUrl: {
    type: String,
    required: false
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  vehicles: [VehicleSchema],
  lastLoginAt: {
    type: Date
  },
  faceEnabled: {
    type: Boolean,
    default: false
  },
  faceProfileCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 创建索引
UserSchema.index({ phone: 1 });

export default mongoose.model<IUser>('User', UserSchema);