import { useState } from 'react'
import { View, Text, ScrollView, Input, Button } from '@tarojs/components'
import './index.scss'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

const AiServerSimple = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '您好！我是智能充电助手小电 🔌\n\n很高兴为您服务！请问有什么充电相关的问题吗？',
      role: 'assistant',
      timestamp: Date.now()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 模拟 AI 回复
  const getAIResponse = (userInput: string): string => {
    const responses = [
      '这是一个很好的问题！关于充电桩的使用，您需要先扫描充电桩上的二维码...',
      '充电费用根据不同时段有所差异，一般白天0.6元/度，夜间0.4元/度...',
      '如果遇到充电故障，请先检查充电枪是否正确连接，然后联系客服...',
      '您可以在APP的"我的"-"充电记录"中查看所有充电历史...',
      '我们的会员用户可享受9.5折优惠，以及免费停车等特权...'
    ]
    
    if (userInput.includes('使用') || userInput.includes('怎么')) {
      return responses[0]
    } else if (userInput.includes('费用') || userInput.includes('价格')) {
      return responses[1]
    } else if (userInput.includes('故障') || userInput.includes('问题')) {
      return responses[2]
    } else if (userInput.includes('记录') || userInput.includes('历史')) {
      return responses[3]
    } else if (userInput.includes('会员') || userInput.includes('优惠')) {
      return responses[4]
    } else {
      return '感谢您的提问！我会尽力为您解答充电相关的问题。如需更详细的帮助，请联系人工客服：400-123-4567'
    }
  }

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 模拟API调用延迟
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: getAIResponse(content.trim()),
        role: 'assistant',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, aiResponse])
      setIsLoading(false)
    }, 1000 + Math.random() * 2000) // 1-3秒随机延迟
  }

  // 预设问题
  const handlePresetQuestion = (question: string) => {
    sendMessage(question)
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <View className='aiserver-container'>
      {/* 聊天区域 */}
      <ScrollView className='chat-area' scrollY>
        {messages.map((message) => (
          <View key={message.id} className={`message-item ${message.role}`}>
            <View className='message-content'>
              {message.role === 'assistant' && (
                <View className='avatar assistant-avatar'>🤖</View>
              )}
              <View className='message-bubble'>
                <Text className='message-text'>{message.content}</Text>
                <Text className='message-time'>{formatTime(message.timestamp)}</Text>
              </View>
              {message.role === 'user' && (
                <View className='avatar user-avatar'>👤</View>
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
      </ScrollView>

      {/* 预设问题 */}
      {messages.length <= 1 && (
        <View className='preset-questions'>
          <Text className='preset-title'>💡 常见问题</Text>
          <View className='questions-grid'>
            {[
              "充电桩如何使用？",
              "如何支付充电费用？",
              "充电故障怎么办？",
              "如何查看充电记录？",
              "会员有什么优惠？"
            ].map((question, index) => (
              <View 
                key={index}
                className='question-item'
                onClick={() => handlePresetQuestion(question)}
              >
                <Text className='question-text'>{question}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 输入区域 */}
      <View className='input-area'>
        <View className='input-container'>
          <Input
            className='message-input'
            placeholder='请输入您的问题...'
            value={inputValue}
            onInput={(e) => setInputValue(e.detail.value)}
            onConfirm={() => sendMessage(inputValue)}
            disabled={isLoading}
          />
          <Button 
            className={`send-button ${inputValue.trim() && !isLoading ? 'active' : ''}`}
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? '发送中' : '发送'}
          </Button>
        </View>
        
        <View className='disclaimer'>
          <Text className='disclaimer-text'>
            🤖 演示版本 - 实际项目中可接入真实AI服务
          </Text>
        </View>
      </View>
    </View>
  )
}

export default AiServerSimple
