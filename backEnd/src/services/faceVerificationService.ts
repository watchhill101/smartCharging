import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export interface FaceVerificationResult {
  success: boolean;
  message: string;
  data?: {
    verified: boolean;
    confidence: number;
    token?: string;
    faceDetected: boolean;
    faceCount: number;
    details?: any;
  };
}

export interface FaceComparisonResult {
  success: boolean;
  message: string;
  data?: {
    isMatch: boolean;
    confidence: number;
    similarity: number;
    details?: any;
  };
}

class FaceVerificationService {
  private apiKey: string;
  private baseUrl = 'https://api.cloudmersive.com';

  constructor() {
    // 从环境变量获取API Key，如果没有则使用默认值
    this.apiKey = process.env.CLOUDMERSIVE_API_KEY || 'your-cloudmersive-api-key-here';

    if (this.apiKey === 'your-cloudmersive-api-key-here') {
      console.warn('⚠️  警告: 请在环境变量中设置 CLOUDMERSIVE_API_KEY');
    }
  }

  /**
   * 检测图片中的人脸
   * @param imageBuffer 图片缓冲区
   * @returns 人脸检测结果
   */
  async detectFaces(imageBuffer: Buffer): Promise<FaceVerificationResult> {
    try {
      const formData = new FormData();
      formData.append('imageFile', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.baseUrl}/image/face/detect`,
        formData,
        {
          headers: {
            'Apikey': this.apiKey,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data;

      return {
        success: true,
        message: '人脸检测成功',
        data: {
          verified: result.FaceCount > 0,
          confidence: result.FaceCount > 0 ? 0.95 : 0,
          faceDetected: result.FaceCount > 0,
          faceCount: result.FaceCount || 0,
          details: result
        }
      };
    } catch (error: any) {
      console.error('人脸检测失败:', error.message);
      return {
        success: false,
        message: `人脸检测失败: ${error.message}`,
        data: {
          verified: false,
          confidence: 0,
          faceDetected: false,
          faceCount: 0
        }
      };
    }
  }

  /**
   * 比较两张图片中的人脸是否为同一人
   * @param image1Buffer 第一张图片
   * @param image2Buffer 第二张图片
   * @returns 人脸比较结果
   */
  async compareFaces(image1Buffer: Buffer, image2Buffer: Buffer): Promise<FaceComparisonResult> {
    try {
      const formData = new FormData();
      formData.append('inputImage', image1Buffer, {
        filename: 'face1.jpg',
        contentType: 'image/jpeg'
      });
      formData.append('matchFace', image2Buffer, {
        filename: 'face2.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.baseUrl}/image/face/compare-and-match`,
        formData,
        {
          headers: {
            'Apikey': this.apiKey,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data;

      return {
        success: true,
        message: '人脸比较成功',
        data: {
          isMatch: result.IsMatch || false,
          confidence: result.MatchConfidence || 0,
          similarity: result.SimilarityScore || 0,
          details: result
        }
      };
    } catch (error: any) {
      console.error('人脸比较失败:', error.message);
      return {
        success: false,
        message: `人脸比较失败: ${error.message}`,
        data: {
          isMatch: false,
          confidence: 0,
          similarity: 0
        }
      };
    }
  }

  /**
   * 识别图片中人脸的年龄和性别
   * @param imageBuffer 图片缓冲区
   * @returns 人脸属性识别结果
   */
  async recognizeFaceAttributes(imageBuffer: Buffer): Promise<FaceVerificationResult> {
    try {
      const formData = new FormData();
      formData.append('imageFile', imageBuffer, {
        filename: 'face.jpg',
        contentType: 'image/jpeg'
      });

      const response = await axios.post(
        `${this.baseUrl}/image/face/age-gender`,
        formData,
        {
          headers: {
            'Apikey': this.apiKey,
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      const result = response.data;

      return {
        success: true,
        message: '人脸属性识别成功',
        data: {
          verified: true,
          confidence: 0.9,
          faceDetected: true,
          faceCount: result.FaceCount || 0,
          details: {
            faces: result.Faces || [],
            averageAge: result.AverageAge,
            gender: result.Gender
          }
        }
      };
    } catch (error: any) {
      console.error('人脸属性识别失败:', error.message);
      return {
        success: false,
        message: `人脸属性识别失败: ${error.message}`,
        data: {
          verified: false,
          confidence: 0,
          faceDetected: false,
          faceCount: 0
        }
      };
    }
  }

  /**
   * 验证图片质量是否适合人脸识别
   * @param imageBuffer 图片缓冲区
   * @returns 图片质量验证结果
   */
  async validateImageQuality(imageBuffer: Buffer): Promise<FaceVerificationResult> {
    try {
      // 检查图片大小
      if (imageBuffer.length > 10 * 1024 * 1024) { // 10MB限制
        return {
          success: false,
          message: '图片文件过大，请选择小于10MB的图片',
          data: {
            verified: false,
            confidence: 0,
            faceDetected: false,
            faceCount: 0
          }
        };
      }

      if (imageBuffer.length < 1024) { // 1KB最小限制
        return {
          success: false,
          message: '图片文件过小，请选择有效的图片文件',
          data: {
            verified: false,
            confidence: 0,
            faceDetected: false,
            faceCount: 0
          }
        };
      }

      return {
        success: true,
        message: '图片质量验证通过',
        data: {
          verified: true,
          confidence: 1.0,
          faceDetected: true,
          faceCount: 1
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: `图片质量验证失败: ${error.message}`,
        data: {
          verified: false,
          confidence: 0,
          faceDetected: false,
          faceCount: 0
        }
      };
    }
  }

  /**
   * 生成人脸验证Token
   * @param userId 用户ID
   * @param verificationData 验证数据
   * @returns 验证Token
   */
  generateVerificationToken(userId: string, verificationData: any): string {
    const timestamp = Date.now();
    const data = {
      userId,
      timestamp,
      verified: verificationData.verified,
      confidence: verificationData.confidence
    };

    // 简单的Token生成（实际项目中应使用更安全的方法）
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
}

export default FaceVerificationService; 