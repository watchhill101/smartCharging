// AI 服务工具类
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  success: boolean
  error?: string
}

export class AIService {
  private apiKey: string
  private baseURL: string
  private model: string

  constructor(config: { apiKey: string; baseURL: string; model: string }) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL
    this.model = config.model
  }

  async chat(messages: ChatMessage[]): Promise<AIResponse> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error.message || 'API返回错误')
      }

      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('API返回格式错误')
      }

      return {
        content,
        success: true
      }
    } catch (error) {
      console.error('AI服务调用失败:', error)
      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  // 获取智能充电相关的系统提示
  getSystemPrompt(): ChatMessage {
    return {
      role: 'system',
      content: `你是智能充电平台的AI客服助手，专门为电动车用户提供专业服务。

你的职责包括：
1. 回答充电桩使用方法和操作流程
2. 解释充电费用计算和支付方式
3. 处理充电故障和技术问题
4. 介绍会员服务和优惠政策
5. 指导用户使用APP功能
6. 提供充电安全建议

回答要求：
- 保持专业、友好、耐心的服务态度
- 回答要简洁明了，避免冗长
- 如果遇到复杂技术问题，建议联系人工客服
- 对于不确定的信息，诚实告知并提供替代方案
- 适当使用表情符号增加亲和力

客服热线：400-123-4567（工作时间：8:00-22:00）`
    }
  }

  // 生成错误回复
  getErrorResponse(error: string): string {
    const errorResponses = {
      network: '抱歉，网络连接出现问题，请检查网络后重试。',
      timeout: '请求超时，请稍后再试。',
      auth: 'AI服务暂时不可用，请联系人工客服。',
      quota: 'AI服务忙碌中，请稍后再试或联系人工客服。',
      default: '抱歉，我暂时无法回答您的问题。'
    }

    if (error.includes('网络') || error.includes('network')) {
      return errorResponses.network
    }
    if (error.includes('timeout') || error.includes('超时')) {
      return errorResponses.timeout
    }
    if (error.includes('401') || error.includes('403')) {
      return errorResponses.auth
    }
    if (error.includes('429') || error.includes('quota')) {
      return errorResponses.quota
    }

    return `${errorResponses.default}\n\n如需帮助，请联系人工客服：400-123-4567`
  }
}
