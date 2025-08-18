import crypto from 'crypto';

// 人脸识别结果接口
export interface FaceDetectionResult {
  success: boolean;
  message: string;
  data?: {
    faceDetected: boolean;
    faceCount: number;
    confidence: number;
    features?: {
      encoding: number[];
      landmarks: number[][];
    };
    quality: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

// 人脸比对结果接口
export interface FaceComparisonResult {
  success: boolean;
  message: string;
  data?: {
    isMatch: boolean;
    similarity: number;
    confidence: number;
    threshold: number;
  };
}

export class FaceRecognitionService {
  private readonly SIMILARITY_THRESHOLD = 0.75; // 相似度阈值
  private readonly MIN_CONFIDENCE = 0.6; // 最小置信度
  private readonly MAX_FACE_PROFILES = 3; // 每个用户最多人脸档案数

  /**
   * 检测图片中的人脸
   */
  async detectFace(imageData: Buffer): Promise<FaceDetectionResult> {
    try {
      // 模拟人脸检测过程
      console.log('🔍 开始人脸检测...');

      // 检查图片大小
      if (imageData.length === 0) {
        return {
          success: false,
          message: '图片数据为空'
        };
      }

      if (imageData.length > 5 * 1024 * 1024) { // 5MB限制
        return {
          success: false,
          message: '图片文件过大，请选择小于5MB的图片'
        };
      }

      // 模拟人脸检测算法
      const mockDetection = this.simulateFaceDetection(imageData);

      if (!mockDetection.faceDetected) {
        return {
          success: false,
          message: '未检测到人脸，请确保面部清晰可见',
          data: {
            ...mockDetection,
            quality: mockDetection.quality as 'excellent' | 'good' | 'fair' | 'poor'
          }
        };
      }

      if (mockDetection.faceCount > 1) {
        return {
          success: false,
          message: '检测到多个人脸，请确保画面中只有一个人',
          data: {
            ...mockDetection,
            quality: mockDetection.quality as 'excellent' | 'good' | 'fair' | 'poor'
          }
        };
      }

      if (mockDetection.confidence < this.MIN_CONFIDENCE) {
        return {
          success: false,
          message: '人脸识别置信度不足，请调整光线或角度',
          data: {
            ...mockDetection,
            quality: mockDetection.quality as 'excellent' | 'good' | 'fair' | 'poor'
          }
        };
      }

      console.log('✅ 人脸检测成功');
      return {
        success: true,
        message: '人脸检测成功',
        data: {
          ...mockDetection,
          quality: mockDetection.quality as 'excellent' | 'good' | 'fair' | 'poor'
        }
      };

    } catch (error) {
      console.error('❌ 人脸检测失败:', error);
      return {
        success: false,
        message: '人脸检测服务异常，请稍后重试'
      };
    }
  }

  /**
   * 比较两个人脸特征
   */
  async compareFaces(features1: number[], features2: number[]): Promise<FaceComparisonResult> {
    try {
      if (!features1 || !features2) {
        return {
          success: false,
          message: '人脸特征数据无效'
        };
      }

      if (features1.length !== features2.length) {
        return {
          success: false,
          message: '人脸特征向量长度不匹配'
        };
      }

      // 计算余弦相似度
      const similarity = this.calculateCosineSimilarity(features1, features2);
      const isMatch = similarity >= this.SIMILARITY_THRESHOLD;

      // 基于相似度计算置信度
      const confidence = Math.min(similarity * 1.2, 1.0);

      console.log(`🔄 人脸比对结果: 相似度=${similarity.toFixed(3)}, 匹配=${isMatch}`);

      return {
        success: true,
        message: isMatch ? '人脸匹配成功' : '人脸不匹配',
        data: {
          isMatch,
          similarity,
          confidence,
          threshold: this.SIMILARITY_THRESHOLD
        }
      };

    } catch (error) {
      console.error('❌ 人脸比对失败:', error);
      return {
        success: false,
        message: '人脸比对服务异常，请稍后重试'
      };
    }
  }

  /**
   * 生成唯一的人脸ID
   */
  generateFaceId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `face_${timestamp}_${random}`;
  }

  /**
   * 验证图片质量
   */
  validateImageQuality(imageData: Buffer): { success: boolean; message?: string } {
    try {
      if (imageData.length === 0) {
        return { success: false, message: '图片数据为空' };
      }

      if (imageData.length < 100) { // 降低到100字节
        return { success: false, message: '图片文件过小，可能损坏' };
      }

      if (imageData.length > 10 * 1024 * 1024) { // 10MB
        return { success: false, message: '图片文件过大，请压缩后上传' };
      }

      // 检查图片格式
      const header = imageData.slice(0, 4);
      if (!this.isValidImageHeader(header)) {
        console.log('⚠️ 图片格式可能不正确，但允许继续处理');
      }

      console.log(`📷 图片质量验证: 大小=${imageData.length} bytes`);
      return { success: true };
    } catch (error) {
      console.error('图片质量验证错误:', error);
      return { success: false, message: '图片质量验证失败' };
    }
  }

  /**
   * 模拟人脸检测（生产环境中应该使用真实的人脸识别库）
   */
  private simulateFaceDetection(imageData: Buffer) {
    // 基于图片数据生成模拟结果
    const hash = crypto.createHash('md5').update(imageData).digest('hex');
    const seed = parseInt(hash.substring(0, 8), 16);

    // 使用种子生成确定性的随机数
    const random = (seed % 1000) / 1000;

    // 基于图片大小调整检测成功率
    const sizeBonus = Math.min(imageData.length / (500 * 1024), 1); // 500KB为基准
    const baseSuccessRate = 0.85 + sizeBonus * 0.13; // 85%-98%的成功率

    // 模拟检测结果
    const faceDetected = random < baseSuccessRate;
    const faceCount = faceDetected ? 1 : 0;

    // 更智能的置信度计算
    let confidence = 0;
    if (faceDetected) {
      // 基于图片质量和随机因子计算置信度
      const qualityFactor = Math.min(imageData.length / (1024 * 1024), 1); // 基于文件大小的质量因子
      const randomFactor = 0.5 + random * 0.5; // 0.5-1.0的随机因子
      confidence = Math.max(0.6, 0.7 + qualityFactor * 0.2 + randomFactor * 0.1);
    } else {
      confidence = random * 0.5; // 未检测到时的低置信度
    }

    // 生成模拟的人脸特征
    const encoding = faceDetected ? this.generateMockFaceEncoding(seed) : [];
    const landmarks = faceDetected ? this.generateMockLandmarks(seed) : [];

    // 质量评估
    const quality = confidence > 0.9 ? 'excellent' :
      confidence > 0.8 ? 'good' :
        confidence > 0.7 ? 'fair' : 'poor';

    console.log(`🎭 人脸检测模拟: 检测到=${faceDetected}, 置信度=${confidence.toFixed(3)}, 质量=${quality}, 图片大小=${(imageData.length / 1024).toFixed(1)}KB`);

    return {
      faceDetected,
      faceCount,
      confidence: Math.min(confidence, 1.0), // 确保不超过1.0
      features: faceDetected ? { encoding, landmarks } : undefined,
      quality
    };
  }

  /**
   * 生成模拟的人脸编码向量
   */
  private generateMockFaceEncoding(seed: number): number[] {
    const encoding: number[] = [];
    const random = this.seededRandom(seed);

    // 生成128维特征向量
    for (let i = 0; i < 128; i++) {
      encoding.push((random() - 0.5) * 2); // -1 到 1 之间的值
    }

    return encoding;
  }

  /**
   * 生成模拟的面部关键点
   */
  private generateMockLandmarks(seed: number): number[][] {
    const landmarks: number[][] = [];
    const random = this.seededRandom(seed + 1000);

    // 生成68个关键点（标准面部关键点数量）
    for (let i = 0; i < 68; i++) {
      landmarks.push([
        random() * 640, // x坐标 (假设640px宽度)
        random() * 480  // y坐标 (假设480px高度)
      ]);
    }

    return landmarks;
  }

  /**
   * 计算余弦相似度
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * 检查图片文件头
   */
  private isValidImageHeader(header: Buffer): boolean {
    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return true;
    }

    // PNG: 89 50 4E 47
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return true;
    }

    // WebP: 52 49 46 46 (RIFF)
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      return true;
    }

    return false;
  }

  /**
   * 种子随机数生成器
   */
  private seededRandom(seed: number): () => number {
    let state = seed;
    return function () {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
} 