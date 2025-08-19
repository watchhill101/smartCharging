import crypto from 'crypto';
import axios from 'axios';

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  type: 'verification' | 'notification' | 'marketing' | 'alert';
}

export interface SmsMessage {
  id: string;
  phoneNumber: string;
  templateId: string;
  variables: Record<string, string>;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

export interface SmsConfig {
  provider: 'aliyun' | 'tencent' | 'mock';
  accessKeyId?: string;
  accessKeySecret?: string;
  signName: string;
  endpoint?: string;
}

export interface SendSmsOptions {
  phoneNumber: string;
  templateId: string;
  variables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  bizId?: string;
}

/**
 * SMS服务类
 * 支持多个短信服务提供商
 */
export class SmsService {
  private config: SmsConfig;
  private templates: Map<string, SmsTemplate> = new Map();
  private messageHistory: SmsMessage[] = [];

  constructor(config: SmsConfig) {
    this.config = config;
    this.initializeTemplates();
  }

  /**
   * 初始化短信模板
   */
  private initializeTemplates(): void {
    const templates: SmsTemplate[] = [
      {
        id: 'CHARGING_STARTED',
        name: '充电开始通知',
        content: '您的车辆在${stationName}开始充电，预计充电时间${estimatedTime}。如有疑问请联系客服。',
        variables: ['stationName', 'estimatedTime'],
        type: 'notification'
      },
      {
        id: 'CHARGING_COMPLETED',
        name: '充电完成通知',
        content: '您的车辆充电已完成！本次充电${chargedAmount}kWh，费用${totalCost}元。请及时移走车辆。',
        variables: ['chargedAmount', 'totalCost'],
        type: 'notification'
      },
      {
        id: 'CHARGING_FAILED',
        name: '充电异常通知',
        content: '您的充电会话发生异常：${reason}。请重新尝试或联系客服${servicePhone}。',
        variables: ['reason', 'servicePhone'],
        type: 'alert'
      },
      {
        id: 'PAYMENT_SUCCESS',
        name: '支付成功通知',
        content: '支付成功！订单${orderId}，金额${amount}元已完成支付。感谢您的使用！',
        variables: ['orderId', 'amount'],
        type: 'notification'
      },
      {
        id: 'PAYMENT_FAILED',
        name: '支付失败通知',
        content: '支付失败，订单${orderId}支付未成功。请重新尝试或联系客服${servicePhone}。',
        variables: ['orderId', 'servicePhone'],
        type: 'alert'
      },
      {
        id: 'BALANCE_LOW',
        name: '余额不足提醒',
        content: '您的账户余额不足${balance}元，请及时充值以免影响充电服务。点击链接快速充值。',
        variables: ['balance'],
        type: 'alert'
      },
      {
        id: 'COUPON_RECEIVED',
        name: '优惠券到账通知',
        content: '恭喜！您获得${couponName}优惠券，面额${amount}元，有效期至${expiryDate}。',
        variables: ['couponName', 'amount', 'expiryDate'],
        type: 'marketing'
      },
      {
        id: 'COUPON_EXPIRING',
        name: '优惠券过期提醒',
        content: '提醒：您的${couponName}优惠券将在${days}天后过期，请及时使用。',
        variables: ['couponName', 'days'],
        type: 'marketing'
      },
      {
        id: 'VERIFICATION_CODE',
        name: '验证码短信',
        content: '您的验证码是${code}，5分钟内有效，请勿泄露给他人。',
        variables: ['code'],
        type: 'verification'
      },
      {
        id: 'SYSTEM_MAINTENANCE',
        name: '系统维护通知',
        content: '系统将于${startTime}进行维护，预计${duration}小时。维护期间可能影响服务，请提前安排。',
        variables: ['startTime', 'duration'],
        type: 'notification'
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * 发送短信
   */
  async sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
    try {
      // 验证手机号格式
      if (!this.isValidPhoneNumber(options.phoneNumber)) {
        return {
          success: false,
          error: '手机号格式不正确'
        };
      }

      // 获取模板
      const template = this.templates.get(options.templateId);
      if (!template) {
        return {
          success: false,
          error: `模板 ${options.templateId} 不存在`
        };
      }

      // 验证模板变量
      const missingVars = this.validateTemplateVariables(template, options.variables || {});
      if (missingVars.length > 0) {
        return {
          success: false,
          error: `缺少模板变量: ${missingVars.join(', ')}`
        };
      }

      // 生成短信内容
      const content = this.generateSmsContent(template, options.variables || {});

      // 创建消息记录
      const message: SmsMessage = {
        id: this.generateMessageId(),
        phoneNumber: options.phoneNumber,
        templateId: options.templateId,
        variables: options.variables || {},
        content,
        status: 'pending',
        createdAt: new Date()
      };

      // 根据配置的提供商发送短信
      let result: SendSmsResult;
      switch (this.config.provider) {
        case 'aliyun':
          result = await this.sendAliyunSms(message);
          break;
        case 'tencent':
          result = await this.sendTencentSms(message);
          break;
        case 'mock':
        default:
          result = await this.sendMockSms(message);
          break;
      }

      // 更新消息状态
      message.status = result.success ? 'sent' : 'failed';
      if (result.success) {
        message.sentAt = new Date();
      } else {
        message.failureReason = result.error;
      }

      // 保存消息记录
      this.messageHistory.push(message);

      console.log(`SMS ${result.success ? '发送成功' : '发送失败'}:`, {
        phone: this.maskPhoneNumber(options.phoneNumber),
        template: options.templateId,
        result
      });

      return result;
    } catch (error: any) {
      console.error('发送短信失败:', error);
      return {
        success: false,
        error: error.message || '发送失败'
      };
    }
  }

  /**
   * 批量发送短信
   */
  async sendBulkSms(messages: SendSmsOptions[]): Promise<SendSmsResult[]> {
    const results: SendSmsResult[] = [];
    
    for (const message of messages) {
      const result = await this.sendSms(message);
      results.push(result);
      
      // 添加延迟以避免频率限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * 阿里云短信发送
   */
  private async sendAliyunSms(message: SmsMessage): Promise<SendSmsResult> {
    try {
      if (!this.config.accessKeyId || !this.config.accessKeySecret) {
        throw new Error('阿里云短信配置不完整');
      }

      const params = {
        PhoneNumbers: message.phoneNumber,
        SignName: this.config.signName,
        TemplateCode: message.templateId,
        TemplateParam: JSON.stringify(message.variables)
      };

      const signature = this.generateAliyunSignature(params);
      
      const response = await axios.post(
        this.config.endpoint || 'https://dysmsapi.aliyuncs.com',
        params,
        {
          headers: {
            'Authorization': signature,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.Code === 'OK') {
        return {
          success: true,
          messageId: response.data.RequestId,
          bizId: response.data.BizId
        };
      } else {
        return {
          success: false,
          error: response.data.Message || '发送失败'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '阿里云短信发送失败'
      };
    }
  }

  /**
   * 腾讯云短信发送
   */
  private async sendTencentSms(message: SmsMessage): Promise<SendSmsResult> {
    try {
      // 腾讯云短信API实现
      // 这里是示例实现，实际需要根据腾讯云SDK进行调整
      
      return {
        success: true,
        messageId: 'tencent_' + Date.now()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '腾讯云短信发送失败'
      };
    }
  }

  /**
   * 模拟短信发送（用于开发测试）
   */
  private async sendMockSms(message: SmsMessage): Promise<SendSmsResult> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟90%成功率
    const success = Math.random() > 0.1;
    
    if (success) {
      console.log('📱 模拟短信发送成功:');
      console.log(`   收件人: ${this.maskPhoneNumber(message.phoneNumber)}`);
      console.log(`   内容: ${message.content}`);
      
      return {
        success: true,
        messageId: 'mock_' + Date.now()
      };
    } else {
      return {
        success: false,
        error: '模拟发送失败'
      };
    }
  }

  /**
   * 生成阿里云签名
   */
  private generateAliyunSignature(params: Record<string, any>): string {
    // 这里是简化的签名生成，实际应该使用阿里云SDK
    const timestamp = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2);
    
    return `HMAC-SHA1 Credential=${this.config.accessKeyId}, SignedHeaders=host;x-date, Signature=mock_signature`;
  }

  /**
   * 验证手机号格式
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // 中国大陆手机号验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * 验证模板变量
   */
  private validateTemplateVariables(
    template: SmsTemplate, 
    variables: Record<string, string>
  ): string[] {
    const missingVars: string[] = [];
    
    template.variables.forEach(varName => {
      if (!variables[varName]) {
        missingVars.push(varName);
      }
    });
    
    return missingVars;
  }

  /**
   * 生成短信内容
   */
  private generateSmsContent(
    template: SmsTemplate, 
    variables: Record<string, string>
  ): string {
    let content = template.content;
    
    template.variables.forEach(varName => {
      const placeholder = `\${${varName}}`;
      content = content.replace(new RegExp(placeholder, 'g'), variables[varName] || '');
    });
    
    return content;
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    return 'sms_' + Date.now() + '_' + Math.random().toString(36).substring(2);
  }

  /**
   * 掩码手机号
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length !== 11) return phoneNumber;
    return phoneNumber.substring(0, 3) + '****' + phoneNumber.substring(7);
  }

  /**
   * 获取短信模板
   */
  getTemplate(templateId: string): SmsTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): SmsTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: SmsTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(limit: number = 100): SmsMessage[] {
    return this.messageHistory
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * 获取发送统计
   */
  getStatistics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): {
    total: number;
    sent: number;
    failed: number;
    successRate: number;
    byTemplate: Record<string, number>;
  } {
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const messages = this.messageHistory.filter(
      msg => msg.createdAt >= startTime
    );
    
    const total = messages.length;
    const sent = messages.filter(msg => msg.status === 'sent').length;
    const failed = messages.filter(msg => msg.status === 'failed').length;
    const successRate = total > 0 ? (sent / total) * 100 : 0;
    
    const byTemplate: Record<string, number> = {};
    messages.forEach(msg => {
      byTemplate[msg.templateId] = (byTemplate[msg.templateId] || 0) + 1;
    });
    
    return {
      total,
      sent,
      failed,
      successRate,
      byTemplate
    };
  }

  /**
   * 清理过期消息历史
   */
  cleanupHistory(daysToKeep: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const initialCount = this.messageHistory.length;
    
    this.messageHistory = this.messageHistory.filter(
      msg => msg.createdAt >= cutoffDate
    );
    
    const deletedCount = initialCount - this.messageHistory.length;
    console.log(`清理短信历史记录: 删除了 ${deletedCount} 条记录`);
    
    return deletedCount;
  }
}
