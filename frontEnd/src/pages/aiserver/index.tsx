import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView, Input, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
// 引入自定义图标字体
import '../../assets/icons/ChangeIt/iconfont.css'
import { AIService } from '../../utils/aiService'
import { showToast } from '../utils/toast'

// 安全的 Taro API 调用
const showToast = (options: any) => {
  try {
    if (Taro.showToast && typeof Taro.showToast === 'function') {
      showToast(options)
    } else {
      console.log('Toast:', options.title)
    }
  } catch (error) {
    console.log('Toast:', options.title)
  }
}

const hideToast = () => {
  try {
    if (Taro.hideToast && typeof Taro.hideToast === 'function') {
      Taro.hideToast();
    } else {
      console.log('隐藏Toast');
    }
  } catch (error) {
    console.log('隐藏Toast失败');
  }
};

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
  isWelcome?: boolean // 新增欢迎消息标识
  contentType?: 'text' | 'image' // 新增消息类型
  imageData?: string // 新增图片数据
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
8. 分析用户上传的充电相关图片

💡 服务标准：
- 回答简洁明了，重点突出
- 语气友好亲切，适当使用emoji
- 对复杂问题提供分步骤解答
- 不确定时诚实告知并提供替代方案
- 主动提供相关建议和提示

📞 人工客服：400-123-4567
🕒 服务时间：24小时在线，人工客服8:00-22:00

当用户上传图片时：
1. 仔细分析图片内容
2. 如果是充电桩或电动车相关的问题，给出专业解答
3. 如果是错误代码或故障显示，提供可能的解决方案
4. 如果图片内容不明确，礼貌地请用户提供更清晰的图片或文字描述

