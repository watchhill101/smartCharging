import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

// 安全的 Taro API 调用
const showToast = (options: any) => {
  try {
    if (Taro.showToast && typeof Taro.showToast === 'function') {
      Taro.showToast(options)
    } else {
      console.log('Toast:', options.title)
    }
  } catch (error) {
    console.log('Toast:', options.title)
  }
}

const showModal = (options: any) => {
  try {
    if (Taro.showModal && typeof Taro.showModal === 'function') {
      Taro.showModal(options)
    } else {
      const result = window.confirm(`${options.title}\n${options.content}`)
      options.success?.({ confirm: result, cancel: !result })
    }
  } catch (error) {
    const result = window.confirm(`${options.title}\n${options.content}`)
    options.success?.({ confirm: result, cancel: !result })
  }
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
  isError?: boolean
}

interface ApiResponse {
  choices: {
    message: {
      content: string
    }
  }[]
  error?: {
    message: string
  }
}

// AI 模型配置 - 支持多个模型备用
const AI_MODELS = [
  {
    name: 'GPT-3.5-Turbo',
    apiKey: "sk-jcqcc71pkFwLcp2r0e2aBc6174834417B7F32d148c786773",
    baseURL: "https://free.v36.cm/v1",
    model: "gpt-3.5-turbo",
    maxTokens: 800,
    temperature: 0.7,
    timeout: 30000,
    priority: 1 // 优先级，数字越小优先级越高
  },
  {
    name: 'GPT-4o-Mini',
    apiKey: "sk-jcqcc71pkFwLcp2r0e2aBc6174834417B7F32d148c786773",
    baseURL: "https://free.v36.cm/v1",
    model: "gpt-4o-mini",
    maxTokens: 600,
    temperature: 0.7,
    timeout: 25000,
    priority: 2
  },
  {
    name: 'GPT-3.5-备用',
    apiKey: "sk-jcqcc71pkFwLcp2r0e2aBc6174834417B7F32d148c786773",
    baseURL: "https://api.openai.com/v1", // 官方接口作为备用
    model: "gpt-3.5-turbo-1106",
    maxTokens: 500,
    temperature: 0.8,
    timeout: 20000,
    priority: 3
  }
]

// 当前使用的模型索引
let currentModelIndex = 0

// 获取当前可用的模型配置
const getCurrentModel = () => {
  return AI_MODELS[currentModelIndex] || AI_MODELS[0]
}

// 切换到下一个可用模型
const switchToNextModel = () => {
  currentModelIndex = (currentModelIndex + 1) % AI_MODELS.length
  console.log(`切换到模型: ${getCurrentModel().name}`)
  return getCurrentModel()
}

// 重置到首选模型
const resetToPreferredModel = () => {
  currentModelIndex = 0
  console.log(`重置到首选模型: ${getCurrentModel().name}`)
}

// 检查错误类型，决定是否切换模型
const shouldSwitchModel = (error: any) => {
  const errorMessage = error.message?.toLowerCase() || ''
  
  // 以下情况应该切换模型
  const switchConditions = [
    errorMessage.includes('429'), // 请求过于频繁
    errorMessage.includes('502'), // 网关错误
    errorMessage.includes('503'), // 服务不可用
    errorMessage.includes('504'), // 网关超时
    errorMessage.includes('model not found'), // 模型不存在
    errorMessage.includes('quota'), // 配额不足
    errorMessage.includes('rate limit'), // 频率限制
    error.name === 'AbortError' // 请求超时
  ]
  
  return switchConditions.some(condition => condition)
}

// 错误类型映射
const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接异常，请检查网络后重试 🌐',
  API_ERROR: 'AI服务暂时不可用，请稍后再试 🤖',
  TIMEOUT_ERROR: '请求超时，请重新发送消息 ⏰',
  UNKNOWN_ERROR: '发生未知错误，如需帮助请联系人工客服 📞'
}

// 生成唯一ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 获取系统提示
const getSystemPrompt = () => ({
  role: 'system' as const,
  content: `你是智能充电平台的AI客服助手"小电"，专门为电动车用户提供专业、贴心的服务。

🎯 你的职责：
1. 充电桩使用指导和操作流程
2. 充电费用计算和支付方式说明
3. 充电故障诊断和解决方案
4. 会员服务和优惠政策介绍
5. APP功能使用指导
6. 充电安全建议和注意事项
7. 充电站查找和预约服务

💡 服务标准：
- 回答简洁明了，重点突出
- 语气友好亲切，适当使用emoji
- 对复杂问题提供分步骤解答
- 不确定时诚实告知并提供替代方案
- 主动提供相关建议和提示

📞 人工客服：400-123-4567
🕒 服务时间：24小时在线，人工客服8:00-22:00

记住：你叫"小电"，是用户的贴心充电助手！`
})

