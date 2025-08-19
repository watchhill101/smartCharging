import crypto from 'crypto';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Canvas, createCanvas, loadImage } from 'canvas';
import { RedisService } from './RedisService';

export interface QRCodeGenerateRequest {
  data: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  logo?: {
    url: string;
    size: number;
  };
}

export interface QRCodeGenerateResponse {
  qrCodeId: string;
  qrCodeUrl: string; // base64 图片
  data: string;
  expireTime: number;
  createTime: number;
}

export interface QRCodeScanRequest {
  imageData: string; // base64 图片数据
  format?: 'base64' | 'buffer';
}

export interface QRCodeScanResponse {
  success: boolean;
  data?: string;
  format?: string;
  location?: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
  error?: string;
}

export interface QRCodeValidateRequest {
  qrCodeId: string;
  data: string;
  scanLocation?: {
    latitude?: number;
    longitude?: number;
  };
  deviceInfo?: {
    userAgent: string;
    platform: string;
  };
}

export interface QRCodeValidateResponse {
  valid: boolean;
  message: string;
  data?: any;
  expireTime?: number;
}

export interface ChargingPileQRData {
  pileId: string;
  stationId: string;
  pileNumber: string;
  operatorId: string;
  timestamp: number;
  signature: string;
}

export class QRCodeService {
  private redis: RedisService;
  private secretKey: string;

  constructor(redis: RedisService) {
    this.redis = redis;
    this.secretKey = process.env.QR_SECRET_KEY || 'default-qr-secret-key';
  }

  /**
   * 生成二维码
   */
  async generateQRCode(request: QRCodeGenerateRequest): Promise<QRCodeGenerateResponse> {
    try {
      const {
        data,
        size = 200,
        errorCorrectionLevel = 'M',
        margin = 4,
        color = { dark: '#000000', light: '#FFFFFF' },
        logo
      } = request;

      // 生成唯一ID
      const qrCodeId = this.generateQRCodeId();

      // 生成二维码配置
      const qrOptions = {
        width: size,
        margin,
        color,
        errorCorrectionLevel
      };

      // 生成基础二维码
      let qrCodeDataUrl = await QRCode.toDataURL(data, qrOptions);

      // 如果有logo，添加logo
      if (logo) {
        qrCodeDataUrl = await this.addLogoToQRCode(qrCodeDataUrl, logo, size);
      }

      // 存储二维码信息到Redis
      const qrCodeInfo = {
        qrCodeId,
        data,
        size,
        createTime: Date.now(),
        expireTime: Date.now() + 24 * 60 * 60 * 1000, // 24小时过期
        scanCount: 0,
        lastScanTime: null
      };

      await this.redis.setex(
        `qrcode:${qrCodeId}`,
        24 * 60 * 60, // 24小时
        JSON.stringify(qrCodeInfo)
      );

      console.log(`✅ 生成二维码成功: ${qrCodeId}`);

      return {
        qrCodeId,
        qrCodeUrl: qrCodeDataUrl,
        data,
        expireTime: qrCodeInfo.expireTime,
        createTime: qrCodeInfo.createTime
      };

    } catch (error) {
      console.error('❌ 生成二维码失败:', error);
      throw new Error('生成二维码失败');
    }
  }

