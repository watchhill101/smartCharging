import mongoose, { Document, Schema } from 'mongoose';

export interface IFaceProfile extends Document {
  userId: mongoose.Types.ObjectId;
  faceId: string;
  features: {
    encoding: number[];
    landmarks: number[][];
    confidence: number;
  };
  deviceInfo: {
    userAgent: string;
    platform: string;
    ip: string;
  };
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  
  // 实例方法
  updateLastUsed(): Promise<void>;
  deactivate(): Promise<void>;
}

export interface IFaceProfileModel extends mongoose.Model<IFaceProfile> {
  // 静态方法
  getActiveProfiles(userId: string): Promise<IFaceProfile[]>;
  checkProfileLimit(userId: string, maxProfiles: number): Promise<boolean>;
  findByFaceId(faceId: string): Promise<IFaceProfile | null>;
  cleanupInactiveProfiles(daysInactive: number): Promise<number>;
}

const FaceProfileSchema = new Schema<IFaceProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  faceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  features: {
    encoding: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v: number[]) {
          return v && v.length === 128; // 标准人脸特征向量长度
        },
        message: '人脸特征编码必须是128维向量'
      }
    },
    landmarks: {
      type: [[Number]],
      required: true,
      validate: {
        validator: function(v: number[][]) {
          return v && v.length === 68 && v.every(point => point.length === 2);
        },
        message: '人脸关键点必须包含68个二维坐标点'
      }
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    }
  },
  deviceInfo: {
    userAgent: {
      type: String,
      required: true,
      maxlength: 500
    },
    platform: {
      type: String,
      required: true,
      enum: ['web', 'ios', 'android', 'wechat', 'alipay', 'unknown'],
      default: 'unknown'
    },
    ip: {
      type: String,
      required: true,
      validate: {
        validator: function(v: string) {
          // 简单的IP地址验证
          const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return ipRegex.test(v) || v === 'unknown';
        },
        message: '无效的IP地址格式'
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUsedAt: {
    type: Date,
    index: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: false, // 我们手动管理时间戳
  collection: 'face_profiles'
});

// 复合索引
FaceProfileSchema.index({ userId: 1, isActive: 1 });
FaceProfileSchema.index({ userId: 1, createdAt: -1 });
FaceProfileSchema.index({ lastUsedAt: 1 }, { sparse: true });

// 实例方法
FaceProfileSchema.methods.updateLastUsed = async function(): Promise<void> {
  this.lastUsedAt = new Date();
  this.usageCount += 1;
  await this.save();
};

FaceProfileSchema.methods.deactivate = async function(): Promise<void> {
  this.isActive = false;
  await this.save();
};

// 静态方法
FaceProfileSchema.statics.getActiveProfiles = async function(userId: string): Promise<IFaceProfile[]> {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true
  }).sort({ createdAt: -1 });
};

FaceProfileSchema.statics.checkProfileLimit = async function(userId: string, maxProfiles: number): Promise<boolean> {
  const count = await this.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true
  });
  return count >= maxProfiles;
};

FaceProfileSchema.statics.findByFaceId = async function(faceId: string): Promise<IFaceProfile | null> {
  return this.findOne({ faceId, isActive: true });
};

FaceProfileSchema.statics.cleanupInactiveProfiles = async function(daysInactive: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
  
  const result = await this.deleteMany({
    $or: [
      { lastUsedAt: { $lt: cutoffDate } },
      { 
        lastUsedAt: { $exists: false },
        createdAt: { $lt: cutoffDate }
      }
    ],
    isActive: false
  });
  
  return result.deletedCount || 0;
};

// 中间件：保存前验证
FaceProfileSchema.pre('save', function(next) {
  // 确保faceId的唯一性和格式
  if (this.isNew && !this.faceId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    this.faceId = `face_${timestamp}_${random}`;
  }
  
  // 验证特征向量的有效性
  if (this.features && this.features.encoding) {
    const encoding = this.features.encoding;
    if (!Array.isArray(encoding) || encoding.length !== 128) {
      return next(new Error('人脸特征编码必须是128维数组'));
    }
    
    // 检查是否包含有效的数值
    if (encoding.some(val => typeof val !== 'number' || isNaN(val))) {
      return next(new Error('人脸特征编码包含无效数值'));
    }
  }
  
  next();
});

// 中间件：删除前清理
FaceProfileSchema.pre('deleteOne', { document: true, query: false }, async function() {
  console.log(`🗑️ 删除人脸档案: ${this.faceId}`);
});

// 虚拟字段：档案年龄（天数）
FaceProfileSchema.virtual('ageInDays').get(function() {
  if (!this.createdAt) return 0;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.createdAt.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// 虚拟字段：最后使用天数
FaceProfileSchema.virtual('daysSinceLastUsed').get(function() {
  if (!this.lastUsedAt) return null;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.lastUsedAt.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// 虚拟字段：使用频率（次/天）
FaceProfileSchema.virtual('usageFrequency').get(function() {
  const ageInDays = this.ageInDays;
  if (ageInDays === 0) return 0;
  return (this.usageCount / ageInDays).toFixed(2);
});

// 确保虚拟字段在JSON序列化时包含
FaceProfileSchema.set('toJSON', { virtuals: true });
FaceProfileSchema.set('toObject', { virtuals: true });

const FaceProfile = mongoose.model<IFaceProfile, IFaceProfileModel>('FaceProfile', FaceProfileSchema);

export default FaceProfile;