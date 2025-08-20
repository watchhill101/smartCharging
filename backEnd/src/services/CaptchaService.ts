import crypto from 'crypto';
import { createCanvas, loadImage } from 'canvas';
import { RedisService } from './RedisService';

export interface CaptchaConfig {
  width: number;
  height: number;
  puzzleSize: number;
  tolerance: number;
  expireTime: number; // 验证码过期时间（秒）
}

export interface GenerateCaptchaRequest {
  width?: number;
  height?: number;
  puzzleX?: number;
  puzzleY?: number;
}

export interface GenerateCaptchaResponse {
  token: string;
  backgroundImage: string; // base64 图片
  puzzleImage: string; // base64 拼图块
  puzzleX: number;
  puzzleY: number;
  expireTime: number;
}

export interface VerifyCaptchaRequest {
  token: string;
  x: number;
  trail: Array<{ x: number; y: number; t: number }>;
}

export interface VerifyCaptchaResponse {
  success: boolean;
  message: string;
  score?: number;
}

export interface CaptchaData {
  puzzleX: number;
  puzzleY: number;
  tolerance: number;
  createTime: number;
  attempts: number;
}

export class CaptchaService {
  private redis: RedisService;
  private config: CaptchaConfig;
  private backgroundImages: string[];

  constructor(redis: RedisService) {
    this.redis = redis;
    this.config = {
      width: 300,
      height: 150,
      puzzleSize: 42,
      tolerance: 5,
      expireTime: 300 // 5分钟
    };
    
    // 预设背景图片列表
    this.backgroundImages = [
      'https://picsum.photos/300/150?random=1',
      'https://picsum.photos/300/150?random=2',
      'https://picsum.photos/300/150?random=3',
      'https://picsum.photos/300/150?random=4',
      'https://picsum.photos/300/150?random=5'
    ];
  }

  /**
   * 生成验证码
   */
  async generateCaptcha(request: GenerateCaptchaRequest): Promise<GenerateCaptchaResponse> {
    try {
      const width = request.width || this.config.width;
      const height = request.height || this.config.height;
      const puzzleSize = this.config.puzzleSize;

      // 生成拼图位置
      const puzzleX = request.puzzleX || this.generateRandomPosition(puzzleSize, width - puzzleSize);
      const puzzleY = request.puzzleY || this.generateRandomPosition(puzzleSize, height - puzzleSize);

      // 生成唯一token
      const token = this.generateToken();

      // 获取随机背景图片
      const backgroundImageUrl = this.getRandomBackgroundImage();

      // 生成验证码图片
      const { backgroundImage, puzzleImage } = await this.createCaptchaImages(
        backgroundImageUrl,
        width,
        height,
        puzzleX,
        puzzleY,
        puzzleSize
      );

      // 存储验证码数据到Redis
      const captchaData: CaptchaData = {
        puzzleX,
        puzzleY,
        tolerance: this.config.tolerance,
        createTime: Date.now(),
        attempts: 0
      };

      await this.redis.setex(
        `captcha:${token}`,
        this.config.expireTime,
        JSON.stringify(captchaData)
      );

      console.log(`✅ 生成验证码成功: ${token}, 位置: (${puzzleX}, ${puzzleY})`);

      return {
        token,
        backgroundImage,
        puzzleImage,
        puzzleX,
        puzzleY,
        expireTime: this.config.expireTime
      };

    } catch (error) {
      console.error('❌ 生成验证码失败:', error);
      throw new Error('生成验证码失败');
    }
  }

  /**
   * 验证滑块位置
   */
  async verifyCaptcha(request: VerifyCaptchaRequest): Promise<VerifyCaptchaResponse> {
    try {
      const { token, x, trail } = request;

      // 从Redis获取验证码数据
      const captchaDataStr = await this.redis.get(`captcha:${token}`);
      if (!captchaDataStr) {
        return {
          success: false,
          message: '验证码已过期或不存在'
        };
      }

      const captchaData: CaptchaData = JSON.parse(captchaDataStr);

      // 检查尝试次数
      if (captchaData.attempts >= 3) {
        await this.redis.del(`captcha:${token}`);
        return {
          success: false,
          message: '尝试次数过多，请重新获取验证码'
        };
      }

      // 更新尝试次数
      captchaData.attempts += 1;
      await this.redis.setex(
        `captcha:${token}`,
        this.config.expireTime,
        JSON.stringify(captchaData)
      );

      // 验证位置
      const expectedX = captchaData.puzzleX;
      const deltaX = Math.abs(x - expectedX);
      const isPositionValid = deltaX <= captchaData.tolerance;

      // 验证轨迹（防机器人）
      const isTrailValid = this.validateTrail(trail);

      // 计算验证分数
      const score = this.calculateScore(deltaX, trail, captchaData.tolerance);

      if (isPositionValid && isTrailValid && score >= 60) {
        // 验证成功，删除验证码数据
        await this.redis.del(`captcha:${token}`);
        
        console.log(`✅ 验证码验证成功: ${token}, 误差: ${deltaX}px, 分数: ${score}`);
        
        return {
          success: true,
          message: '验证成功',
          score
        };
      } else {
        console.log(`❌ 验证码验证失败: ${token}, 误差: ${deltaX}px, 分数: ${score}, 位置有效: ${isPositionValid}, 轨迹有效: ${isTrailValid}`);
        
        return {
          success: false,
          message: '验证失败，请重试',
          score
        };
      }

    } catch (error) {
      console.error('❌ 验证滑块失败:', error);
      return {
        success: false,
        message: '验证异常，请重试'
      };
    }
  }