  /**
   * 扫描二维码
   */
  async scanQRCode(request: QRCodeScanRequest): Promise<QRCodeScanResponse> {
    try {
      const { imageData, format = 'base64' } = request;

      // 处理图片数据
      let imageBuffer: Buffer;
      if (format === 'base64') {
        // 移除base64前缀
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        imageBuffer = Buffer.from(imageData);
      }

      // 加载图片
      const image = await loadImage(imageBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      // 获取图片数据
      const imageDataArray = ctx.getImageData(0, 0, image.width, image.height);

      // 使用jsQR解析二维码
      const qrResult = jsQR(
        imageDataArray.data,
        imageDataArray.width,
        imageDataArray.height
      );

      if (qrResult) {
        console.log(`✅ 二维码扫描成功: ${qrResult.data}`);

        return {
          success: true,
          data: qrResult.data,
          format: 'QR_CODE',
          location: qrResult.location
        };
      } else {
        console.log('❌ 未在图片中发现二维码');
        return {
          success: false,
          error: '未在图片中发现二维码'
        };
      }

    } catch (error) {
      console.error('❌ 扫描二维码失败:', error);
      return {
        success: false,
        error: '扫描二维码失败'
      };
    }
  }

  /**
   * 验证二维码
   */
  async validateQRCode(request: QRCodeValidateRequest): Promise<QRCodeValidateResponse> {
    try {
      const { qrCodeId, data, scanLocation, deviceInfo } = request;

      // 从Redis获取二维码信息
      const qrCodeInfoStr = await this.redis.get(`qrcode:${qrCodeId}`);
      if (!qrCodeInfoStr) {
        return {
          valid: false,
          message: '二维码不存在或已过期'
        };
      }

      const qrCodeInfo = JSON.parse(qrCodeInfoStr);

      // 检查过期时间
      if (Date.now() > qrCodeInfo.expireTime) {
        await this.redis.del(`qrcode:${qrCodeId}`);
        return {
          valid: false,
          message: '二维码已过期'
        };
      }

      // 验证数据
      if (qrCodeInfo.data !== data) {
        return {
          valid: false,
          message: '二维码数据不匹配'
        };
      }

      // 更新扫描统计
      qrCodeInfo.scanCount += 1;
      qrCodeInfo.lastScanTime = Date.now();
      qrCodeInfo.lastScanLocation = scanLocation;
      qrCodeInfo.lastDeviceInfo = deviceInfo;

      await this.redis.setex(
        `qrcode:${qrCodeId}`,
        Math.ceil((qrCodeInfo.expireTime - Date.now()) / 1000),
        JSON.stringify(qrCodeInfo)
      );

      console.log(`✅ 二维码验证成功: ${qrCodeId}, 扫描次数: ${qrCodeInfo.scanCount}`);

      return {
        valid: true,
        message: '验证成功',
        data: qrCodeInfo.data,
        expireTime: qrCodeInfo.expireTime
      };

    } catch (error) {
      console.error('❌ 验证二维码失败:', error);
      return {
        valid: false,
        message: '验证异常'
      };
    }
  }

  /**
   * 生成充电桩二维码
   */
  async generateChargingPileQR(
    pileId: string,
    stationId: string,
    pileNumber: string,
    operatorId: string
  ): Promise<QRCodeGenerateResponse> {
    try {
      // 创建充电桩二维码数据
      const qrData: ChargingPileQRData = {
        pileId,
        stationId,
        pileNumber,
        operatorId,
        timestamp: Date.now(),
        signature: ''
      };

      // 生成签名
      qrData.signature = this.generateSignature(qrData);

      // 将数据编码为JSON字符串
      const dataString = JSON.stringify(qrData);

      // 生成二维码
      const qrResult = await this.generateQRCode({
        data: dataString,
        size: 200,
        errorCorrectionLevel: 'H', // 高容错率
        logo: {
          url: '/assets/logo.png', // 充电桩运营商logo
          size: 40
        }
      });

      console.log(`✅ 生成充电桩二维码成功: ${pileId}`);

      return qrResult;

    } catch (error) {
      console.error('❌ 生成充电桩二维码失败:', error);
      throw new Error('生成充电桩二维码失败');
    }
  }

  /**
   * 验证充电桩二维码
   */
  async validateChargingPileQR(qrData: string): Promise<{
    valid: boolean;
    message: string;
    pileInfo?: ChargingPileQRData;
  }> {
    try {
      // 解析二维码数据
      let pileData: ChargingPileQRData;
      try {
        pileData = JSON.parse(qrData);
      } catch (error) {
        return {
          valid: false,
          message: '二维码格式错误'
        };
      }

      // 验证必要字段
      if (!pileData.pileId || !pileData.stationId || !pileData.signature) {
        return {
          valid: false,
          message: '二维码数据不完整'
        };
      }

      // 验证签名
      const expectedSignature = this.generateSignature({
        ...pileData,
        signature: ''
      });

      if (pileData.signature !== expectedSignature) {
        return {
          valid: false,
          message: '二维码签名验证失败'
        };
      }

      // 检查时间戳（防止过期的二维码）
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
      if (Date.now() - pileData.timestamp > maxAge) {
        return {
          valid: false,
          message: '二维码已过期'
        };
      }

      console.log(`✅ 充电桩二维码验证成功: ${pileData.pileId}`);

      return {
        valid: true,
        message: '验证成功',
        pileInfo: pileData
      };

    } catch (error) {
      console.error('❌ 验证充电桩二维码失败:', error);
      return {
        valid: false,
        message: '验证异常'
      };
    }
  }

  /**
   * 批量生成充电桩二维码
   */
  async batchGenerateChargingPileQR(piles: Array<{
    pileId: string;
    stationId: string;
    pileNumber: string;
    operatorId: string;
  }>): Promise<QRCodeGenerateResponse[]> {
    try {
      const results = await Promise.all(
        piles.map(pile => 
          this.generateChargingPileQR(
            pile.pileId,
            pile.stationId,
            pile.pileNumber,
            pile.operatorId
          )
        )
      );

      console.log(`✅ 批量生成充电桩二维码成功: ${piles.length}个`);

      return results;

    } catch (error) {
      console.error('❌ 批量生成充电桩二维码失败:', error);
      throw new Error('批量生成充电桩二维码失败');
    }
  }

  /**
   * 获取二维码统计信息
   */
  async getQRCodeStats(qrCodeId: string): Promise<{
    qrCodeId: string;
    scanCount: number;
    createTime: number;
    lastScanTime: number | null;
    expireTime: number;
    isExpired: boolean;
  } | null> {
    try {
      const qrCodeInfoStr = await this.redis.get(`qrcode:${qrCodeId}`);
      if (!qrCodeInfoStr) {
        return null;
      }

      const qrCodeInfo = JSON.parse(qrCodeInfoStr);
      const isExpired = Date.now() > qrCodeInfo.expireTime;

      return {
        qrCodeId,
        scanCount: qrCodeInfo.scanCount || 0,
        createTime: qrCodeInfo.createTime,
        lastScanTime: qrCodeInfo.lastScanTime || null,
        expireTime: qrCodeInfo.expireTime,
        isExpired
      };

    } catch (error) {
      console.error('❌ 获取二维码统计失败:', error);
      return null;
    }
  }

  /**
   * 生成二维码ID
   */
  private generateQRCodeId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `qr_${timestamp}_${random}`;
  }

