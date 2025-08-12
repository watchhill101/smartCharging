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

// AI 客服配置
const AI_CONFIG = {
  apiKey: "sk-jcqcc71pkFwLcp2r0e2aBc6174834417B7F32d148c786773",
  baseURL: "https://free.v36.cm/v1",
  model: "gpt-3.5-turbo",
  maxTokens: 800,
  temperature: 0.7,
  timeout: 30000 // 30秒超时
}

// 预设问题
const PRESET_QUESTIONS = [
  "充电桩如何使用？",
  "如何支付充电费用？", 
  "充电故障怎么办？",
  "如何查看充电记录？",
  "会员有什么优惠？",
  "如何找到附近充电桩？"
]

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
      content: '您好！我是小电，您的智能充电助手 🔌\n\n很高兴为您服务！我可以帮您解答：\n• 充电桩使用方法\n• 支付和计费问题\n• 故障处理方案\n• 会员优惠政策\n• 充电站查找\n\n有什么问题尽管问我哦～ 😊',
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

  // 优化的 AI 调用函数
  const callAI = useCallback(async (userMessage: string): Promise<string> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout)

    try {
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

      const response = await fetch(`${AI_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages: [getSystemPrompt(), ...conversationHistory],
          max_tokens: AI_CONFIG.maxTokens,
          temperature: AI_CONFIG.temperature,
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

      return data.choices[0]?.message?.content || '抱歉，我没有收到有效的回复，请重新提问 🤔'
    } catch (error: any) {
      clearTimeout(timeoutId)
      console.error('AI调用错误:', error)
      
      if (error.name === 'AbortError') {
        throw new Error('timeout')
      }
      
      throw error
    }
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
          title: '发送失败，请重试',
          icon: 'error',
          duration: 2000
        })
      } catch (e) {
        console.log('发送失败，请重试')
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, callAI, scrollToBottom, getErrorMessage])

  // 处理预设问题点击 - 添加防抖
  const handlePresetQuestion = useCallback((question: string) => {
    if (isLoading) return
    sendMessage(question)
  }, [isLoading, sendMessage])

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
              content: '对话已清空！我是小电，继续为您服务 🔌\n\n有什么充电相关问题可以随时问我哦～ 😊',
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

      {/* 预设问题区域 */}
      {messages.length <= 1 && (
        <View className='preset-questions'>
          <Text className='preset-title'>💡 常见问题</Text>
          <View className='questions-grid'>
            {PRESET_QUESTIONS.map((question, index) => (
              <View 
                key={index}
                className='question-item'
                onClick={() => handlePresetQuestion(question)}
              >
                <Text className='question-text'>{question}</Text>
              </View>
            ))}
          </View>
          <View className='tip-box'>
            <Text className='tip-text'>💡 点击问题快速提问，或在下方输入您的问题</Text>
          </View>
        </View>
      )}

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
            {messages.length > 2 && (
              <Button 
                className='tool-button clear-button' 
                size='mini'
                onClick={clearMessages}
              >
                🗑️ 清空
              </Button>
            )}
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
            🤖 本回答由 AI 生成，仅供参考。如需准确信息请联系人工客服
          </Text>
        </View>
      </View>
    </View>
  )
}

export default AiServer