  /**
   * 刷新验证码
   */
  async refreshCaptcha(token: string): Promise<void> {
    try {
      await this.redis.del(`captcha:${token}`);
      console.log(`🔄 刷新验证码: ${token}`);
    } catch (error) {
      console.error('❌ 刷新验证码失败:', error);
    }
  }

  /**
   * 生成随机位置
   */
  private generateRandomPosition(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 生成唯一token
   */
  private generateToken(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}_${random}`;
  }

  /**
   * 获取随机背景图片
   */
  private getRandomBackgroundImage(): string {
    const index = Math.floor(Math.random() * this.backgroundImages.length);
    return this.backgroundImages[index];
  }

  /**
   * 创建验证码图片
   */
  private async createCaptchaImages(
    backgroundImageUrl: string,
    width: number,
    height: number,
    puzzleX: number,
    puzzleY: number,
    puzzleSize: number
  ): Promise<{ backgroundImage: string; puzzleImage: string }> {
    try {
      // 创建画布
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // 加载背景图片
      const backgroundImg = await loadImage(backgroundImageUrl);
      ctx.drawImage(backgroundImg, 0, 0, width, height);

      // 创建拼图路径
      

      // 保存原始图片数据
      

      // 创建拼图块画布
      const puzzleCanvas = createCanvas(puzzleSize, puzzleSize);
      const puzzleCtx = puzzleCanvas.getContext('2d');

      // 绘制拼图块
      puzzleCtx.save();
      puzzleCtx.beginPath();
      puzzleCtx.rect(0, 0, puzzleSize, puzzleSize);
      puzzleCtx.clip();
      puzzleCtx.drawImage(
        backgroundImg,
        puzzleX, puzzleY, puzzleSize, puzzleSize,
        0, 0, puzzleSize, puzzleSize
      );
      puzzleCtx.restore();

      // 在背景图上创建拼图缺口
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.rect(puzzleX, puzzleY, puzzleSize, puzzleSize);
      ctx.fill();
      ctx.restore();

      // 添加缺口边框
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(puzzleX, puzzleY, puzzleSize, puzzleSize);

      // 转换为base64
      const backgroundImage = canvas.toDataURL('image/png');
      const puzzleImage = puzzleCanvas.toDataURL('image/png');

      return { backgroundImage, puzzleImage };

    } catch (error) {
      console.error('❌ 创建验证码图片失败:', error);
      throw new Error('创建验证码图片失败');
    }
  }

  /**
   * 创建拼图路径
   */
  private createPuzzlePath(x: number, y: number, size: number): Path2D {
    const path = new Path2D();
    
    // 简单的矩形拼图块
    path.rect(x, y, size, size);
    
    // 可以扩展为更复杂的拼图形状
    // 例如：带有凸起和凹陷的拼图块
    
    return path;
  }

  /**
   * 验证拖拽轨迹（防机器人）
   */
  private validateTrail(trail: Array<{ x: number; y: number; t: number }>): boolean {
    if (!trail || trail.length < 3) {
      return false;
    }

    // 检查轨迹时间间隔
    const timeIntervals = [];
    for (let i = 1; i < trail.length; i++) {
      const interval = trail[i].t - trail[i - 1].t;
      timeIntervals.push(interval);
    }

    // 检查是否有合理的时间间隔变化（人类行为特征）
    const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
    const hasVariation = timeIntervals.some(interval => 
      Math.abs(interval - avgInterval) > avgInterval * 0.3
    );

    // 检查轨迹长度
    const totalDistance = this.calculateTrailDistance(trail);
    const isReasonableDistance = totalDistance > 50; // 最小拖拽距离

    // 检查是否有回退行为（人类特征）
    const hasBacktrack = this.hasBacktrackBehavior(trail);

    return hasVariation && isReasonableDistance && hasBacktrack;
  }

  /**
   * 计算轨迹总距离
   */
  private calculateTrailDistance(trail: Array<{ x: number; y: number; t: number }>): number {
    let totalDistance = 0;
    for (let i = 1; i < trail.length; i++) {
      const dx = trail[i].x - trail[i - 1].x;
      const dy = trail[i].y - trail[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);
    }
    return totalDistance;
  }

  /**
   * 检查是否有回退行为
   */
  private hasBacktrackBehavior(trail: Array<{ x: number; y: number; t: number }>): boolean {
    let backtrackCount = 0;
    for (let i = 2; i < trail.length; i++) {
      const prev = trail[i - 1].x - trail[i - 2].x;
      const curr = trail[i].x - trail[i - 1].x;
      
      // 检查方向是否改变
      if (prev > 0 && curr < 0) {
        backtrackCount++;
      }
    }
    
    // 允许少量回退行为
    return backtrackCount > 0 && backtrackCount < 3;
  }

  /**
   * 计算验证分数
   */
  private calculateScore(
    deltaX: number,
    trail: Array<{ x: number; y: number; t: number }>,
    tolerance: number
  ): number {
    // 位置准确度分数 (0-40分)
    const positionScore = Math.max(0, 40 - (deltaX / tolerance) * 40);

    // 轨迹自然度分数 (0-30分)
    const trailScore = this.calculateTrailScore(trail);

    // 时间合理性分数 (0-30分)
    const timeScore = this.calculateTimeScore(trail);

    const totalScore = positionScore + trailScore + timeScore;
    
    return Math.min(100, Math.max(0, totalScore));
  }

  /**
   * 计算轨迹分数
   */
  private calculateTrailScore(trail: Array<{ x: number; y: number; t: number }>): number {
    if (!trail || trail.length < 3) return 0;

    let score = 30;

    // 检查轨迹平滑度
    const smoothness = this.calculateSmoothness(trail);
    if (smoothness < 0.5) score -= 10;

    // 检查速度变化
    const speedVariation = this.calculateSpeedVariation(trail);
    if (speedVariation < 0.3) score -= 10;

    // 检查轨迹长度合理性
    const distance = this.calculateTrailDistance(trail);
    if (distance < 50) score -= 10;

    return Math.max(0, score);
  }

  /**
   * 计算时间分数
   */
  private calculateTimeScore(trail: Array<{ x: number; y: number; t: number }>): number {
    if (!trail || trail.length < 2) return 0;

    const totalTime = trail[trail.length - 1].t - trail[0].t;
    
    // 合理的完成时间：500ms - 5000ms
    if (totalTime < 500) return 0; // 太快，可能是机器人
    if (totalTime > 5000) return 15; // 太慢，但可能是正常用户
    
    // 最佳时间范围：1000ms - 3000ms
    if (totalTime >= 1000 && totalTime <= 3000) return 30;
    
    return 20;
  }

  /**
   * 计算轨迹平滑度
   */
  private calculateSmoothness(trail: Array<{ x: number; y: number; t: number }>): number {
    if (trail.length < 3) return 0;

    let totalAngleChange = 0;
    let angleCount = 0;

    for (let i = 2; i < trail.length; i++) {
      const v1 = {
        x: trail[i - 1].x - trail[i - 2].x,
        y: trail[i - 1].y - trail[i - 2].y
      };
      const v2 = {
        x: trail[i].x - trail[i - 1].x,
        y: trail[i].y - trail[i - 1].y
      };

      const angle = this.calculateAngle(v1, v2);
      totalAngleChange += Math.abs(angle);
      angleCount++;
    }

    const avgAngleChange = totalAngleChange / angleCount;
    return Math.max(0, 1 - avgAngleChange / Math.PI);
  }

  /**
   * 计算速度变化
   */
  private calculateSpeedVariation(trail: Array<{ x: number; y: number; t: number }>): number {
    if (trail.length < 3) return 0;

    const speeds = [];
    for (let i = 1; i < trail.length; i++) {
      const dx = trail[i].x - trail[i - 1].x;
      const dy = trail[i].y - trail[i - 1].y;
      const dt = trail[i].t - trail[i - 1].t;
      
      if (dt > 0) {
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        speeds.push(speed);
      }
    }

    if (speeds.length < 2) return 0;

    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length;
    const stdDev = Math.sqrt(variance);

    return Math.min(1, stdDev / avgSpeed);
  }

  /**
   * 计算两个向量的夹角
   */
  private calculateAngle(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const cosAngle = dot / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  }

  /**
   * 获取验证码统计信息
   */
  async getCaptchaStats(): Promise<{
    totalGenerated: number;
    totalVerified: number;
    successRate: number;
    avgScore: number;
  }> {
    try {
      // 这里可以从Redis或数据库获取统计信息
      // 暂时返回模拟数据
      return {
        totalGenerated: 1000,
        totalVerified: 850,
        successRate: 0.85,
        avgScore: 78.5
      };
    } catch (error) {
      console.error('❌ 获取验证码统计失败:', error);
      throw new Error('获取统计信息失败');
    }
  }
}