  /**
   * 为二维码添加logo
   */
  private async addLogoToQRCode(
    qrCodeDataUrl: string,
    logo: { url: string; size: number },
    qrSize: number
  ): Promise<string> {
    try {
      // 创建画布
      const canvas = createCanvas(qrSize, qrSize);
      const ctx = canvas.getContext('2d');

      // 加载二维码图片
      const qrImage = await loadImage(qrCodeDataUrl);
      ctx.drawImage(qrImage, 0, 0, qrSize, qrSize);

      // 加载logo图片
      const logoImage = await loadImage(logo.url);
      
      // 计算logo位置（居中）
      const logoX = (qrSize - logo.size) / 2;
      const logoY = (qrSize - logo.size) / 2;

      // 绘制白色背景（确保logo清晰可见）
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(logoX - 5, logoY - 5, logo.size + 10, logo.size + 10);

      // 绘制logo
      ctx.drawImage(logoImage, logoX, logoY, logo.size, logo.size);

      return canvas.toDataURL('image/png');

    } catch (error) {
      console.warn('⚠️ 添加logo失败，返回原始二维码:', error);
      return qrCodeDataUrl;
    }
  }

  /**
   * 生成签名
   */
  private generateSignature(data: Omit<ChargingPileQRData, 'signature'>): string {
    const signString = `${data.pileId}${data.stationId}${data.pileNumber}${data.operatorId}${data.timestamp}${this.secretKey}`;
    return crypto.createHash('sha256').update(signString).digest('hex');
  }

  /**
   * 清理过期的二维码
   */
  async cleanupExpiredQRCodes(): Promise<number> {
    try {
      // 这里可以实现定期清理逻辑
      // 由于Redis会自动过期，这里主要用于统计和日志
      console.log('🧹 开始清理过期二维码...');
      
      // 实际实现中可以扫描所有qrcode:*键并检查过期时间
      // 这里返回模拟的清理数量
      return 0;

    } catch (error) {
      console.error('❌ 清理过期二维码失败:', error);
      return 0;
    }
  }
}