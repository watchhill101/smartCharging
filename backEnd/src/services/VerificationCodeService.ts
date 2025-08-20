import { RedisService } from './RedisService';
import { logger } from '../utils/logger';

export interface SendCodeResult {
  success: boolean;
  message: string;
  remaining?: number; // 剩余可发送次数
}

export interface VerifyCodeResult {
  success: boolean;
  message: string;
  remaining?: number; // 剩余验证次数
}

export class VerificationCodeService {
  private redis: RedisService;
  private readonly CODE_EXPIRE_TIME = 5 * 60; // 5分钟
  private readonly MAX_SEND_COUNT = 5; // 每小时最多发送5次
  private readonly MAX_VERIFY_ATTEMPTS = 3; // 最多验证3次
  private readonly SEND_INTERVAL = 60; // 发送间隔60秒

  constructor() {
    this.redis = new RedisService();
  }

  /**
   * 发送验证码
   */
  async sendVerificationCode(phone: string): Promise<SendCodeResult> {
    try {
      // 检查发送频率限制
      const sendKey = `verify_send:${phone}`;
      const sendCount = await this.redis.get(sendKey);
      
      if (sendCount && parseInt(sendCount) >= this.MAX_SEND_COUNT) {
        return {
          success: false,
          message: '今日发送次数已达上限，请明天再试'
        };
      }

      // 检查发送间隔
      const lastSendKey = `verify_last_send:${phone}`;
      const lastSendTime = await this.redis.get(lastSendKey);
      
      if (lastSendTime) {
        const timeSinceLastSend = Date.now() - parseInt(lastSendTime);
        if (timeSinceLastSend < this.SEND_INTERVAL * 1000) {
          const remaining = Math.ceil((this.SEND_INTERVAL * 1000 - timeSinceLastSend) / 1000);
          return {
            success: false,
            message: `请等待 ${remaining} 秒后再试`
          };
        }
      }

      // 生成6位数字验证码
      const code = this.generateCode();
      
      // 存储验证码和相关信息
      const codeKey = `verify_code:${phone}`;
      const codeData = JSON.stringify({
        code,
        attempts: 0,
        createdAt: Date.now()
      });
      
      await this.redis.setex(codeKey, this.CODE_EXPIRE_TIME, codeData);

      // 更新发送计数
      const currentSendCount = sendCount ? parseInt(sendCount) + 1 : 1;
      await this.redis.setex(sendKey, 24 * 60 * 60, currentSendCount.toString()); // 24小时过期

      // 记录最后发送时间
      await this.redis.setex(lastSendKey, this.SEND_INTERVAL, Date.now().toString());

      // 这里应该调用短信服务发送验证码
      await this.sendSMS(phone, code);

      logger.info(`验证码发送成功`, { phone, remaining: this.MAX_SEND_COUNT - currentSendCount });

      return {
        success: true,
        message: '验证码发送成功',
        remaining: this.MAX_SEND_COUNT - currentSendCount,
        // 开发环境返回验证码供前端显示
        ...(process.env.NODE_ENV === 'development' && { 
          code: code,
          hint: `开发环境提示：验证码 ${code}`,
          debug: true
        })
      };

    } catch (error) {
      logger.error('发送验证码失败', { phone, error: error.message }, error.stack);
      return {
        success: false,
        message: '发送失败，请稍后重试'
      };
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone: string, inputCode: string): Promise<VerifyCodeResult> {
    try {
      const codeKey = `verify_code:${phone}`;
      const codeDataStr = await this.redis.get(codeKey);

      if (!codeDataStr) {
        return {
          success: false,
          message: '验证码不存在或已过期'
        };
      }

      const codeData = JSON.parse(codeDataStr);
      
      // 检查验证次数
      if (codeData.attempts >= this.MAX_VERIFY_ATTEMPTS) {
        await this.redis.del(codeKey);
        return {
          success: false,
          message: '验证次数过多，请重新获取验证码'
        };
      }

      // 验证码比较
      if (codeData.code !== inputCode) {
        codeData.attempts++;
        await this.redis.setex(codeKey, this.CODE_EXPIRE_TIME, JSON.stringify(codeData));
        
        const remaining = this.MAX_VERIFY_ATTEMPTS - codeData.attempts;
        return {
          success: false,
          message: `验证码错误，还可以尝试 ${remaining} 次`,
          remaining
        };
      }

      // 验证成功，删除验证码
      await this.redis.del(codeKey);
      
      logger.info(`验证码验证成功`, { phone });

      return {
        success: true,
        message: '验证码验证成功'
      };

    } catch (error) {
      logger.error('验证码验证失败', { phone, error: error.message }, error.stack);
      return {
        success: false,
        message: '验证失败，请稍后重试'
      };
    }
  }

  /**
   * 清除验证码
   */
  async clearVerificationCode(phone: string): Promise<void> {
    try {
      const codeKey = `verify_code:${phone}`;
      await this.redis.del(codeKey);
    } catch (error) {
      logger.error('清除验证码失败', { phone, error: error.message }, error.stack);
    }
  }

  /**
   * 生成验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 发送短信（模拟）
   */
  private async sendSMS(phone: string, code: string): Promise<void> {
    // TODO: 集成真实的短信服务提供商 (阿里云、腾讯云等)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📱 [模拟短信] 发送到 ${phone}: 验证码 ${code}`);
    } else {
      // 生产环境应该调用真实的短信API
      console.log(`📱 短信已发送到 ${phone}`);
    }
  }

  /**
   * 获取验证码发送状态
   */
  async getCodeStatus(phone: string): Promise<{
    canSend: boolean;
    remaining: number;
    nextSendTime?: number;
  }> {
    try {
      const sendKey = `verify_send:${phone}`;
      const lastSendKey = `verify_last_send:${phone}`;
      
      const sendCount = await this.redis.get(sendKey);
      const lastSendTime = await this.redis.get(lastSendKey);
      
      const currentSendCount = sendCount ? parseInt(sendCount) : 0;
      const remaining = this.MAX_SEND_COUNT - currentSendCount;
      
      if (remaining <= 0) {
        return {
          canSend: false,
          remaining: 0
        };
      }
      
      if (lastSendTime) {
        const timeSinceLastSend = Date.now() - parseInt(lastSendTime);
        if (timeSinceLastSend < this.SEND_INTERVAL * 1000) {
          return {
            canSend: false,
            remaining,
            nextSendTime: parseInt(lastSendTime) + this.SEND_INTERVAL * 1000
          };
        }
      }
      
      return {
        canSend: true,
        remaining
      };
      
    } catch (error) {
      logger.error('获取验证码状态失败', { phone, error: error.message }, error.stack);
      return {
        canSend: false,
        remaining: 0
      };
    }
  }
}

export default VerificationCodeService;
