import mongoose, { Document, Schema } from 'mongoose';

// 人脸特征数据接口
interface IFaceFeatures {
  encoding: number[]; // 人脸编码向量
  landmarks: number[][]; // 面部关键点
  confidence: number; // 识别置信度
}

// 人脸档案接口
export interface IFaceProfile extends Document {
  userId: mongoose.Types.ObjectId;
  faceId: string; // 唯一的人脸ID
  features: IFaceFeatures;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    ip: string;
  };
}

// 人脸特征Schema
const FaceFeaturesSchema = new Schema<IFaceFeatures>({
  encoding: {
    type: [Number],
    required: true
  },
  landmarks: {
    type: [[Number]],
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  }
}, { _id: false });

// 人脸档案Schema
const FaceProfileSchema = new Schema<IFaceProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  faceId: {
    type: String,
    required: true,
    unique: true
  },
  features: {
    type: FaceFeaturesSchema,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    ip: String
  }
}, {
  timestamps: true
});

// 索引
FaceProfileSchema.index({ userId: 1 });
FaceProfileSchema.index({ faceId: 1 });
FaceProfileSchema.index({ isActive: 1 });
FaceProfileSchema.index({ createdAt: -1 });

// 实例方法
FaceProfileSchema.methods.updateLastUsed = function () {
  this.lastUsedAt = new Date();
  return this.save();
};

// 静态方法
FaceProfileSchema.statics.findByUserId = function (userId: string) {
  return this.find({ userId, isActive: true });
};

FaceProfileSchema.statics.findByFaceId = function (faceId: string) {
  return this.findOne({ faceId, isActive: true });
};

// 静态方法扩展接口
interface IFaceProfileModel extends mongoose.Model<IFaceProfile> {
  findByUserId(userId: string): Promise<IFaceProfile[]>;
  findByFaceId(faceId: string): Promise<IFaceProfile | null>;
}

export default mongoose.model<IFaceProfile, IFaceProfileModel>('FaceProfile', FaceProfileSchema); 