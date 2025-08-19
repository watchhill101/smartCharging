import crypto from 'crypto';
import { RedisService } from './RedisService';
import { ThirdPartySliderService, ThirdPartySliderServiceFactory } from './ThirdPartySliderService';

export interface SliderVerifyRequest {
  slideDistance: number;
  puzzleOffset: number;
  accuracy: number;
  duration: number;
  verifyPath: number[];
  trackData: Array<{
    startX: number;
    currentX: number;
  }>;
  sessionId?: string;
}

export interface SliderVerifyResult {
  verified: boolean;
  token?: string;
  accuracy: number;
  duration: number;
  reason?: string;
  sessionId: string;
}

export interface SliderChallenge {
  sessionId: string;
  puzzleOffset: number;
  timestamp: number;
  attempts: number;
}

export class SliderVerifyService {
  private redis: RedisService;
  private thirdPartyService?: ThirdPartySliderService;
  private readonly CHALLENGE_EXPIRE_TIME = 5 * 60; // 5分钟
  private readonly MAX_ATTEMPTS = 3;
  private readonly ACCURACY_THRESHOLD = 15; // 像素误差阈值
  private readonly MIN_DURATION = 300; // 最小拖拽时间(ms)
  private readonly MAX_DURATION = 15000; // 最大拖拽时间(ms)
  private readonly MIN_TRACK_POINTS = 5; // 最小轨迹点数
  private readonly USE_THIRD_PARTY = process.env.SLIDER_USE_THIRD_PARTY === 'true';

  constructor() {
    this.redis = new RedisService();
    this.initializeThirdPartyService();
  }

  /**
   * 初始化第三方验证服务
   */
  private initializeThirdPartyService(): void {
    if (!this.USE_THIRD_PARTY) {
      console.log('🔧 滑块验证使用内置算法');
      return;
    }

    const provider = process.env.SLIDER_THIRD_PARTY_PROVIDER || 'generic';
    const apiUrl = process.env.SLIDER_VERIFY_API_URL;
    const apiKey = process.env.SLIDER_VERIFY_API_KEY;

    if (!apiUrl || !apiKey) {
      console.warn('⚠️ 第三方滑块验证配置不完整，使用内置算法');
      return;
    }

    try {
      switch (provider) {
        case 'geetest':
          this.thirdPartyService = ThirdPartySliderServiceFactory.createGeetestService(apiKey, apiUrl);
          break;
        case 'tencent':
          this.thirdPartyService = ThirdPartySliderServiceFactory.createTencentService(apiKey, apiUrl);
          break;
        default:
          this.thirdPartyService = ThirdPartySliderServiceFactory.createCustomService({
            apiUrl,
            apiKey,
            timeout: 5000,
            retries: 2
          });
      }
      console.log(`🔗 已初始化第三方滑块验证服务: ${provider}`);
    } catch (error) {
      console.error('❌ 初始化第三方滑块验证服务失败:', error);
      this.thirdPartyService = undefined;
    }
  }

  /**
   * 生成滑块验证挑战
   */
  async generateChallenge(width: number = 248): Promise<SliderChallenge> {
    const sessionId = this.generateSessionId();
    const effectiveWidth = width - 40; // 减去滑块宽度
    const minOffset = effectiveWidth * 0.3; // 30%位置开始
    const maxOffset = effectiveWidth * 0.8; // 80%位置结束
    const puzzleOffset = Math.random() * (maxOffset - minOffset) + minOffset;

    const challenge: SliderChallenge = {
      sessionId,
      puzzleOffset: Math.round(puzzleOffset),
      timestamp: Date.now(),
      attempts: 0
    };

    // 存储挑战到Redis
    await this.redis.setex(
      `slider_challenge:${sessionId}`,
      this.CHALLENGE_EXPIRE_TIME,
      JSON.stringify(challenge)
    );

    console.log(`🎯 生成滑块验证挑战: sessionId=${sessionId}, puzzleOffset=${challenge.puzzleOffset}`);
    return challenge;
  }

