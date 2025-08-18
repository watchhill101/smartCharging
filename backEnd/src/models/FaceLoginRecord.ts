import mongoose, { Document, Schema } from 'mongoose';

// 人脸登录记录接口
export interface IFaceLoginRecord extends Document {
  userId: mongoose.Types.ObjectId;
  faceId: string;
  success: boolean;
  confidence: number;
  loginAt: Date;
  ipAddress: string;
  userAgent: string;
  deviceInfo?: {
    platform: string;
    browser: string;
    version: string;
  };
  failureReason?: string;
  attempts: number; // 尝试次数
}

// 人脸登录记录Schema
const FaceLoginRecordSchema = new Schema<IFaceLoginRecord>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  faceId: {
    type: String,
    required: true
  },
  success: {
    type: Boolean,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  loginAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    platform: String,
    browser: String,
    version: String
  },
  failureReason: {
    type: String
  },
  attempts: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// 索引
FaceLoginRecordSchema.index({ userId: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ faceId: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ success: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ ipAddress: 1 });

// 静态方法
FaceLoginRecordSchema.statics.getRecentAttempts = function (userId: string, minutes: number = 5) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return this.find({
    userId,
    loginAt: { $gte: since }
  }).sort({ loginAt: -1 });
};

FaceLoginRecordSchema.statics.getFailedAttempts = function (userId: string, minutes: number = 15) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return this.countDocuments({
    userId,
    success: false,
    loginAt: { $gte: since }
  });
};

// 静态方法扩展接口
interface IFaceLoginRecordModel extends mongoose.Model<IFaceLoginRecord> {
  getRecentAttempts(userId: string, minutes?: number): Promise<IFaceLoginRecord[]>;
  getFailedAttempts(userId: string, minutes?: number): Promise<number>;
}

export default mongoose.model<IFaceLoginRecord, IFaceLoginRecordModel>('FaceLoginRecord', FaceLoginRecordSchema); 