import crypto from 'crypto';
import { RedisService } from './RedisService';

export interface FaceDetectionResult {
  success: boolean;
  message?: string;
  data?: {
    faceDetected: boolean;
    features: {
      encoding: number[];
      landmarks: number[][];
      confidence: number;
    };
    confidence: number;
    livenessScore?: number;
    quality?: {
      brightness: number;
      sharpness: number;
      pose: {
        yaw: number;
        pitch: number;
        roll: number;
      };
    };
  };
}

export interface FaceComparisonResult {
  success: boolean;
  message?: string;
  data?: {
    isMatch: boolean;
    similarity: number;
    confidence: number;
    threshold: number;
  };
}

export interface LivenessDetectionResult {
  success: boolean;
  message?: string;
  data?: {
    isLive: boolean;
    score: number;
    confidence: number;
    actions?: string[];
  };
}

export class FaceRecognitionService {
  private redis: RedisService;
  private readonly SIMILARITY_THRESHOLD = 0.8;
  private readonly LIVENESS_THRESHOLD = 0.7;
  private readonly QUALITY_THRESHOLD = 0.6;
  private readonly MAX_FACE_PROFILES = 3;

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 检测人脸并提取特征
   */
  async detectFace(imageBuffer: Buffer): Promise<FaceDetectionResult> {
    try {
      console.log('🔍 开始人脸检测，图片大小:', imageBuffer.length);

      // 验证图片格式和大小
      const validation = this.validateImage(imageBuffer);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message
        };
      }

      // 模拟人脸检测API调用
      // 在实际项目中，这里会调用真实的人脸识别服务API
      const detectionResult = await this.mockFaceDetection(imageBuffer);

      if (!detectionResult.faceDetected) {
        return {
          success: false,
          message: '未检测到人脸，请确保面部清晰可见'
        };
      }

      // 检查图片质量
      const qualityCheck = this.checkImageQuality(detectionResult.quality!);
      if (!qualityCheck.passed) {
        return {
          success: false,
          message: qualityCheck.message
        };
      }

      console.log('✅ 人脸检测成功，置信度:', detectionResult.confidence);