  /**
   * 验证滑块操作
   */
  async verifySlider(request: SliderVerifyRequest, clientIp?: string, userAgent?: string): Promise<SliderVerifyResult> {
    const { slideDistance, puzzleOffset, accuracy, duration, verifyPath, trackData, sessionId } = request;

    console.log(`🔍 开始滑块验证: sessionId=${sessionId}, accuracy=${accuracy}, duration=${duration}`);

    // 基本参数验证
    if (typeof slideDistance !== 'number' || typeof puzzleOffset !== 'number') {
      return {
        verified: false,
        accuracy,
        duration,
        reason: '参数格式错误',
        sessionId: sessionId || 'unknown'
      };
    }

    // 如果有sessionId，验证挑战
    if (sessionId) {
      const challengeResult = await this.validateChallenge(sessionId, puzzleOffset);
      if (!challengeResult.valid) {
        return {
          verified: false,
          accuracy,
          duration,
          reason: challengeResult.reason,
          sessionId
        };
      }
    }

    // 尝试使用第三方验证服务
    if (this.thirdPartyService) {
      try {
        const thirdPartyResult = await this.verifyWithThirdParty(request, clientIp, userAgent);
        if (thirdPartyResult) {
          return thirdPartyResult;
        }
      } catch (error) {
        console.warn('⚠️ 第三方滑块验证失败，回退到内置算法:', error);
      }
    }

    // 执行内置验证逻辑
    const verificationResult = this.performVerification({
      slideDistance,
      puzzleOffset,
      accuracy,
      duration,
      verifyPath,
      trackData
    });

    if (verificationResult.verified) {
      // 生成验证令牌
      const token = this.generateVerifyToken(sessionId || 'direct');
      
      // 记录成功验证
      await this.recordVerificationSuccess(sessionId, token);

      console.log(`✅ 滑块验证成功: sessionId=${sessionId}, token=${token}`);
      return {
        ...verificationResult,
        token,
        sessionId: sessionId || 'direct'
      };
    } else {
      // 记录失败尝试
      if (sessionId) {
        await this.recordVerificationFailure(sessionId);
      }

      console.log(`❌ 滑块验证失败: sessionId=${sessionId}, reason=${verificationResult.reason}`);
      return {
        ...verificationResult,
        sessionId: sessionId || 'direct'
      };
    }
  }

  /**
   * 使用第三方服务验证
   */
  private async verifyWithThirdParty(
    request: SliderVerifyRequest, 
    clientIp?: string, 
    userAgent?: string
  ): Promise<SliderVerifyResult | null> {
    if (!this.thirdPartyService) {
      return null;
    }

    try {
      console.log('🔗 使用第三方滑块验证服务');
      
      const thirdPartyRequest = {
        slideDistance: request.slideDistance,
        puzzleOffset: request.puzzleOffset,
        duration: request.duration,
        userAgent,
        ip: clientIp,
        sessionId: request.sessionId
      };

      const provider = process.env.SLIDER_THIRD_PARTY_PROVIDER || 'generic';
      const result = await this.thirdPartyService.verifyWithRetry(thirdPartyRequest, provider as any);

      if (result.success && result.verified) {
        // 生成验证令牌
        const token = this.generateVerifyToken(request.sessionId || 'third_party');
        
        // 记录成功验证
        await this.recordVerificationSuccess(request.sessionId, token);

        console.log(`✅ 第三方滑块验证成功: confidence=${result.confidence}, riskLevel=${result.riskLevel}`);
        
        return {
          verified: true,
          token,
          accuracy: request.accuracy,
          duration: request.duration,
          sessionId: request.sessionId || 'third_party'
        };
      } else {
        console.log(`❌ 第三方滑块验证失败: ${result.reason}`);
        
        return {
          verified: false,
          accuracy: request.accuracy,
          duration: request.duration,
          reason: result.reason || '第三方验证失败',
          sessionId: request.sessionId || 'third_party'
        };
      }
    } catch (error) {
      console.error('❌ 第三方滑块验证异常:', error);
      throw error; // 重新抛出异常，让调用者决定是否回退
    }
  }

