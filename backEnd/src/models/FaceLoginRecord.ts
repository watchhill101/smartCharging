import mongoose, { Document, Schema } from 'mongoose';

export interface IFaceLoginRecord extends Document {
  userId: mongoose.Types.ObjectId;
  faceId: string;
  success: boolean;
  confidence: number;
  loginAt: Date;
  ipAddress: string;
  userAgent: string;
  deviceInfo: {
    platform: string;
    browser: string;
    version: string;
  };
  failureReason?: string;
  livenessScore?: number;
  processingTime?: number; // 处理时间（毫秒）
}

export interface IFaceLoginRecordModel extends mongoose.Model<IFaceLoginRecord> {
  // 静态方法
  getLoginHistory(userId: string, limit?: number): Promise<IFaceLoginRecord[]>;
  getFailureStats(userId: string, hours?: number): Promise<{
    totalAttempts: number;
    failedAttempts: number;
    failureRate: number;
    commonReasons: Array<{ reason: string; count: number }>;
  }>;
  cleanupOldRecords(daysToKeep?: number): Promise<number>;
  getSecurityReport(userId: string, days?: number): Promise<{
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueIPs: number;
    suspiciousActivity: boolean;
    averageConfidence: number;
  }>;
}

const FaceLoginRecordSchema = new Schema<IFaceLoginRecord>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  faceId: {
    type: String,
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && isFinite(v);
      },
      message: '置信度必须是有效的数值'
    }
  },
  loginAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    validate: {
      validator: function(v: string) {
        // 支持IPv4和IPv6地址
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(v) || ipv6Regex.test(v) || v === 'unknown';
      },
      message: '无效的IP地址格式'
    }
  },
  userAgent: {
    type: String,
    required: true,
    maxlength: 1000
  },
  deviceInfo: {
    platform: {
      type: String,
      required: true,
      enum: ['web', 'ios', 'android', 'wechat', 'alipay', 'unknown'],
      default: 'unknown'
    },
    browser: {
      type: String,
      default: 'unknown',
      maxlength: 100
    },
    version: {
      type: String,
      default: 'unknown',
      maxlength: 50
    }
  },
  failureReason: {
    type: String,
    maxlength: 200,
    enum: [
      'face_not_detected',
      'low_confidence',
      'no_matching_profile',
      'liveness_check_failed',
      'poor_image_quality',
      'multiple_faces_detected',
      'service_error',
      'timeout',
      'unknown'
    ]
  },
  livenessScore: {
    type: Number,
    min: 0,
    max: 1
  },
  processingTime: {
    type: Number,
    min: 0,
    max: 30000 // 最大30秒
  }
}, {
  timestamps: false, // 使用自定义的loginAt字段
  collection: 'face_login_records'
});

// 复合索引
FaceLoginRecordSchema.index({ userId: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ userId: 1, success: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ faceId: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ ipAddress: 1, loginAt: -1 });
FaceLoginRecordSchema.index({ loginAt: 1 }); // 用于清理旧记录

// 静态方法：获取登录历史
FaceLoginRecordSchema.statics.getLoginHistory = async function(
  userId: string, 
  limit = 50
): Promise<IFaceLoginRecord[]> {
  return this.find({
    userId: new mongoose.Types.ObjectId(userId)
  })
  .sort({ loginAt: -1 })
  .limit(limit)
  .lean();
};