      return {
        success: true,
        message: '人脸检测成功',
        data: {
          faceDetected: true,
          features: detectionResult.features,
          confidence: detectionResult.confidence,
          livenessScore: detectionResult.livenessScore,
          quality: detectionResult.quality
        }
      };

    } catch (error) {
      console.error('❌ 人脸检测失败:', error);
      return {
        success: false,
        message: '人脸检测服务暂时不可用，请稍后重试'
      };
    }
  }

  /**
   * 活体检测
   */
  async detectLiveness(imageBuffer: Buffer, actions?: string[]): Promise<LivenessDetectionResult> {
    try {
      console.log('👁️ 开始活体检测');

      // 模拟活体检测API调用
      const livenessResult = await this.mockLivenessDetection(imageBuffer, actions);

      if (!livenessResult.isLive) {
        return {
          success: false,
          message: '活体检测失败，请确保是真人操作',
          data: {
            isLive: false,
            score: livenessResult.score,
            confidence: livenessResult.confidence
          }
        };
      }

      console.log('✅ 活体检测通过，得分:', livenessResult.score);

      return {
        success: true,
        message: '活体检测通过',
        data: {
          isLive: true,
          score: livenessResult.score,
          confidence: livenessResult.confidence,
          actions: livenessResult.actions
        }
      };

    } catch (error) {
      console.error('❌ 活体检测失败:', error);
      return {
        success: false,
        message: '活体检测服务暂时不可用'
      };
    }
  }

  /**
   * 比较两个人脸特征
   */
  async compareFaces(encoding1: number[], encoding2: number[]): Promise<FaceComparisonResult> {
    try {
      if (!encoding1 || !encoding2 || encoding1.length !== encoding2.length) {
        return {
          success: false,
          message: '人脸特征数据无效'
        };
      }

      // 计算欧几里得距离
      const distance = this.calculateEuclideanDistance(encoding1, encoding2);
      
      // 将距离转换为相似度（0-1之间）
      const similarity = Math.max(0, 1 - distance / 2);
      
      const isMatch = similarity >= this.SIMILARITY_THRESHOLD;
      const confidence = Math.min(similarity * 1.2, 1.0); // 调整置信度

      console.log(`🔍 人脸比较结果: 相似度=${similarity.toFixed(3)}, 匹配=${isMatch}`);

      return {
        success: true,
        data: {
          isMatch,
          similarity,
          confidence,
          threshold: this.SIMILARITY_THRESHOLD
        }
      };

    } catch (error) {
      console.error('❌ 人脸比较失败:', error);
      return {
        success: false,
        message: '人脸比较过程中出现错误'
      };
    }
  }

  /**
   * 生成人脸ID
   */
  generateFaceId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `face_${timestamp}_${random}`;
  }

  /**
   * 验证图片格式和大小
   */
  private validateImage(imageBuffer: Buffer): { valid: boolean; message?: string } {
    // 检查文件大小（最大5MB）
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return {
        valid: false,
        message: '图片文件过大，请选择小于5MB的图片'
      };
    }

    // 检查最小文件大小
    if (imageBuffer.length < 1024) {
      return {
        valid: false,
        message: '图片文件过小，请选择有效的图片文件'
      };
    }

    // 检查图片格式（简单的魔数检查）
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF]);
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    
    const isJpeg = imageBuffer.subarray(0, 3).equals(jpegHeader);
    const isPng = imageBuffer.subarray(0, 4).equals(pngHeader);

    if (!isJpeg && !isPng) {
      return {
        valid: false,
        message: '不支持的图片格式，请使用JPEG或PNG格式'
      };
    }

    return { valid: true };
  }

  /**
   * 检查图片质量
   */
  private checkImageQuality(quality: any): { passed: boolean; message?: string } {
    if (quality.brightness < 0.3 || quality.brightness > 0.9) {
      return {
        passed: false,
        message: '图片亮度不合适，请在光线充足的环境下拍摄'
      };
    }

    if (quality.sharpness < 0.5) {
      return {
        passed: false,
        message: '图片模糊，请重新拍摄清晰的照片'
      };
    }

    // 检查人脸角度
    const { yaw, pitch, roll } = quality.pose;
    if (Math.abs(yaw) > 30 || Math.abs(pitch) > 20 || Math.abs(roll) > 15) {
      return {
        passed: false,
        message: '请保持面部正对摄像头，避免过度倾斜'
      };
    }

    return { passed: true };
  }

  /**
   * 计算欧几里得距离
   */
  private calculateEuclideanDistance(vector1: number[], vector2: number[]): number {
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      const diff = vector1[i] - vector2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * 模拟人脸检测API
   */
  private async mockFaceDetection(imageBuffer: Buffer): Promise<any> {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // 基于图片大小和内容生成模拟结果
    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    const seed = parseInt(hash.substring(0, 8), 16);
    
    // 使用种子生成一致的随机结果
    const random = this.seededRandom(seed);
    
    // 90%的概率检测到人脸
    const faceDetected = random() > 0.1;
    
    if (!faceDetected) {
      return { faceDetected: false };
    }

    // 生成模拟的人脸特征编码（128维向量）
    const encoding = Array.from({ length: 128 }, () => (random() - 0.5) * 2);
    
    // 生成模拟的关键点坐标
    const landmarks = Array.from({ length: 68 }, () => [
      random() * 200 + 100, // x坐标
      random() * 200 + 100  // y坐标
    ]);

    const confidence = 0.7 + random() * 0.25; // 0.7-0.95之间
    const livenessScore = 0.6 + random() * 0.35; // 0.6-0.95之间

    return {
      faceDetected: true,
      features: {
        encoding,
        landmarks,
        confidence
      },
      confidence,
      livenessScore,
      quality: {
        brightness: 0.4 + random() * 0.4, // 0.4-0.8
        sharpness: 0.6 + random() * 0.3,  // 0.6-0.9
        pose: {
          yaw: (random() - 0.5) * 40,   // -20到20度
          pitch: (random() - 0.5) * 30, // -15到15度
          roll: (random() - 0.5) * 20   // -10到10度
        }
      }
    };
  }

  /**
   * 模拟活体检测API
   */
  private async mockLivenessDetection(imageBuffer: Buffer, actions?: string[]): Promise<any> {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    const seed = parseInt(hash.substring(8, 16), 16);
    const random = this.seededRandom(seed);

    // 85%的概率通过活体检测
    const isLive = random() > 0.15;
    const score = isLive ? 0.7 + random() * 0.25 : 0.3 + random() * 0.3;
    const confidence = 0.8 + random() * 0.15;

    return {
      isLive,
      score,
      confidence,
      actions: actions || ['blink', 'turn_head']
    };
  }

  /**
   * 基于种子的伪随机数生成器
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
  }

  /**
   * 获取人脸识别配置
   */
  getConfiguration(): any {
    return {
      similarityThreshold: this.SIMILARITY_THRESHOLD,
      livenessThreshold: this.LIVENESS_THRESHOLD,
      qualityThreshold: this.QUALITY_THRESHOLD,
      maxFaceProfiles: this.MAX_FACE_PROFILES,
      supportedFormats: ['JPEG', 'PNG'],
      maxFileSize: '5MB',
      minImageSize: '100x100',
      recommendedSize: '640x480'
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; message: string; timestamp: number }> {
    try {
      // 创建一个小的测试图片buffer
      const testBuffer = Buffer.alloc(1024, 0xFF);
      
      // 测试基本功能
      const validation = this.validateImage(testBuffer);
      
      return {
        status: 'healthy',
        message: '人脸识别服务运行正常',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: '人脸识别服务异常',
        timestamp: Date.now()
      };
    }
  }
}

export default FaceRecognitionService;