  /**
   * 验证令牌有效性
   */
  async validateToken(token: string): Promise<boolean> {
    if (!token || !token.startsWith('slider_token_')) {
      return false;
    }

    try {
      const tokenData = await this.redis.get(`verify_token:${token}`);
      return tokenData !== null;
    } catch (error) {
      console.error('验证令牌检查失败:', error);
      return false;
    }
  }

  /**
   * 执行核心验证逻辑
   */
  private performVerification(data: {
    slideDistance: number;
    puzzleOffset: number;
    accuracy: number;
    duration: number;
    verifyPath: number[];
    trackData: Array<{ startX: number; currentX: number }>;
  }): { verified: boolean; accuracy: number; duration: number; reason?: string } {
    const { slideDistance, puzzleOffset, accuracy, duration, verifyPath, trackData } = data;
    const reasons: string[] = [];

    // 1. 精度验证
    const isAccurate = accuracy <= this.ACCURACY_THRESHOLD;
    if (!isAccurate && accuracy > 25) {
      reasons.push(`精度不够(${accuracy.toFixed(1)}px > 25px)`);
    }

    // 2. 时间验证
    const isDurationValid = duration >= this.MIN_DURATION && duration <= this.MAX_DURATION;
    if (!isDurationValid) {
      reasons.push(`时间异常(${duration}ms, 期望${this.MIN_DURATION}-${this.MAX_DURATION}ms)`);
    }

    // 3. 轨迹验证
    const hasValidTrajectory = this.validateTrajectory(trackData, verifyPath);
    if (!hasValidTrajectory) {
      reasons.push('轨迹异常');
    }

    // 4. 行为模式验证
    const behaviorScore = this.calculateBehaviorScore(duration, trackData, accuracy);
    const isBehaviorValid = behaviorScore > 0.6;
    if (!isBehaviorValid) {
      reasons.push(`行为模式异常(得分: ${behaviorScore.toFixed(2)})`);
    }

    // 综合判断：满足精度要求且其他验证通过
    const verified = (isAccurate || accuracy <= 25) && isDurationValid && hasValidTrajectory && isBehaviorValid;

    return {
      verified,
      accuracy,
      duration,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined
    };
  }

  /**
   * 验证轨迹数据
   */
  private validateTrajectory(
    trackData: Array<{ startX: number; currentX: number }>,
    verifyPath: number[]
  ): boolean {
    if (!trackData || trackData.length < this.MIN_TRACK_POINTS) {
      return false;
    }

    if (!verifyPath || verifyPath.length < this.MIN_TRACK_POINTS) {
      return false;
    }

    // 检查轨迹是否连续且合理
    let validPoints = 0;
    for (let i = 1; i < trackData.length; i++) {
      const prev = trackData[i - 1];
      const curr = trackData[i];
      
      // 检查移动是否合理（不能瞬移）
      const distance = Math.abs(curr.currentX - prev.currentX);
      if (distance <= 50) { // 单次移动不超过50像素
        validPoints++;
      }
    }

    return validPoints >= this.MIN_TRACK_POINTS - 1;
  }

