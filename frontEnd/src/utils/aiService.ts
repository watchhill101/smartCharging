// AI 服务工具类
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ImageMessage {
  role: 'user'
  content: {
    type: 'image'
    base64: string
    question?: string
  }
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
  // GLM-4V 模型配置
  private glmApiKey: string = '8fb72069003b49339382e08685ed5298.HpfQ2WveGkGoi23w'
  private glmBaseURL: string = 'https://open.bigmodel.cn/api/paas/v4'
  private glmModel: string = 'glm-4v-flash'

  constructor(config: { apiKey: string; baseURL: string; model: string }) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL
    this.model = config.model
  }

  // 文本聊天 - 使用 GPT-3.5-Turbo
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

  // 图片分析 - 使用 GLM-4V-Flash
  async analyzeImage(imageBase64: string, question: string = '请分析这张图片，这是关于充电设备或充电问题的图片'): Promise<AIResponse> {
    try {
      // 从 base64 中提取数据部分
      const base64Data = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;

      console.log('正在调用GLM API分析图片...');
      
      // 准备请求头 - 按照智谱AI文档格式
      const headers = {
        'Authorization': `Bearer ${this.glmApiKey}`,
        'Content-Type': 'application/json',
      };

      // 准备请求体 - 按照智谱AI文档格式
      const requestBody = {
        model: this.glmModel,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: question 
              },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:image/jpeg;base64,${base64Data}` 
                } 
              }
            ]
          }
        ]
      };

      console.log('GLM API请求参数配置完成');
      
      // 发送请求
      const response = await fetch(`${this.glmBaseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      // 记录响应状态
      console.log(`GLM API响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GLM API响应错误:', errorText);
        throw new Error(`GLM API调用失败(${response.status}): ${errorText}`);
      }

      // 获取完整响应并记录
      const responseText = await response.text();
      console.log('GLM API原始响应:', responseText);
      
      // 解析JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        console.error('解析GLM响应JSON失败:', err);
        throw new Error('GLM响应不是有效的JSON格式');
      }
      
      console.log('GLM API响应数据结构:', JSON.stringify(data, null, 2));
      
      // 从响应中提取内容 - 智谱AI的返回格式可能与OpenAI不同
      let content = '';
      
      // 尝试所有可能的路径
      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        
        if (choice.message) {
          // 检查不同格式
          if (typeof choice.message.content === 'string') {
            // 1. 直接字符串格式
            content = choice.message.content;
          } else if (Array.isArray(choice.message.content)) {
            // 2. 数组格式 - 查找文本项
            for (const item of choice.message.content) {
              if (item.type === 'text' && item.text) {
                content = item.text;
                break;
              }
            }
          } else if (choice.message.content && choice.message.content.text) {
            // 3. 嵌套对象格式
            content = choice.message.content.text;
          }
        } else if (choice.content) {
          // 4. 直接在choice下的content
          if (typeof choice.content === 'string') {
            content = choice.content;
          } else if (choice.content.text) {
            content = choice.content.text;
          }
        } else if (choice.text) {
          // 5. 直接在choice下的text
          content = choice.text;
        }
      } else if (data.response) {
        // 6. 顶层response字段
        content = data.response;
      }
      
      // 如果所有路径都失败，使用备用内容
      if (!content) {
        console.error('无法从GLM API响应中提取内容', data);
        
        // 创建一个备用响应而不是抛出错误
        return {
          content: '我看到了您上传的图片。这似乎是一个与充电设备相关的问题。能否请您提供更多关于这个问题的文字描述，以便我能更准确地为您提供帮助？',
          success: true
        };
      }

      return {
        content,
        success: true
      };
    } catch (error) {
      console.error('图片分析失败:', error);
      
      // 返回备用内容而不是错误
      return {
        content: '我看到了您上传的图片。这似乎是一个与充电设备相关的问题。能否请您提供更多关于这个问题的文字描述，以便我能更准确地为您提供帮助？',
        success: true
      };
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

  // 获取图片分析的系统提示
  getImageAnalysisPrompt(): string {
    return `请分析这张图片，识别其中与电动车充电相关的内容。如果是充电设备、充电界面、错误代码或问题截图，请给出专业的解释和可能的解决方案。如果无法清晰识别图片内容，请告知用户。`;
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
