import axios, { AxiosInstance } from 'axios';

export interface ThirdPartySliderConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface ThirdPartyVerifyRequest {
  slideDistance: number;
  puzzleOffset: number;
  duration: number;
  userAgent?: string;
  ip?: string;
  sessionId?: string;
}

export interface ThirdPartyVerifyResponse {
  success: boolean;
  verified: boolean;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  reason?: string;
  requestId: string;
}

/**
 * 第三方滑块验证服务适配器
 * 支持集成多种第三方验证服务，如极验、腾讯云验证码等
 */
export class ThirdPartySliderService {
  private client: AxiosInstance;
  private config: ThirdPartySliderConfig;

  constructor(config: ThirdPartySliderConfig) {
    this.config = {
      timeout: 5000,
      retries: 3,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SmartCharging-SliderVerify/1.0'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🔗 发送第三方滑块验证请求: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ 第三方滑块验证请求拦截器错误:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ 第三方滑块验证响应成功: ${response.status}`);
        return response;
      },
      (error) => {
        console.error('❌ 第三方滑块验证响应错误:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 验证滑块操作（极验风格API）
   */
  async verifyGeetest(request: ThirdPartyVerifyRequest): Promise<ThirdPartyVerifyResponse> {
    try {
      const response = await this.client.post('/geetest/verify', {
        slide_distance: request.slideDistance,
        puzzle_offset: request.puzzleOffset,
        duration: request.duration,
        user_agent: request.userAgent,
        client_ip: request.ip,
        session_id: request.sessionId,
        timestamp: Date.now()
      });

      return this.parseGeetestResponse(response.data);
    } catch (error) {
      console.error('极验滑块验证失败:', error);
      throw new Error('第三方验证服务不可用');
    }
  }

  /**
   * 验证滑块操作（腾讯云验证码风格API）
   */
  async verifyTencent(request: ThirdPartyVerifyRequest): Promise<ThirdPartyVerifyResponse> {
    try {
      const response = await this.client.post('/tencent/captcha/verify', {
        SlideDistance: request.slideDistance,
        PuzzleOffset: request.puzzleOffset,
        Duration: request.duration,
        UserIP: request.ip,
        SessionId: request.sessionId,
        Timestamp: Math.floor(Date.now() / 1000)
      });

      return this.parseTencentResponse(response.data);
    } catch (error) {
      console.error('腾讯云滑块验证失败:', error);
      throw new Error('第三方验证服务不可用');
    }
  }

  /**
   * 验证滑块操作（通用API）
   */
  async verifyGeneric(request: ThirdPartyVerifyRequest): Promise<ThirdPartyVerifyResponse> {
    try {
      const response = await this.client.post('/verify', {
        slideDistance: request.slideDistance,
        puzzleOffset: request.puzzleOffset,
        duration: request.duration,
        userAgent: request.userAgent,
        clientIp: request.ip,
        sessionId: request.sessionId,
        timestamp: Date.now()
      });

      return this.parseGenericResponse(response.data);
    } catch (error) {
      console.error('通用滑块验证失败:', error);
      throw new Error('第三方验证服务不可用');
    }
  }

  /**
   * 带重试的验证方法
   */
  async verifyWithRetry(
    request: ThirdPartyVerifyRequest,
    provider: 'geetest' | 'tencent' | 'generic' = 'generic'
  ): Promise<ThirdPartyVerifyResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (this.config.retries || 3); attempt++) {
      try {
        console.log(`🔄 第三方滑块验证尝试 ${attempt}/${this.config.retries}`);
        
        let result: ThirdPartyVerifyResponse;
        switch (provider) {
          case 'geetest':
            result = await this.verifyGeetest(request);
            break;
          case 'tencent':
            result = await this.verifyTencent(request);
            break;
          default:
            result = await this.verifyGeneric(request);
        }

        console.log(`✅ 第三方滑块验证成功 (尝试 ${attempt}):`, result);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ 第三方滑块验证尝试 ${attempt} 失败:`, error);
        
        if (attempt < (this.config.retries || 3)) {
          // 指数退避延迟
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ 第三方滑块验证最终失败，已尝试 ${this.config.retries} 次`);
    throw lastError || new Error('第三方验证服务不可用');
  }

  /**
   * 解析极验响应
   */
  private parseGeetestResponse(data: any): ThirdPartyVerifyResponse {
    return {
      success: data.status === 'success',
      verified: data.result === 1,
      confidence: data.score || 0,
      riskLevel: this.mapRiskLevel(data.risk_level),
      reason: data.reason,
      requestId: data.request_id || 'unknown'
    };
  }

  /**
   * 解析腾讯云响应
   */
  private parseTencentResponse(data: any): ThirdPartyVerifyResponse {
    return {
      success: data.Response?.Error === undefined,
      verified: data.Response?.CaptchaCode === 1,
      confidence: data.Response?.CaptchaMsg?.includes('success') ? 0.9 : 0.1,
      riskLevel: data.Response?.EvilLevel || 'low',
      reason: data.Response?.CaptchaMsg,
      requestId: data.Response?.RequestId || 'unknown'
    };
  }

  /**
   * 解析通用响应
   */
  private parseGenericResponse(data: any): ThirdPartyVerifyResponse {
    return {
      success: data.success === true,
      verified: data.verified === true,
      confidence: data.confidence || 0,
      riskLevel: data.riskLevel || 'low',
      reason: data.reason,
      requestId: data.requestId || 'unknown'
    };
  }

  /**
   * 映射风险等级
   */
  private mapRiskLevel(level: any): 'low' | 'medium' | 'high' {
    if (typeof level === 'string') {
      const lowerLevel = level.toLowerCase();
      if (lowerLevel.includes('high') || lowerLevel.includes('危险')) return 'high';
      if (lowerLevel.includes('medium') || lowerLevel.includes('中等')) return 'medium';
    }
    if (typeof level === 'number') {
      if (level >= 0.7) return 'high';
      if (level >= 0.4) return 'medium';
    }
    return 'low';
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      console.error('第三方滑块验证服务健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取服务统计信息
   */
  async getStats(): Promise<{
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    lastUpdateTime: string;
  }> {
    try {
      const response = await this.client.get('/stats');
      return {
        totalRequests: response.data.total_requests || 0,
        successRate: response.data.success_rate || 0,
        averageResponseTime: response.data.avg_response_time || 0,
        lastUpdateTime: response.data.last_update || new Date().toISOString()
      };
    } catch (error) {
      console.error('获取第三方滑块验证服务统计失败:', error);
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        lastUpdateTime: new Date().toISOString()
      };
    }
  }
}

/**
 * 第三方滑块验证服务工厂
 */
export class ThirdPartySliderServiceFactory {
  private static instances: Map<string, ThirdPartySliderService> = new Map();

  /**
   * 创建或获取服务实例
   */
  static getInstance(provider: string, config: ThirdPartySliderConfig): ThirdPartySliderService {
    const key = `${provider}_${config.apiUrl}`;
    
    if (!this.instances.has(key)) {
      this.instances.set(key, new ThirdPartySliderService(config));
    }
    
    return this.instances.get(key)!;
  }

  /**
   * 创建极验服务实例
   */
  static createGeetestService(apiKey: string, apiUrl?: string): ThirdPartySliderService {
    return this.getInstance('geetest', {
      apiUrl: apiUrl || process.env.GEETEST_API_URL || 'https://api.geetest.com',
      apiKey,
      timeout: parseInt(process.env.GEETEST_TIMEOUT || '5000'),
      retries: parseInt(process.env.GEETEST_RETRIES || '3')
    });
  }

  /**
   * 创建腾讯云服务实例
   */
  static createTencentService(apiKey: string, apiUrl?: string): ThirdPartySliderService {
    return this.getInstance('tencent', {
      apiUrl: apiUrl || process.env.TENCENT_CAPTCHA_API_URL || 'https://captcha.tencentcloudapi.com',
      apiKey,
      timeout: parseInt(process.env.TENCENT_CAPTCHA_TIMEOUT || '8000'),
      retries: parseInt(process.env.TENCENT_CAPTCHA_RETRIES || '2')
    });
  }

  /**
   * 创建自定义服务实例
   */
  static createCustomService(config: ThirdPartySliderConfig): ThirdPartySliderService {
    return this.getInstance('custom', config);
  }
}

export default ThirdPartySliderService;