
import mongoose, { Document, Schema } from 'mongoose';

// 充电偏好接口
interface IChargingPreferences {
  maxChargingPower?: number; // 最大充电功率 (kW)
  targetSoc?: number; // 目标充电电量百分比 (0-100)
  chargingSchedule?: {
    enabled: boolean;
    startTime: string; // HH:MM 格式
    endTime: string; // HH:MM 格式
    daysOfWeek: number[]; // 0-6 (周日到周六)
  };
  preferredChargingType?: 'fast' | 'slow' | 'auto'; // 偏好充电类型
  temperatureControl?: boolean; // 是否启用温度控制
  notifications?: {
    chargingStart: boolean;
    chargingComplete: boolean;
    chargingError: boolean;
  };
}

// 车辆信息接口
interface IVehicle {
  id?: string; // 车辆唯一标识
  brand: string; // 品牌
  model: string; // 型号
  year?: number; // 年份
  color?: string; // 颜色
  licensePlate: string; // 车牌号
  batteryCapacity?: number; // 电池容量 (kWh)
  range?: number; // 续航里程 (km)
  chargingPortType?: 'CCS' | 'CHAdeMO' | 'Type2' | 'GB/T'; // 充电接口类型
  isDefault?: boolean; // 是否为默认车辆
  chargingPreferences?: IChargingPreferences; // 充电偏好设置
  createdAt?: Date;
  updatedAt?: Date;
}

// 紧急联系人接口
interface IEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

// 用户偏好设置接口
interface IUserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  privacy: {
    showProfile: boolean;
    showChargingHistory: boolean;
  };
}

// 安全问题接口
interface ISecurityQuestion {
  question: string;
  answer: string;
}

// 用户接口
export interface IUser extends Document {
  phone: string;
  password?: string;
  nickName?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string; // 保持向后兼容
  gender?: 'male' | 'female' | 'other';
  birthday?: Date;
  address?: string;
  emergencyContact?: IEmergencyContact;
  preferences?: IUserPreferences;
  balance: number;
  vehicles: IVehicle[];
  lastLoginAt?: Date;
  lastLoginIP?: string;
  loginAttempts?: number;
  isLocked?: boolean;
  lockedUntil?: Date;
  passwordChangedAt?: Date;
  twoFactorEnabled?: boolean;
  securityQuestions?: ISecurityQuestion[];
  totalLogins?: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletionReason?: string;
  faceEnabled: boolean; // 是否启用人脸登录
  faceProfileCount: number; // 人脸档案数量
  verificationLevel?: 'basic' | 'face_verified'; // 验证级别
  createdAt: Date;
  updatedAt: Date;
}

// 车辆Schema
// 充电偏好Schema
const ChargingPreferencesSchema = new Schema<IChargingPreferences>({
  maxChargingPower: {
    type: Number,
    min: 1,
    max: 350 // 最大350kW
  },
  targetSoc: {
    type: Number,
    min: 10,
    max: 100,
    default: 80
  },
  chargingSchedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
      type: String,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    daysOfWeek: [{
      type: Number,
      min: 0,
      max: 6
    }]
  },
  preferredChargingType: {
    type: String,
    enum: ['fast', 'slow', 'auto'],
    default: 'auto'
  },
  temperatureControl: {
    type: Boolean,
    default: true
  },
  notifications: {
    chargingStart: {
      type: Boolean,
      default: true
    },
    chargingComplete: {
      type: Boolean,
      default: true
    },
    chargingError: {
      type: Boolean,
      default: true
    }
  }
});

// 车辆Schema
const VehicleSchema = new Schema<IVehicle>({
  brand: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  model: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  year: {
    type: Number,
    min: 2000,
    max: new Date().getFullYear() + 2
  },
  color: {
    type: String,
    trim: true,
    maxlength: 30
  },
  licensePlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/
  },
  batteryCapacity: {
    type: Number,
    min: 10,
    max: 200,
    default: 60
  },
  range: {
    type: Number,
    min: 50,
    max: 1000
  },
  chargingPortType: {
    type: String,
    enum: ['CCS', 'CHAdeMO', 'Type2', 'GB/T'],
    default: 'GB/T'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  chargingPreferences: ChargingPreferencesSchema
}, {
  timestamps: true
});

// 紧急联系人Schema
const EmergencyContactSchema = new Schema<IEmergencyContact>({
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  phone: {
    type: String,
    required: true,
    match: /^1[3-9]\d{9}$/
  },
  relationship: {
    type: String,
    required: true,
    maxlength: 20
  }
});

// 用户偏好设置Schema
const UserPreferencesSchema = new Schema<IUserPreferences>({
  language: {
    type: String,
    default: 'zh-CN'
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  privacy: {
    showProfile: {
      type: Boolean,
      default: true
    },
    showChargingHistory: {
      type: Boolean,
      default: true
    }
  }
});

// 安全问题Schema
const SecurityQuestionSchema = new Schema<ISecurityQuestion>({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
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
    maxlength: 20,
    default: function () {
      return `用户${(this as any).phone?.slice(-4) || '0000'}`;
    }
  },
  email: {
    type: String,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    sparse: true // 允许多个null值，但不允许重复的非null值
  },
  avatar: {
    type: String
  },
  avatarUrl: {
    type: String,
    required: false
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  birthday: {
    type: Date
  },
  address: {
    type: String,
    maxlength: 200
  },
  emergencyContact: EmergencyContactSchema,
  preferences: UserPreferencesSchema,
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  vehicles: [VehicleSchema],
  lastLoginAt: {
    type: Date
  },
  lastLoginIP: {
    type: String
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedUntil: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  securityQuestions: [SecurityQuestionSchema],
  totalLogins: {
    type: Number,
    default: 0
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletionReason: {
    type: String,
    maxlength: 200
  },
  faceEnabled: {
    type: Boolean,
    default: false
  },
  faceProfileCount: {
    type: Number,
    default: 0
  },
  verificationLevel: {
    type: String,
    enum: ['basic', 'face_verified'],
    default: 'basic'
  }
}, {
  timestamps: true
});

// 创建索引
UserSchema.index({ phone: 1 });
UserSchema.index({ email: 1 }, { sparse: true });
UserSchema.index({ isDeleted: 1 });
UserSchema.index({ createdAt: 1 });

// 查询中间件：默认过滤已删除的用户
UserSchema.pre(/^find/, function(this: any) {
  if (!this.getQuery().isDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
});

export default mongoose.model<IUser>('User', UserSchema);