记住：你叫"小电"，是用户的贴心充电助手！`
})

const AiServer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      content: '',
      role: 'assistant',
      timestamp: Date.now(),
      isWelcome: true, // 添加欢迎消息标识
      contentType: 'text'
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const [isRecording, setIsRecording] = useState(false); // 录音状态
  const [recordDuration, setRecordDuration] = useState(0);
  const [recognitionStatus, setRecognitionStatus] = useState(''); // 识别状态
  const scrollViewRef = useRef<any>()
  const inputRef = useRef<any>()
  const recorderManagerRef = useRef<any>(null);
  const recordingTimerRef = useRef<any>(null);
  // 在现有状态中添加弹出框控制状态
  const [showImageActionSheet, setShowImageActionSheet] = useState(false)

  // 初始化 AI 服务
  const aiService = new AIService({
    apiKey: AI_MODELS[0].apiKey,
    baseURL: AI_MODELS[0].baseURL,
    model: AI_MODELS[0].model
  });

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

  // 修改 handleCameraClick 方法
  const handleCameraClick = () => {
    if (isLoading || isProcessingImage) return
    
    // H5环境显示自定义选择弹出框
    if (process.env.TARO_ENV === 'h5') {
      setShowImageActionSheet(true)
      return
    }
    
    // 小程序环境直接显示系统选择框
    handleMiniProgramImagePicker()
  }

  // 新增：小程序环境的图片选择器（使用系统原生弹框）
  const handleMiniProgramImagePicker = () => {
    if (isLoading || isProcessingImage) return
    
    try {
      setIsProcessingImage(true)
      
      // 使用 Taro.showActionSheet 显示原生选择框
      Taro.showActionSheet({
        itemList: ['拍照', '从相册选择'],
        success: async (res) => {
          try {
            if (res.tapIndex === 0) {
              // 拍照
              await handleMiniProgramCamera()
            } else if (res.tapIndex === 1) {
              // 相册
              await handleMiniProgramAlbum()
            }
          } catch (error) {
            console.error('图片处理失败:', error)
            showToast({
              title: '操作失败，请重试',
              icon: 'error',
              duration: 2000
            })
          } finally {
            setIsProcessingImage(false)
          }
        },
        fail: () => {
          setIsProcessingImage(false)
        }
      })
    } catch (error) {
      console.error('显示选择框失败:', error)
      setIsProcessingImage(false)
    }
  }

  // 修改后的 H5 拍照处理
  const handleTakePhoto = async () => {
    setShowImageActionSheet(false)
    
    if (isLoading || isProcessingImage) return
    
    try {
      setIsProcessingImage(true)
      handleH5Camera()
    } catch (error) {
      console.error('拍照失败:', error)
      showToast({
        title: '拍照失败，请重试',
        icon: 'error',
        duration: 2000
      })
      setIsProcessingImage(false)
    }
  }

  // 修改后的 H5 相册处理
  const handleChooseFromAlbum = async () => {
    setShowImageActionSheet(false)
    
    if (isLoading || isProcessingImage) return
    
    try {
      setIsProcessingImage(true)
      handleH5Album()
    } catch (error) {
      console.error('选择图片失败:', error)
      showToast({
        title: '选择图片失败，请重试',
        icon: 'error',
        duration: 2000
      })
      setIsProcessingImage(false)
    }
  }

  // 优化后的 H5 摄像头处理
  const handleH5Camera = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // 后置摄像头
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await processImageFile(file)
      } else {
        setIsProcessingImage(false)
      }
    }
    
    // 监听取消事件
    input.oncancel = () => {
      setIsProcessingImage(false)
    }
    
    input.click()
  }

  // 优化后的 H5 相册处理
  const handleH5Album = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await processImageFile(file)
      } else {
        setIsProcessingImage(false)
      }
    }
    
    input.oncancel = () => {
      setIsProcessingImage(false)
    }
    
    input.click()
  }

  // 新增：统一的文件处理方法
  const processImageFile = async (file: File) => {
    try {
      // 文件大小检查（限制为10MB）
      if (file.size > 10 * 1024 * 1024) {
        showToast({
          title: '图片太大，请选择小于10MB的图片',
          icon: 'error',
          duration: 2000
        })
        setIsProcessingImage(false)
        return
      }
      
      // 文件类型检查
      if (!file.type.startsWith('image/')) {
        showToast({
          title: '请选择图片文件',
          icon: 'error',
          duration: 2000
        })
        setIsProcessingImage(false)
        return
      }
      
      // 显示处理提示
      showToast({
        title: '正在处理图片...',
        icon: 'loading',
        duration: 3000
      })
      
      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageSrc = event.target?.result as string
        await processAndSendImage(imageSrc)
      }
      reader.onerror = () => {
        showToast({
          title: '图片读取失败',
          icon: 'error',
          duration: 2000
        })
        setIsProcessingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('处理图片失败:', error)
      setIsProcessingImage(false)
      showToast({
        title: '图片处理失败',
        icon: 'error'
      })
    }
  }

  // 优化后的小程序摄像头拍照
  const handleMiniProgramCamera = async () => {
    try {
      let res
      
      // 优先使用新API
      if (Taro.chooseMedia) {
        res = await Taro.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera'],
          camera: 'back',
          sizeType: ['compressed']
        })
        
        if (res.tempFiles && res.tempFiles.length > 0) {
          await processAndSendImage(res.tempFiles[0].tempFilePath)
          return
        }
      }
      
      // 备用旧API
      if (Taro.chooseImage) {
        res = await Taro.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['camera']
        })
        
        if (res.tempFilePaths && res.tempFilePaths.length > 0) {
          await processAndSendImage(res.tempFilePaths[0])
          return
        }
      }
      
      throw new Error('拍照功能不可用')
    } catch (error) {
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消，不显示错误
        return
      }
      throw error
    }
  }

  // 优化后的小程序相册选择
  const handleMiniProgramAlbum = async () => {
    try {
      let res
      
      // 优先使用新API
      if (Taro.chooseMedia) {
        res = await Taro.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album'],
          sizeType: ['compressed']
        })
        
        if (res.tempFiles && res.tempFiles.length > 0) {
          await processAndSendImage(res.tempFiles[0].tempFilePath)
          return
        }
      }
      
      // 备用旧API
      if (Taro.chooseImage) {
        res = await Taro.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album']
        })
        
        if (res.tempFilePaths && res.tempFilePaths.length > 0) {
          await processAndSendImage(res.tempFilePaths[0])
          return
        }
      }
      
      throw new Error('相册功能不可用')
    } catch (error) {
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消，不显示错误
        return
      }
      throw error
    }
  }

  // 转换图片为base64
  const convertImageToBase64 = (imagePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 在小程序环境中
      if (process.env.TARO_ENV !== 'h5') {
        Taro.getFileSystemManager().readFile({
          filePath: imagePath,
          encoding: 'base64',
          success: (res) => {
            const base64 = `data:image/jpeg;base64,${res.data}`;
            resolve(base64);
          },
          fail: (error) => {
            console.error('读取图片失败:', error);
            reject(error);
          }
        });
      } else {
        // H5环境中图片已经是base64
        resolve(imagePath);
      }
    });
  };

  // 处理图片并发送给AI - 使用 GLM-4V-Flash
  const processAndSendImage = async (imagePath: string) => {
    try {
      // 1. 显示用户发送的图片消息
      const userImageMessage: Message = {
        id: generateId(),
        content: '图片消息',
        role: 'user',
        timestamp: Date.now(),
        contentType: 'image',
        imageData: imagePath
      };
      
      setMessages(prev => [...prev, userImageMessage]);
      scrollToBottom();
      
      // 2. 显示AI正在处理的消息
      const loadingMessageId = generateId();
      const loadingMessage: Message = {
        id: loadingMessageId,
        content: '正在分析您的图片，请稍候...',
        role: 'assistant',
        timestamp: Date.now(),
        contentType: 'text'
      };
      setMessages(prev => [...prev, loadingMessage]);
      scrollToBottom();
      
      // 3. 转换图片为base64
      let imageBase64 = '';
      try {
        console.log('开始转换图片为base64...');
        imageBase64 = imagePath.startsWith('data:image') 
          ? imagePath 
          : await convertImageToBase64(imagePath);
        console.log('图片base64转换完成，长度:', imageBase64.length);
      } catch (error) {
        console.error('图片转换失败:', error);
        throw new Error('图片处理失败，请重试');
      }
      
      // 4. 使用 GLM-4V-Flash 模型分析图片
      console.log('开始调用GLM模型分析图片...');
      const analysisResult = await aiService.analyzeImage(
        imageBase64, 
        aiService.getImageAnalysisPrompt()
      );
      
      console.log('GLM模型分析结果:', analysisResult);
      
      // 5. 替换加载消息或添加新消息
      if (!analysisResult.success) {
        console.error('图片分析失败:', analysisResult.error);
        
        // 使用备用响应
        const backupContent = '我看到了您上传的图片。这似乎是一个与充电设备相关的问题。能否请您提供更多关于这个问题的文字描述，以便我能更准确地为您提供帮助？';
        
        // 更新消息列表 - 替换"正在分析"的临时消息
        setMessages(prev => {
          const newMessages = [...prev];
          const loadingMsgIndex = newMessages.findIndex(msg => msg.id === loadingMessageId);
          
          const assistantMessage: Message = {
            id: generateId(),
            content: backupContent,
            role: 'assistant',
            timestamp: Date.now(),
            contentType: 'text'
          };
          
          if (loadingMsgIndex !== -1) {
            newMessages[loadingMsgIndex] = assistantMessage;
          } else {
            newMessages.push(assistantMessage);
          }
          
          return newMessages;
        });
        
        return; // 提前返回，使用备用响应
      }
      
      // 更新消息列表 - 替换"正在分析"的临时消息
      setMessages(prev => {
        const newMessages = [...prev];
        const loadingMsgIndex = newMessages.findIndex(msg => msg.id === loadingMessageId);
        
        const assistantMessage: Message = {
          id: generateId(),
          content: analysisResult.content || '抱歉，无法解析该图片内容',
          role: 'assistant',
          timestamp: Date.now(),
          contentType: 'text'
        };
        
        if (loadingMsgIndex !== -1) {
          newMessages[loadingMsgIndex] = assistantMessage;
        } else {
          newMessages.push(assistantMessage);
        }
        
        return newMessages;
      });
      
      scrollToBottom();
      
    } catch (error) {
      console.error('图片处理失败:', error);
      
      // 添加错误消息
      setMessages(prev => {
        // 移除加载消息
        const filteredMessages = prev.filter(msg => 
          !(msg.role === 'assistant' && msg.content === '正在分析您的图片，请稍候...')
        );
        
        // 添加错误消息
        return [...filteredMessages, {
          id: generateId(),
          content: `抱歉，图片分析失败。请尝试使用更清晰的图片，或者直接描述您的问题。`,
          role: 'assistant',
          timestamp: Date.now(),
          contentType: 'text',
          isError: true
        }];
      });
      
      showToast({
        title: '图片分析失败',
        icon: 'error',
        duration: 2000
      });
    } finally {
      setIsProcessingImage(false);
    }
  };
  
  // 发送消息 - 文本消息调用 GPT-3.5-Turbo
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      content: content.trim(),
      role: 'user',
      timestamp: Date.now(),
      contentType: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    scrollToBottom();

    try {
      // 构建对话历史
      const conversationHistory = messages
        .slice(-6) // 减少到6轮对话，节省 token
        .filter(msg => !msg.isError && msg.contentType === 'text') // 过滤错误消息和图片消息
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      // 添加系统提示和当前用户消息
      const chatMessages = [
        aiService.getSystemPrompt(),
        ...conversationHistory,
        { role: 'user' as const, content: content.trim() }
      ];
      
      // 调用 GPT-3.5-Turbo
      const response = await aiService.chat(chatMessages);
      
      if (!response.success) {
        throw new Error(response.error || '获取回复失败');
      }
      
      const assistantMessage: Message = {
        id: generateId(),
        content: response.content,
        role: 'assistant',
        timestamp: Date.now(),
        contentType: 'text'
      };

      setMessages(prev => [...prev, assistantMessage]);
      scrollToBottom();
      setRetryCount(0); // 重置重试次数
    } catch (error: any) {
      console.error('发送消息失败:', error);
      
      const errorMessage: Message = {
        id: generateId(),
        content: getErrorMessage(error),
        role: 'assistant',
        timestamp: Date.now(),
        isError: true,
        contentType: 'text'
      };
      
      setMessages(prev => [...prev, errorMessage]);
      scrollToBottom();
      
      showToast({
        title: '发送失败，请重试',
        icon: 'error',
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, aiService, getErrorMessage, scrollToBottom]);
  
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
              content: '',
              role: 'assistant',
              timestamp: Date.now(),
              isWelcome: true, // 使用欢迎消息格式
              contentType: 'text'
            }
          ]);
          setRetryCount(0);
          showToast({
            title: '对话已清空',
            icon: 'success'
          });
        }
      }
    });
  }, []);

  // 重试发送 - 新增功能
  const retryLastMessage = useCallback(() => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user');
    
    if (lastUserMessage && retryCount < 3) {
      setRetryCount(prev => prev + 1);
      if (lastUserMessage.contentType === 'text') {
        sendMessage(lastUserMessage.content);
      } else if (lastUserMessage.contentType === 'image' && lastUserMessage.imageData) {
        processAndSendImage(lastUserMessage.imageData);
      }
    } else {
      showToast({
        title: '重试次数过多，请稍后再试',
        icon: 'error'
      });
    }
  }, [messages, retryCount, sendMessage]);

  // 格式化时间 - 优化显示
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    // 如果是今天
    if (diff < 24 * 60 * 60 * 1000) {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // 如果是昨天
    if (diff < 48 * 60 * 60 * 1000) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // 更早的日期
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }, []);

  // 输入框快捷操作
  const handleKeyPress = useCallback((e: any) => {
    if (e.detail.value.length > 500) {
      console.log('消息过长，请精简后发送');
      return;
    }
  }, []);

  // 完整的快捷问题配置
  const quickQuestionsData = {
    '充电问题': [
      { id: 1, text: '安心充电如何退款', icon: '💰' },
      { id: 2, text: '电子充电卡如何退款', icon: '💳' },
      { id: 3, text: '如何退公众号余额', icon: '💰' },
      { id: 4, text: '公众号钱包有余额但是无法退款', icon: '⚠️' },
      { id: 5, text: '如何开票', icon: '📄' },
      { id: 6, text: '充电费用怎么计算', icon: '🧮' },
      { id: 7, text: '充电优惠活动有哪些', icon: '🎁' },
      { id: 8, text: '会员充值优惠政策', icon: '👑' }
    ],
    '充电桩问题': [
      { id: 9, text: '充电桩如何使用', icon: '🔌' },
      { id: 10, text: '充电桩故障怎么办', icon: '🛠️' },
      { id: 11, text: '找不到充电桩位置', icon: '📍' },
      { id: 12, text: '充电桩被占用怎么办', icon: '🚗' },
      { id: 13, text: '充电速度很慢是什么原因', icon: '⚡' },
      { id: 14, text: '充电桩预约功能怎么用', icon: '📅' },
      { id: 15, text: '充电桩支持哪些车型', icon: '🚙' },
      { id: 16, text: '夜间充电安全吗', icon: '🌙' }
    ],
    '合作加盟': [
      { id: 17, text: '如何加盟合作', icon: '🤝' },
      { id: 18, text: '加盟费用多少', icon: '💰' },
      { id: 19, text: '加盟条件和要求', icon: '📋' },
      { id: 20, text: '投资回报周期', icon: '📈' },
      { id: 21, text: '运营支持政策', icon: '🎯' },
      { id: 22, text: '设备采购和安装', icon: '🏗️' },
      { id: 23, text: '区域代理政策', icon: '🌍' },
      { id: 24, text: '技术培训服务', icon: '👨‍🏫' }
    ]
  };

  // 当前选中的分类
  const [activeCategory, setActiveCategory] = useState<keyof typeof quickQuestionsData>('充电问题');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // 获取当前分类的问题
  const getCurrentQuestions = useCallback(() => {
    const categoryQuestions = quickQuestionsData[activeCategory] || [];
    const questionsPerPage = 5;
    const startIndex = currentQuestionIndex * questionsPerPage;
    return categoryQuestions.slice(startIndex, startIndex + questionsPerPage);
  }, [activeCategory, currentQuestionIndex]);

  // 处理分类切换
  const handleCategoryChange = useCallback((category: keyof typeof quickQuestionsData) => {
    setActiveCategory(category);
    setCurrentQuestionIndex(0); // 重置到第一页
  }, []);

  // 换一批问题
  const handleRefreshQuestions = useCallback(() => {
    const categoryQuestions = quickQuestionsData[activeCategory] || [];
    const questionsPerPage = 5;
    const maxPages = Math.ceil(categoryQuestions.length / questionsPerPage);
    setCurrentQuestionIndex(prev => (prev + 1) % maxPages);
  }, [activeCategory]);

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    const icons = {
      '充电问题': '🔌',
      '充电桩问题': '⚡',
      '合作加盟': '🤝'
    };
    return icons[category] || '❓';
  };

  // 优化 useEffect
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 页面初始化
  useEffect(() => {
    console.log('AI客服页面已加载');
  }, []);

  // 处理快捷问题点击
  const handleQuickQuestion = useCallback((questionText: string) => {
    sendMessage(questionText);
  }, [sendMessage]);

  // 添加一个安全的电话拨号函数
  const safePhoneCall = (phoneNumber: string) => {
    try {
      // 检查是否在 H5 环境
      if (process.env.TARO_ENV === 'h5') {
        // H5 环境使用 window.location.href
        window.location.href = `tel:${phoneNumber}`;
        return;
      }
      
      // 小程序环境
      if (Taro.makePhoneCall && typeof Taro.makePhoneCall === 'function') {
        Taro.makePhoneCall({
          phoneNumber,
          fail: (err) => {
            console.error('拨号失败:', err);
            showToast({
              title: `拨号失败，请手动拨打${phoneNumber}`,
              icon: 'none',
              duration: 2000
            });
          }
        });
      } else {
        // Taro.makePhoneCall 不可用时的备用方案
        console.warn('Taro.makePhoneCall 不可用');
        showToast({
          title: `请手动拨打客服电话：${phoneNumber}`,
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('拨号功能错误:', error);
      showToast({
        title: `请手动拨打客服电话：${phoneNumber}`,
        icon: 'none',
        duration: 3000
      });
    }
  };

  // 修改录音初始化逻辑
  useEffect(() => {
    let recorderManager;
    
    // 检测环境
    if (process.env.TARO_ENV === 'h5') {
      // H5环境使用Web API实现
      console.log('初始化H5录音环境');
      recorderManager = createH5Recorder();
      recorderManagerRef.current = recorderManager;
    } else if (Taro.getRecorderManager) {
      // 小程序环境
      console.log('初始化小程序录音环境');
      recorderManager = Taro.getRecorderManager();
      recorderManagerRef.current = recorderManager;
    } else {
      console.log('当前环境不支持录音');
      recorderManagerRef.current = null;
      return; // 不支持录音的环境直接返回
    }
    
    // 监听录音开始事件
    recorderManager.onStart(() => {
      console.log('录音开始');
      setIsRecording(true);
      
      // 启动计时器，显示录音时长
      let duration = 0;
      recordingTimerRef.current = setInterval(() => {
        duration += 1;
        setRecordDuration(duration);
        
        // 最长录音时间限制为60秒
        if (duration >= 60) {
          stopRecording();
        }
      }, 1000);
    });
    
    // 监听录音停止事件
    recorderManager.onStop(async (res) => {
      console.log('录音结束', res);
      
      // 清除计时器
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // 获取录音时长
      const duration = recordDuration;
      setIsRecording(false);
      setRecordDuration(0);
      
      // 判断录音是否有效 - 使用文件大小和时长的组合判断
      const isValidRecording = res.fileSize > 5000 || duration >= 1;
      
      if (!isValidRecording) {
        showToast({
          title: '录音时间太短，请重试',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 显示识别中提示
      showToast({
        title: '正在识别语音...',
        icon: 'loading',
        duration: 10000
      });
      
      // 处理录音文件并识别
      try {
        if (process.env.TARO_ENV === 'h5') {
          // H5环境，直接使用base64数据
          if (res.base64) {
            await processVoiceToTextH5(res.base64);
          } else {
            throw new Error('未获取到录音数据');
          }
        } else {
          // 小程序环境，使用tempFilePath
          await processVoiceToText(res.tempFilePath);
        }
      } catch (error) {
        console.error('语音识别失败:', error);
        hideToast();
        
        showToast({
          title: '语音识别失败，请重试',
          icon: 'error',
          duration: 2000
        });
      }
    });
    
    // 监听录音错误事件
    recorderManager.onError((error) => {
      console.error('录音错误:', error);
      setIsRecording(false);
      setRecordDuration(0);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      showToast({
        title: '录音失败，请重试',
        icon: 'error',
        duration: 2000
      });
    });
    
    // 组件卸载时清理
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // 处理录音按钮点击
  const handleVoiceButtonClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 开始录音 - 区分环境
  const startRecording = () => {
    if (!recorderManagerRef.current) {
      showToast({
        title: '您的设备不支持录音功能',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // H5环境下直接开始录音
    if (process.env.TARO_ENV === 'h5') {
      try {
        recorderManagerRef.current.start({
          duration: 60000, // 最长录音时间，单位ms
          sampleRate: 16000, // 采样率
          numberOfChannels: 1, // 录音通道数
          encodeBitRate: 48000, // 编码码率
          format: 'mp3' // 音频格式
        });
      } catch (error) {
        console.error('H5环境录音失败:', error);
        showToast({
          title: '启动录音失败，请检查浏览器权限',
          icon: 'none',
          duration: 2000
        });
      }
      return;
    }
    
    // 小程序环境请求录音权限
    Taro.authorize({
      scope: 'scope.record',
      success: () => {
        // 开始录音
        recorderManagerRef.current.start({
          duration: 60000, // 最长录音时间，单位ms
          sampleRate: 16000, // 采样率
          numberOfChannels: 1, // 录音通道数
          encodeBitRate: 48000, // 编码码率
          format: 'mp3', // 音频格式
          frameSize: 50 // 指定帧大小
        });
      },
      fail: () => {
        showToast({
          title: '需要录音权限',
          icon: 'none',
          duration: 2000
        });
      }
    });
  };

  // 停止录音
  const stopRecording = () => {
    if (recorderManagerRef.current && isRecording) {
      recorderManagerRef.current.stop();
    }
  };

  // 处理语音转文字
  const processVoiceToText = async (filePath: string) => {
    try {
      // 设置识别状态
      setRecognitionStatus('正在识别语音...');
      
      // 1. 读取录音文件为 base64 格式
      const fileData = await Taro.getFileSystemManager().readFileSync(filePath, 'base64');
      
      // 2. 上传到 AssemblyAI 进行识别
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'a76ace010da546c88458d3ae26801fed',
          'Content-Type': 'application/json'
        },
        body: fileData
      });
      
      if (!response.ok) {
        throw new Error('文件上传失败');
      }
      
      // 获取上传后的文件URL
      const uploadData = await response.json();
      const audioUrl = uploadData.upload_url;
      
      // 3. 发起转录请求
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'Authorization': 'a76ace010da546c88458d3ae26801fed',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_code: 'zh', // 中文识别
        })
      });
      
      if (!transcriptResponse.ok) {
        throw new Error('转录请求失败');
      }
      
      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;
      
      // 4. 轮询获取转录结果
      let transcriptResult = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        
        const resultResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          method: 'GET',
          headers: {
            'Authorization': 'a76ace010da546c88458d3ae26801fed',
          }
        });
        
        if (!resultResponse.ok) {
          throw new Error('获取转录结果失败');
        }
        
        const resultData = await resultResponse.json();
        
        if (resultData.status === 'completed') {
          transcriptResult = resultData.text;
          break;
        } else if (resultData.status === 'error') {
          throw new Error(resultData.error || '转录失败');
        }
        
        // 如果还在处理中，继续等待
      }
      
      // 隐藏转录中的提示
      hideToast();
      
      if (!transcriptResult) {
        throw new Error('转录超时');
      }
      
      // 将识别结果填入输入框
      setInputValue(transcriptResult);
      
      // 清除识别状态
      setRecognitionStatus('');
      
      // 显示成功提示
      showToast({
        title: '语音识别成功',
        icon: 'success',
        duration: 1500
      });
      
    } catch (error) {
      console.error('语音转文字处理失败:', error);
      hideToast();
      
      // 清除识别状态
      setRecognitionStatus('');
      
      showToast({
        title: '语音识别失败',
        icon: 'error',
        duration: 2000
      });
    }
  };

  // 替换 processVoiceToTextH5 函数
  const processVoiceToTextH5 = async (base64Data) => {
    try {
      console.log('H5环境处理语音识别，数据长度:', base64Data.length);
      // 设置识别状态
      setRecognitionStatus('正在识别语音...');
      
      // 创建音频数据的 Blob 对象
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
      
      // 创建表单数据
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.mp3');
      
      // 设置超时和重试机制
      const fetchWithTimeout = async (url, options, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          throw error;
        }
      };
      
      // 尝试上传音频文件
      let uploadResponse;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          console.log(`尝试上传音频文件 (尝试 ${retries + 1}/${maxRetries + 1})...`);
          uploadResponse = await fetchWithTimeout(
            'https://api.assemblyai.com/v2/upload',
            {
              method: 'POST',
              headers: {
                'Authorization': 'a76ace010da546c88458d3ae26801fed'
              },
              body: audioBlob
            },
            15000
          );
          
          if (uploadResponse.ok) {
            break;
          }
          
          retries++;
          if (retries <= maxRetries) {
            // 等待一段时间再重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        } catch (error) {
          console.error(`上传尝试 ${retries + 1} 失败:`, error);
          retries++;
          
          if (retries > maxRetries) {
            throw new Error('音频上传失败，请检查网络连接');
          }
          
          // 等待一段时间再重试
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      if (!uploadResponse || !uploadResponse.ok) {
        throw new Error('上传服务不可用，请稍后重试');
      }
      
      // 获取上传后的文件URL
      const uploadData = await uploadResponse.json();
      const audioUrl = uploadData.upload_url;
      console.log('音频上传成功，URL:', audioUrl);
      
      // 发起转录请求
      const transcriptResponse = await fetchWithTimeout(
        'https://api.assemblyai.com/v2/transcript',
        {
          method: 'POST',
          headers: {
            'Authorization': 'a76ace010da546c88458d3ae26801fed',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            language_code: 'zh', // 中文识别
          })
        },
        15000
      );
      
      if (!transcriptResponse.ok) {
        throw new Error('转录请求失败');
      }
      
      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;
      console.log('转录请求已提交，ID:', transcriptId);
      
      // 轮询获取转录结果
      let transcriptResult = null;
      let attempts = 0;
      const maxAttempts = 20; // 增加到20次
      
      // 智能等待策略
      const waitTimes = [1000, 1000, 1500, 1500, 2000, 2000, 2500, 2500]; // 不同阶段的等待时间
      const getWaitTime = (attempt) => {
        if (attempt < waitTimes.length) {
          return waitTimes[attempt];
        }
        return 3000; // 后期固定等待3秒
      };
      
      // 在 processVoiceToTextH5 函数的轮询部分添加更多反馈
      while (attempts < maxAttempts) {
        attempts++;
        const waitTime = getWaitTime(attempts - 1);
        // 更新识别状态
        setRecognitionStatus(`识别中 (${attempts}/${maxAttempts})...`);
        console.log(`检查转录结果 (${attempts}/${maxAttempts})...等待${waitTime/1000}秒`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
          const resultResponse = await fetchWithTimeout(
            `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': 'a76ace010da546c88458d3ae26801fed',
              }
            },
            10000
          );
          
          if (!resultResponse.ok) {
            console.warn(`获取转录结果失败 (尝试 ${attempts})`);
            continue;
          }
          
          const resultData = await resultResponse.json();
          console.log('转录状态:', resultData.status);
          
          if (resultData.status === 'completed') {
            transcriptResult = resultData.text;
            console.log('转录完成:', transcriptResult);
            break;
          } else if (resultData.status === 'error') {
            throw new Error(resultData.error || '转录失败');
          } else if (resultData.status === 'queued' || resultData.status === 'processing') {
            // 更新加载提示，让用户知道还在处理中
            if (attempts % 4 === 0) { // 每4次更新一次提示
              hideToast();
              showToast({
                title: `语音识别中(${attempts}/${maxAttempts})...`,
                icon: 'loading',
                duration: 10000
              });
            }
          }
        } catch (error) {
          console.warn(`获取转录结果请求错误 (尝试 ${attempts}):`, error);
          // 继续尝试，不中断循环
        }
      }
      
      // 隐藏转录中的提示
      hideToast();
      
      if (!transcriptResult) {
        // 增加备用方案，当识别超时时，提示用户手动输入
        setInputValue(''); // 清空输入框
        showToast({
          title: '语音识别超时，请手动输入',
          icon: 'none',
          duration: 2000
        });
        throw new Error('转录超时，请尝试手动输入您的问题');
      }
      
      // 将识别结果填入输入框
      setInputValue(transcriptResult);
      
      // 清除识别状态
      setRecognitionStatus('');
      
      // 显示成功提示
      showToast({
        title: '语音识别成功',
        icon: 'success',
        duration: 1500
      });
      
    } catch (error) {
      console.error('H5语音转文字处理失败:', error);
      hideToast();
      
      // 错误时也要重置状态
      setRecognitionStatus(''); // 确保清除识别状态
    
      showToast({
        title: '语音识别失败，请重试',
        icon: 'error',
        duration: 2000
      });
    
      throw error;
    }
  };

  // 在组件外部添加此函数，用于创建H5环境下的录音管理器
  const createH5Recorder = () => {
    let mediaRecorder = null;
    let audioChunks = [];
    let audioStream = null;
    
    // 模拟小程序的RecorderManager接口
    const h5RecorderManager = {
      // 事件回调
      onStartCallback: null,
      onStopCallback: null,
      onErrorCallback: null,
      
      // 事件监听方法
      onStart(callback) {
        this.onStartCallback = callback;
      },
      onStop(callback) {
        this.onStopCallback = callback;
      },
      onError(callback) {
        this.onErrorCallback = callback;
      },
      
      // 开始录音
      async start(options) {
        try {
          audioChunks = [];
          
          // 获取麦克风权限
          audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              sampleRate: options?.sampleRate || 44100,
              channelCount: options?.numberOfChannels || 1
            } 
          });
          
          // 创建MediaRecorder实例
          mediaRecorder = new MediaRecorder(audioStream);
          
          // 收集音频数据
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          };
          
          // 录音结束处理
          mediaRecorder.onstop = async () => {
            // 停止所有轨道
            if (audioStream) {
              audioStream.getTracks().forEach(track => track.stop());
            }
            
            if (this.onStopCallback && audioChunks.length > 0) {
              // 创建音频Blob
              const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
              
              // 将Blob转为Base64以便与小程序API兼容
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                const base64data = reader.result;
                
                // 调用onStop回调，传递兼容小程序的参数
                this.onStopCallback({
                  tempFilePath: URL.createObjectURL(audioBlob), // 临时URL
                  fileSize: audioBlob.size,
                  base64: base64data.split('base64,')[1] // 提取base64部分
                });
              };
            }
          };
          
          // 处理错误
          mediaRecorder.onerror = (event) => {
            if (this.onErrorCallback) {
              this.onErrorCallback({ errMsg: '录音失败: ' + event });
            }
          };
          
          // 开始录音
          mediaRecorder.start(1000); // 每秒收集一次数据
          
          // 确保开始回调被触发
          setTimeout(() => {
            if (this.onStartCallback) {
              this.onStartCallback();
            }
          }, 100); // 短暂延迟确保UI状态更新
          
          // 设置最大录音时间
          if (options?.duration) {
            setTimeout(() => {
              if (mediaRecorder && mediaRecorder.state === 'recording') {
                this.stop();
              }
            }, options.duration);
          }
        } catch (error) {
          console.error('获取麦克风权限失败:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback({ errMsg: '获取麦克风权限失败: ' + error.message });
          }
        }
      },
      
      // 停止录音
      stop() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }
    };
    
    return h5RecorderManager;
  };

  // 添加紧急重置函数
  const resetRecognitionState = () => {
    setRecognitionStatus('');
    hideToast();
  };

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
                {message.isWelcome ? (
                  // 欢迎消息特殊处理
                  <View className='welcome-container'>
                    <View className='welcome-header'>
                      <View className='welcome-info'>
                        <Text className='welcome-title'>您好，我是小电</Text>
                      </View>
                    </View>
                    
                    <View className='service-intro'>
                      <Text className='intro-text'>我可以为您解答以下问题：</Text>
                    </View>
                    
                    {/* 问题分类标签 */}
                    <View className='category-tabs'>
                      {(Object.keys(quickQuestionsData) as Array<keyof typeof quickQuestionsData>).map((category) => (
                        <View 
                          key={category}
                          className={`category-tab ${activeCategory === category ? 'active' : ''}`}
                          onClick={() => handleCategoryChange(category)}
                        >
                          <Text className='category-icon'>{getCategoryIcon(category)}</Text>
                          <Text className='category-text'>{category}</Text>
                        </View>
                      ))}
                    </View>
                    
                    {/* 快捷问题列表 */}
                    <View className='quick-questions'>
                      <View className='questions-header'>
                        <Text className='questions-title'>常见问题</Text>
                        <Text className='questions-count'>
                          {getCurrentQuestions().length} / {quickQuestionsData[activeCategory]?.length || 0}
                        </Text>
                      </View>
                      
                      <View className='questions-list'>
                        {getCurrentQuestions().map((question, index) => (
                          <View 
                            key={question.id} 
                            className='question-item'
                            onClick={() => handleQuickQuestion(question.text)}
                            style={{ animationDelay: `${index * 0.1}s` }}
                          >
                            <View className='question-content'>
                              <Text className='question-icon'>{question.icon}</Text>
                              <Text className='question-text'>{question.text}</Text>
                            </View>
                            <View className='question-action'>
                              <Text className='question-arrow'>→</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                    
                    {/* 换一批和帮助 */}
                    <View className='welcome-footer'>
                      {quickQuestionsData[activeCategory]?.length > 5 && (
                        <View className='refresh-button' onClick={handleRefreshQuestions}>
                          <Text className='refresh-icon refresh-emoji'>⟲</Text>
                          <Text className='refresh-text'>换一批</Text>
                        </View>
                      )}
                      <View className='help-hint'>
                        <Text className='hint-text'>💡 直接输入问题获得更精准回答</Text>
                      </View>
                    </View>
                  </View>
                ) : message.contentType === 'image' ? (
                  // 图片消息
                  <View className='image-message'>
                    <Image 
                      src={message.imageData || ''} 
                      mode='widthFix' 
                      className='chat-image'
                      onClick={() => {
                        Taro.previewImage({
                          urls: [message.imageData || ''],
                          current: message.imageData
                        });
                      }}
                    />
                  </View>
                ) : (
                  // 普通文本消息
                  <Text className='message-text' selectable>{message.content}</Text>
                )}
                
                {!message.isWelcome && (
                  <View className='message-footer'>
                    <Text className='message-time'>{formatTime(message.timestamp)}</Text>
                    {message.isError && (
                      <View className='retry-button' onClick={retryLastMessage}>
                        <Text className='retry-text'>重试</Text>
                      </View>
                    )}
                  </View>
                )}
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
          <Button 
            className={`voice-button ${isRecording ? 'recording' : ''} ${recognitionStatus ? 'recognizing' : ''}`}
            onClick={handleVoiceButtonClick}
            disabled={isLoading || isProcessingImage || isRecording}
          >
            <Text className={`icon-voice ${isRecording ? 'recording' : ''} ${recognitionStatus ? 'processing' : ''}`}>
              {isRecording ? '🎙️' : recognitionStatus ? '🔄' : '🎤'}
            </Text>
          </Button>
          <Input
            ref={inputRef}
            className={`message-input ${recognitionStatus ? 'recognizing' : ''}`}
            placeholder={recognitionStatus ? '正在识别语音...' : '请输入您的问题...'}
            value={inputValue}
            onInput={(e) => setInputValue(e.detail.value)}
            onConfirm={() => sendMessage(inputValue)}
            disabled={isLoading || isProcessingImage || isRecording} // 移除 recognitionStatus 作为禁用条件
            confirmType='send'
          />
          <View className='action-buttons'>
            <Button 
              className='camera-button'
              onClick={handleCameraClick}
              disabled={isLoading || isProcessingImage || isRecording}
            >
              <Text className='icon-camera'>📷</Text>
            </Button>
            <Button 
              className={`send-button ${inputValue.trim() && !isLoading ? 'active' : ''}`}
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading || isProcessingImage || isRecording}
            >
              <Text className='send-text'>发送</Text>
            </Button>
          </View>
        </View>

        <View className='bottom-info'>
          <View className='service-info'>
            <View className='action-links'>
              <Text 
                className='clear-button'
                onClick={clearMessages}
              >
                🗑️ 清空
              </Text>
              <Text className='separator'>|</Text>
              <Text className='disclaimer-text'>
                喵喵，欢迎使用小电Ai客服
              </Text>
            </View>
            <Button 
              className='help-button' 
              onClick={() => {
                showModal({
                  title: '联系客服',
                  content: '人工客服热线：19503102993\n服务时间：8:00-22:00',
                  showCancel: true,
                  confirmText: '立即拨打',
                  success: (res) => {
                    if (res.confirm) {
                      // 使用安全的电话拨号函数
                      safePhoneCall('19503102993');
                    }
                  }
                });
              }}
            >
              📞 人工客服
            </Button>
          </View>
        </View>
      </View>

      {/* 录音状态指示器 */}
      {isRecording && (
        <View className='recording-indicator'>
          <View className='recording-icon'>🎙️</View>
          <View className='recording-status'>
            <Text className='recording-text'>正在录音...</Text>
            <Text className='recording-duration'>{recordDuration}s</Text>
          </View>
          <View className='recording-tip'>
            <Text>点击按钮结束录音</Text>
          </View>
        </View>
      )}

      {/* 识别状态指示器 */}
      {!isRecording && recognitionStatus && (
        <View className='recording-indicator'>
          <View className='recording-icon'>🔄</View>
          <View className='recording-status'>
            <Text className='recording-text'>{recognitionStatus}</Text>
          </View>
          <View className='recording-tip'>
            <Text>语音识别可能需要一些时间，请耐心等待</Text>
          </View>
        </View>
      )}

      {/* 点击重置区域 - 紧急重置功能 */}
      <View 
        className="reset-area" 
        onClick={resetRecognitionState}
        style={{ 
          display: recognitionStatus ? 'block' : 'none',
          position: 'absolute', 
          top: '0', 
          right: '0',
          padding: '5px', 
          zIndex: 1000 
        }}
      >
        <Text style={{ fontSize: '12px', color: '#999' }}>点击重置</Text>
      </View>

      {/* 图片选择弹出框 - 仅在H5环境显示 */}
      {showImageActionSheet && process.env.TARO_ENV === 'h5' && (
        <>
          <View 
            className='action-sheet-mask'
            onClick={() => setShowImageActionSheet(false)}
          />
          
          <View className='action-sheet-container'>
            {/* 顶部指示条 */}
            <View className='action-sheet-indicator'>
              <View className='indicator-bar'></View>
            </View>
            
            <View className='action-sheet-header'>
              <Text className='action-sheet-title'>选择图片来源</Text>
              <Text className='action-sheet-subtitle'>请选择获取图片的方式</Text>
            </View>
            
            <View className='action-sheet-content'>
              <View 
                className='action-sheet-item camera-item'
                onClick={handleTakePhoto}
              >
                <View className='action-item-icon camera-icon'>
                  <Text className='icon-text'>📷</Text>
                </View>
                <View className='action-item-content'>
                  <Text className='action-item-title'>拍照</Text>
                  <Text className='action-item-desc'>使用摄像头拍摄新照片</Text>
                </View>
                <View className='action-item-indicator'>
                  <Text className='arrow-icon'>›</Text>
                </View>
              </View>
              
              <View 
                className='action-sheet-item album-item'
                onClick={handleChooseFromAlbum}
              >
                <View className='action-item-icon album-icon'>
                  <Text className='icon-text'>🖼️</Text>
                </View>
                <View className='action-item-content'>
                  <Text className='action-item-title'>相册</Text>
                  <Text className='action-item-desc'>从手机相册选择图片</Text>
                </View>
                <View className='action-item-indicator'>
                  <Text className='arrow-icon'>›</Text>
                </View>
              </View>
            </View>
            
            <View className='action-sheet-footer'>
              <View 
                className='action-sheet-cancel'
                onClick={() => setShowImageActionSheet(false)}
              >
                <Text className='cancel-text'>取消</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

export default AiServer;