  /**
   * 计算行为模式得分
   */
  private calculateBehaviorScore(
    duration: number,
    trackData: Array<{ startX: number; currentX: number }>,
    accuracy: number
  ): number {
    let score = 0;

    // 时间得分 (0-0.3)
    if (duration >= 500 && duration <= 8000) {
      score += 0.3;
    } else if (duration >= 300 && duration <= 12000) {
      score += 0.2;
    } else {
      score += 0.1;
    }

    // 轨迹平滑度得分 (0-0.4)
    if (trackData && trackData.length > 0) {
      const smoothness = this.calculateSmoothness(trackData);
      score += smoothness * 0.4;
    }

    // 精度得分 (0-0.3)
    if (accuracy <= 10) {
      score += 0.3;
    } else if (accuracy <= 20) {
      score += 0.2;
    } else if (accuracy <= 30) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 计算轨迹平滑度
   */
  private calculateSmoothness(trackData: Array<{ startX: number; currentX: number }>): number {
    if (trackData.length < 3) return 0;

    let smoothnessScore = 0;
    let validTransitions = 0;

    for (let i = 2; i < trackData.length; i++) {
      const p1 = trackData[i - 2].currentX;
      const p2 = trackData[i - 1].currentX;
      const p3 = trackData[i].currentX;

      // 计算加速度变化
      const v1 = p2 - p1;
      const v2 = p3 - p2;
      const acceleration = Math.abs(v2 - v1);

      // 平滑的移动加速度变化应该较小
      if (acceleration <= 20) {
        smoothnessScore += 1;
      } else if (acceleration <= 40) {
        smoothnessScore += 0.5;
      }
      validTransitions++;
    }

    return validTransitions > 0 ? smoothnessScore / validTransitions : 0;
  }

  /**
   * 验证挑战有效性
   */
  private async validateChallenge(sessionId: string, puzzleOffset: number): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const challengeData = await this.redis.get(`slider_challenge:${sessionId}`);
      if (!challengeData) {
        return { valid: false, reason: '挑战不存在或已过期' };
      }

      const challenge: SliderChallenge = JSON.parse(challengeData);

      // 检查尝试次数
      if (challenge.attempts >= this.MAX_ATTEMPTS) {
        return { valid: false, reason: '尝试次数过多' };
      }

      // 检查拼图位置是否匹配
      if (Math.abs(challenge.puzzleOffset - puzzleOffset) > 5) {
        return { valid: false, reason: '挑战数据不匹配' };
      }

      return { valid: true };
    } catch (error) {
      console.error('验证挑战失败:', error);
      return { valid: false, reason: '挑战验证失败' };
    }
  }

  /**
   * 记录验证成功
   */
  private async recordVerificationSuccess(sessionId: string | undefined, token: string): Promise<void> {
    try {
      // 存储验证令牌（30分钟有效期）
      await this.redis.setex(`verify_token:${token}`, 30 * 60, JSON.stringify({
        sessionId,
        timestamp: Date.now(),
        type: 'slider_verify'
      }));

      // 清理挑战数据
      if (sessionId) {
        await this.redis.del(`slider_challenge:${sessionId}`);
      }
    } catch (error) {
      console.error('记录验证成功失败:', error);
    }
  }

  /**
   * 记录验证失败
   */
  private async recordVerificationFailure(sessionId: string): Promise<void> {
    try {
      const challengeData = await this.redis.get(`slider_challenge:${sessionId}`);
      if (challengeData) {
        const challenge: SliderChallenge = JSON.parse(challengeData);
        challenge.attempts++;

        if (challenge.attempts >= this.MAX_ATTEMPTS) {
          // 达到最大尝试次数，删除挑战
          await this.redis.del(`slider_challenge:${sessionId}`);
        } else {
          // 更新尝试次数
          await this.redis.setex(
            `slider_challenge:${sessionId}`,
            this.CHALLENGE_EXPIRE_TIME,
            JSON.stringify(challenge)
          );
        }
      }
    } catch (error) {
      console.error('记录验证失败失败:', error);
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `slider_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * 生成验证令牌
   */
  private generateVerifyToken(sessionId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    return `slider_token_${timestamp}_${random}`;
  }

  /**
   * 获取验证统计信息
   */
  async getVerificationStats(timeRange: number = 24 * 60 * 60 * 1000): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    successRate: number;
    averageAccuracy: number;
    averageDuration: number;
  }> {
    // 这里可以实现统计逻辑，从Redis或数据库获取数据
    // 目前返回模拟数据
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      successRate: 0,
      averageAccuracy: 0,
      averageDuration: 0
    };
  }
}

export default SliderVerifyService;