const AiServer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      content: '您好！我是小电，您的智能充电助手 🔌\n\n很高兴为您服务！我可以为您提供以下专业服务：\n\n🔌 充电指导 - 充电桩使用方法和操作流程\n💳 支付帮助 - 充电费用计算和支付方式\n�️ 故障处理 - 充电异常诊断和解决方案\n🎁 会员优惠 - 会员服务和优惠政策介绍\n📍 站点查找 - 充电站查找和预约服务\n📊 记录查询 - 充电历史和账单查询\n\n有什么问题随时问我，我会为您详细解答！😊',
      role: 'assistant',
      timestamp: Date.now()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const scrollViewRef = useRef<any>()
  const inputRef = useRef<any>()

  // 滚动到底部 - 优化性能
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTop = scrollViewRef.current.scrollHeight
      }
    }, 100)
  }, [])

  // 获取错误信息
  const getErrorMessage = useCallback((error: any) => {
    if (error.name === 'TypeError' || error.message?.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }
    if (error.message?.includes('timeout')) {
      return ERROR_MESSAGES.TIMEOUT_ERROR
    }
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return ERROR_MESSAGES.API_ERROR
    }
    return ERROR_MESSAGES.UNKNOWN_ERROR + '\n\n📞 人工客服：400-123-4567'
  }, [])

  // 优化的 AI 调用函数 - 支持多模型备用
  const callAI = useCallback(async (userMessage: string): Promise<string> => {
    let lastError: any = null
    let attemptCount = 0
    const maxAttempts = AI_MODELS.length

    // 尝试所有可用模型
    while (attemptCount < maxAttempts) {
      const currentModel = getCurrentModel()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), currentModel.timeout)

      try {
        console.log(`尝试使用模型: ${currentModel.name} (第${attemptCount + 1}次尝试)`)
        
        // 构建对话历史 - 只保留最近的对话
        const conversationHistory = messages
          .slice(-6) // 减少到6轮对话，节省 token
          .filter(msg => !msg.isError) // 过滤错误消息
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        
        // 添加当前用户消息
        conversationHistory.push({
          role: 'user',
          content: userMessage
        })

        const response = await fetch(`${currentModel.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentModel.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel.model,
            messages: [getSystemPrompt(), ...conversationHistory],
            max_tokens: currentModel.maxTokens,
            temperature: currentModel.temperature,
            stream: false
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API调用失败 (${response.status}): ${errorText}`)
        }

        const data: ApiResponse = await response.json()
        
        if (data.error) {
          throw new Error(data.error.message)
        }

        const content = data.choices[0]?.message?.content
        if (!content) {
          throw new Error('模型返回内容为空')
        }

        // 成功后重置到首选模型（延迟重置）
        if (attemptCount > 0) {
          console.log(`模型 ${currentModel.name} 调用成功，60秒后将重置到首选模型`)
          setTimeout(resetToPreferredModel, 60000) // 60秒后重置
        }

        return content

      } catch (error: any) {
        clearTimeout(timeoutId)
        lastError = error
        console.error(`模型 ${currentModel.name} 调用失败:`, error.message)
        
        // 检查是否应该切换模型
        if (shouldSwitchModel(error) && attemptCount < maxAttempts - 1) {
          switchToNextModel()
          attemptCount++
          console.log(`切换到备用模型，继续尝试...`)
          continue
        } else {
          // 如果是其他错误（如网络问题），直接抛出
          throw error
        }
      }
    }

    // 所有模型都失败了
    throw new Error(`所有模型都无法响应: ${lastError?.message || '未知错误'}`)
  }, [messages])

  // 发送消息 - 优化错误处理和重试机制
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      content: content.trim(),
      role: 'user',
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    scrollToBottom()

    try {
      const aiResponse = await callAI(content.trim())
      
      const assistantMessage: Message = {
        id: generateId(),
        content: aiResponse,
        role: 'assistant',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, assistantMessage])
      scrollToBottom()
      setRetryCount(0) // 重置重试次数
    } catch (error: any) {
      console.error('发送消息失败:', error)
      
      const errorMessage: Message = {
        id: generateId(),
        content: getErrorMessage(error),
        role: 'assistant',
        timestamp: Date.now(),
        isError: true
      }
      
      setMessages(prev => [...prev, errorMessage])
      scrollToBottom()
      
      // 显示用户友好的错误提示 - 使用控制台输出作为备用
      try {
        showToast({
          title: '发送失败，已尝试备用模型',
          icon: 'error',
          duration: 2000
        })
      } catch (e) {
        console.log('发送失败，已尝试备用模型')
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, callAI, scrollToBottom, getErrorMessage])

  // 清空对话 - 优化用户体验
  const clearMessages = useCallback(() => {
    showModal({
      title: '清空对话',
      content: '确定要清空所有对话记录吗？此操作无法撤销。',
      confirmText: '清空',
      cancelText: '取消',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          setMessages([
            {
              id: generateId(),
              content: '对话已清空！我是小电，继续为您服务 🔌\n\n我可以为您提供：\n🔌 充电指导 💳 支付帮助 🛠️ 故障处理\n🎁 会员优惠 📍 站点查找 📊 记录查询\n\n有什么充电相关问题可以随时问我哦～ 😊',
              role: 'assistant',
              timestamp: Date.now()
            }
          ])
          setRetryCount(0)
          showToast({
            title: '对话已清空',
            icon: 'success'
          })
        }
      }
    })
  }, [])

  // 重试发送 - 新增功能
  const retryLastMessage = useCallback(() => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user')
    
    if (lastUserMessage && retryCount < 3) {
      setRetryCount(prev => prev + 1)
      sendMessage(lastUserMessage.content)
    } else {
      showToast({
        title: '重试次数过多，请稍后再试',
        icon: 'error'
      })
    }
  }, [messages, retryCount, sendMessage])

  // 格式化时间 - 优化显示
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp
    
    // 如果是今天
    if (diff < 24 * 60 * 60 * 1000) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 如果是昨天
    if (diff < 48 * 60 * 60 * 1000) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 更早的日期
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }, [])

  // 输入框快捷操作
  const handleKeyPress = useCallback((e: any) => {
    if (e.detail.value.length > 500) {
      console.log('消息过长，请精简后发送')
      return
    }
  }, [])

  // 优化 useEffect
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // 页面初始化
  useEffect(() => {
    console.log('AI客服页面已加载')
  }, [])

  return (
    <View className='aiserver-container'>

      {/* 聊天区域 */}
      <ScrollView 
        className='chat-area'
        scrollY
        scrollIntoView='bottom'
        ref={scrollViewRef}
        enhanced
        showScrollbar={false}
      >
        {messages.map((message) => (
          <View key={message.id} className={`message-item ${message.role} ${message.isError ? 'error' : ''}`}>
            <View className='message-content'>
              {message.role === 'assistant' && (
                <View className='avatar assistant-avatar'>
                  {message.isError ? '⚠️' : '🤖'}
                </View>
              )}
              <View className='message-bubble'>
                <Text className='message-text' selectable>{message.content}</Text>
                <View className='message-footer'>
                  <Text className='message-time'>{formatTime(message.timestamp)}</Text>
                  {message.isError && (
                    <View className='retry-button' onClick={retryLastMessage}>
                      <Text className='retry-text'>重试</Text>
                    </View>
                  )}
                </View>
              </View>
              {message.role === 'user' && (
                <View className='avatar user-avatar'>
                  👤
                </View>
              )}
            </View>
          </View>
        ))}
        
        {isLoading && (
          <View className='message-item assistant'>
            <View className='message-content'>
              <View className='avatar assistant-avatar'>🤖</View>
              <View className='message-bubble loading'>
                <View className='typing-indicator'>
                  <View className='dot'></View>
                  <View className='dot'></View>
                  <View className='dot'></View>
                </View>
                <Text className='loading-text'>小电正在思考中...</Text>
              </View>
            </View>
          </View>
        )}
        
        <View id='bottom' style={{ height: '1rpx' }}></View>
      </ScrollView>

      {/* 输入区域 */}
      <View className='input-area'>
        <View className='input-container'>
          <Input
            ref={inputRef}
            className='message-input'
            placeholder='请输入您的问题...'
            value={inputValue}
            onInput={(e) => {
              setInputValue(e.detail.value)
              handleKeyPress(e)
            }}
            onConfirm={() => sendMessage(inputValue)}
            disabled={isLoading}
            maxlength={500}
            confirmType='send'
          />
          <Button 
            className={`send-button ${inputValue.trim() && !isLoading ? 'active' : ''}`}
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            size='mini'
          >
            {isLoading ? '发送中' : '发送'}
          </Button>
        </View>
        
        <View className='input-tools'>
          <View className='tool-left'>
            <Text className='char-count'>{inputValue.length}/500</Text>
          </View>
          <View className='tool-right'>
            <Button 
              className={`tool-button clear-button ${messages.length > 2 ? 'visible' : 'hidden'}`}
              size='mini'
              onClick={clearMessages}
              disabled={messages.length <= 2}
            >
              🗑️ 清空
            </Button>
            <Button 
              className='tool-button help-button' 
              size='mini'
              onClick={() => {
                showModal({
                  title: '联系客服',
                  content: '人工客服热线：400-123-4567\n服务时间：8:00-22:00\n\n或继续与AI助手小电对话',
                  showCancel: false
                })
              }}
            >
              📞 人工
            </Button>
          </View>
        </View>
        
        <View className='disclaimer'>
          <Text className='disclaimer-text'>
            本回答由 AI 生成，仅供参考。如需准确信息请联系人工客服
          </Text>
        </View>
      </View>
    </View>
  )
}

export default AiServer