// 静态方法：获取失败统计
FaceLoginRecordSchema.statics.getFailureStats = async function(
  userId: string, 
  hours = 24
): Promise<any> {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        loginAt: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        failedAttempts: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
        failures: {
          $push: {
            $cond: [
              { $eq: ['$success', false] },
              '$failureReason',
              null
            ]
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  
  if (!result.length) {
    return {
      totalAttempts: 0,
      failedAttempts: 0,
      failureRate: 0,
      commonReasons: []
    };
  }

  const stats = result[0];
  const failureRate = stats.totalAttempts > 0 ? 
    (stats.failedAttempts / stats.totalAttempts) * 100 : 0;

  // 统计失败原因
  const reasonCounts: { [key: string]: number } = {};
  stats.failures.filter((reason: string) => reason).forEach((reason: string) => {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  const commonReasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAttempts: stats.totalAttempts,
    failedAttempts: stats.failedAttempts,
    failureRate: Math.round(failureRate * 100) / 100,
    commonReasons
  };
};

// 静态方法：清理旧记录
FaceLoginRecordSchema.statics.cleanupOldRecords = async function(daysToKeep = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const result = await this.deleteMany({
    loginAt: { $lt: cutoffDate }
  });
  
  return result.deletedCount || 0;
};

// 静态方法：获取安全报告
FaceLoginRecordSchema.statics.getSecurityReport = async function(
  userId: string, 
  days = 30
): Promise<any> {
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - days);

  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        loginAt: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: null,
        totalLogins: { $sum: 1 },
        successfulLogins: { $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] } },
        failedLogins: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
        uniqueIPs: { $addToSet: '$ipAddress' },
        avgConfidence: { $avg: '$confidence' },
        suspiciousIPs: {
          $push: {
            $cond: [
              { $and: [
                { $eq: ['$success', false] },
                { $ne: ['$ipAddress', 'unknown'] }
              ]},
              '$ipAddress',
              null
            ]
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  
  if (!result.length) {
    return {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      uniqueIPs: 0,
      suspiciousActivity: false,
      averageConfidence: 0
    };
  }

  const stats = result[0];
  
  // 检测可疑活动：同一IP多次失败登录
  const suspiciousIPs = stats.suspiciousIPs.filter((ip: string) => ip);
  const ipFailureCounts: { [key: string]: number } = {};
  suspiciousIPs.forEach((ip: string) => {
    ipFailureCounts[ip] = (ipFailureCounts[ip] || 0) + 1;
  });
  
  const suspiciousActivity = Object.values(ipFailureCounts).some(count => count >= 5);

  return {
    totalLogins: stats.totalLogins,
    successfulLogins: stats.successfulLogins,
    failedLogins: stats.failedLogins,
    uniqueIPs: stats.uniqueIPs.length,
    suspiciousActivity,
    averageConfidence: Math.round(stats.avgConfidence * 1000) / 1000
  };
};

// 中间件：保存前处理
FaceLoginRecordSchema.pre('save', function(next) {
  // 如果是失败的登录但没有失败原因，设置默认原因
  if (!this.success && !this.failureReason) {
    this.failureReason = 'unknown';
  }
  
  // 如果是成功的登录，清除失败原因
  if (this.success) {
    this.failureReason = undefined;
  }
  
  next();
});

// 虚拟字段：登录结果描述
FaceLoginRecordSchema.virtual('resultDescription').get(function() {
  if (this.success) {
    return `登录成功 (置信度: ${(this.confidence * 100).toFixed(1)}%)`;
  } else {
    const reasonMap: { [key: string]: string } = {
      'face_not_detected': '未检测到人脸',
      'low_confidence': '置信度过低',
      'no_matching_profile': '未找到匹配的人脸档案',
      'liveness_check_failed': '活体检测失败',
      'poor_image_quality': '图片质量不佳',
      'multiple_faces_detected': '检测到多个人脸',
      'service_error': '服务错误',
      'timeout': '处理超时',
      'unknown': '未知错误'
    };
    
    const reason = reasonMap[this.failureReason || 'unknown'] || '未知错误';
    return `登录失败: ${reason}`;
  }
});

// 虚拟字段：安全等级
FaceLoginRecordSchema.virtual('securityLevel').get(function() {
  if (!this.success) return 'failed';
  
  if (this.confidence >= 0.9 && this.livenessScore && this.livenessScore >= 0.8) {
    return 'high';
  } else if (this.confidence >= 0.8) {
    return 'medium';
  } else {
    return 'low';
  }
});

// 确保虚拟字段在JSON序列化时包含
FaceLoginRecordSchema.set('toJSON', { virtuals: true });
FaceLoginRecordSchema.set('toObject', { virtuals: true });

const FaceLoginRecord = mongoose.model<IFaceLoginRecord, IFaceLoginRecordModel>(
  'FaceLoginRecord', 
  FaceLoginRecordSchema
);

export default FaceLoginRecord;