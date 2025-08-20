import { View, Text, Textarea, Button, Picker, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { TaroSafe } from '../../utils/taroSafe'
import { TaroHelper } from '../../utils/taroHelpers'
// import { showToast } from '../../utils/toast'
import { STORAGE_KEYS } from '../../utils/constants'
import './index.scss'
import { TIME_CONSTANTS } from '../../utils/constants'

interface FeedbackForm {
  type: string
  title: string
  description: string
  contact: string
  images: string[]
  priority: 'low' | 'medium' | 'high'
}

interface TicketItem {
  id: string
  title: string
  type: string
  status: 'pending' | 'processing' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  updatedAt: string
  description: string
  response?: string
}

const FeedbackCenter = () => {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit')
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    type: 'bug',
    title: '',
    description: '',
    contact: '',
    images: [],
    priority: 'medium'
  })
  const [ticketHistory, setTicketHistory] = useState<TicketItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const feedbackTypes = [
    { value: 'bug', label: '功能异常' },
    { value: 'suggestion', label: '功能建议' },
    { value: 'charging', label: '充电问题' },
    { value: 'payment', label: '支付问题' },
    { value: 'account', label: '账户问题' },
    { value: 'other', label: '其他问题' }
  ]

  const priorityOptions = [
    { value: 'low', label: '一般', color: '#52c41a' },
    { value: 'medium', label: '重要', color: '#faad14' },
    { value: 'high', label: '紧急', color: '#ff4d4f' }
  ]

  const statusLabels = {
    pending: { label: '待处理', color: '#faad14' },
    processing: { label: '处理中', color: '#1890ff' },
    resolved: { label: '已解决', color: '#52c41a' },
    closed: { label: '已关闭', color: '#999' }
  }

  useEffect(() => {
    loadTicketHistory()
    // 自动填充联系方式
    loadUserContact()
  }, [])

  const loadUserContact = async () => {
    try {
      const userInfo = TaroSafe.getStorageSync(STORAGE_KEYS.USER_INFO)
      if (userInfo && userInfo.phone) {
        setFeedbackForm(prev => ({
          ...prev,
          contact: userInfo.phone
        }))
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
    }
  }

  const loadTicketHistory = async () => {
    try {
      setIsLoading(true)
      // 模拟数据，实际应该调用API
      const mockTickets: TicketItem[] = [
        {
          id: 'T001',
          title: '充电桩无法启动',
          type: 'charging',
          status: 'resolved',
          priority: 'high',
          createdAt: '2024-01-15 14:30',
          updatedAt: '2024-01-16 09:15',
          description: '在XX充电站的3号桩，扫码后无法启动充电，显示"设备故障"',
          response: '您好，该充电桩已修复，感谢您的反馈。如有其他问题请随时联系我们。'
        },
        {
          id: 'T002',
          title: '支付失败但扣款了',
          type: 'payment',
          status: 'processing',
          priority: 'medium',
          createdAt: '2024-01-18 16:45',
          updatedAt: '2024-01-18 17:20',
          description: '充电完成后支付显示失败，但银行卡被扣款了，订单号：CH20240118001',
          response: '我们正在核实您的支付情况，预计24小时内给您回复。'
        }
      ]
      setTicketHistory(mockTickets)
    } catch (error) {
      console.error('加载工单历史失败:', error)
      TaroHelper.showToast({ title: '加载失败，请重试', icon: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = () => {
    if (feedbackForm.images.length >= 3) {
      TaroHelper.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }

    TaroHelper.chooseImage({
      count: 3 - feedbackForm.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setFeedbackForm(prev => ({
          ...prev,
          images: [...prev.images, ...res.tempFilePaths]
        }))
      },
      fail: (error) => {
        console.error('选择图片失败:', error)
        TaroHelper.showToast({ title: '选择图片失败', icon: 'error' })
      }
    })
  }

  const removeImage = (index: number) => {
    setFeedbackForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const validateForm = (): boolean => {
    if (!feedbackForm.title.trim()) {
      TaroHelper.showToast({ title: '请输入问题标题', icon: 'none' })
      return false
    }

    if (!feedbackForm.description.trim()) {
      TaroHelper.showToast({ title: '请描述具体问题', icon: 'none' })
      return false
    }

    if (!feedbackForm.contact.trim()) {
      TaroHelper.showToast({ title: '请提供联系方式', icon: 'none' })
      return false
    }

    return true
  }

  const submitFeedback = async () => {
    if (!validateForm()) return

    try {
      setIsSubmitting(true)

      // 模拟提交API调用
      await new Promise(resolve => setTimeout(resolve, TIME_CONSTANTS.TWO_SECONDS))

      // 实际应该调用后端API
      // const response = await request({
      //   url: '/feedback/submit',
      //   method: 'POST',
      //   data: feedbackForm
      // })

      TaroHelper.showToast({ title: '提交成功', icon: 'success' })

      // 重置表单
      setFeedbackForm({
        type: 'bug',
        title: '',
        description: '',
        contact: feedbackForm.contact, // 保留联系方式
        images: [],
        priority: 'medium'
      })

      // 刷新工单历史
      loadTicketHistory()

    } catch (error) {
      console.error('提交反馈失败:', error)
      TaroHelper.showToast({ title: '提交失败，请重试', icon: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderSubmitTab = () => (
    <View className='submit-container'>
      <View className='form-section'>
        <Text className='section-title'>问题类型</Text>
        <Picker
          mode='selector'
          range={feedbackTypes.map(t => t.label)}
          value={feedbackTypes.findIndex(t => t.value === feedbackForm.type)}
          onChange={(e) => {
            const index = e.detail.value as number
            setFeedbackForm(prev => ({
              ...prev,
              type: feedbackTypes[index].value
            }))
          }}
        >
          <View className='picker-item'>
            <Text className='picker-text'>
              {feedbackTypes.find(t => t.value === feedbackForm.type)?.label}
            </Text>
            <Text className='picker-arrow'>▼</Text>
          </View>
        </Picker>
      </View>

      <View className='form-section'>
        <Text className='section-title'>优先级</Text>
        <View className='priority-options'>
          {priorityOptions.map(option => (
            <View
              key={option.value}
              className={`priority-item ${feedbackForm.priority === option.value ? 'active' : ''}`}
              style={{ borderColor: option.color }}
              onClick={() => setFeedbackForm(prev => ({ ...prev, priority: option.value as any }))}
            >
              <View
                className='priority-dot'
                style={{ backgroundColor: option.color }}
              />
              <Text className='priority-label'>{option.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='form-section'>
        <Text className='section-title'>问题标题</Text>
        <input
          className='title-input'
          placeholder='请简要描述您遇到的问题'
          value={feedbackForm.title}
          onChange={(e) => setFeedbackForm(prev => ({ ...prev, title: e.target.value }))}
          maxLength={50}
        />
        <Text className='char-count'>{feedbackForm.title.length}/50</Text>
      </View>

      <View className='form-section'>
        <Text className='section-title'>详细描述</Text>
        <Textarea
          className='description-input'
          placeholder='请详细描述问题的具体情况，包括：&#10;1. 问题发生的时间和地点&#10;2. 具体的操作步骤&#10;3. 期望的结果和实际结果&#10;4. 其他相关信息'
          value={feedbackForm.description}
          onInput={(e) => setFeedbackForm(prev => ({ ...prev, description: e.detail.value }))}
          maxlength={500}
          showConfirmBar={false}
        />
        <Text className='char-count'>{feedbackForm.description.length}/500</Text>
      </View>

      <View className='form-section'>
        <Text className='section-title'>上传图片（可选）</Text>
        <View className='image-upload-area'>
          {feedbackForm.images.map((image, index) => (
            <View key={index} className='image-item'>
              <Image src={image} className='uploaded-image' mode='aspectFill' />
              <View className='remove-btn' onClick={() => removeImage(index)}>
                ✕
              </View>
            </View>
          ))}
          {feedbackForm.images.length < 3 && (
            <View className='upload-btn' onClick={handleImageUpload}>
              <Text className='upload-icon'>📷</Text>
              <Text className='upload-text'>添加图片</Text>
            </View>
          )}
        </View>
        <Text className='upload-tip'>最多上传3张图片，支持JPG、PNG格式</Text>
      </View>

      <View className='form-section'>
        <Text className='section-title'>联系方式</Text>
        <input
          className='contact-input'
          placeholder='请提供手机号或邮箱，方便我们联系您'
          value={feedbackForm.contact}
          onChange={(e) => setFeedbackForm(prev => ({ ...prev, contact: e.target.value }))}
        />
      </View>

      <Button
        className='submit-btn'
        onClick={submitFeedback}
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {isSubmitting ? '提交中...' : '提交反馈'}
      </Button>

      <View className='submit-tips'>
        <Text className='tips-title'>💡 提交提示</Text>
        <Text className='tips-text'>• 我们会在24小时内回复您的问题</Text>
        <Text className='tips-text'>• 紧急问题请直接拨打客服电话</Text>
        <Text className='tips-text'>• 提供详细信息有助于快速解决问题</Text>
      </View>
    </View>
  )

  const renderHistoryTab = () => (
    <View className='history-container'>
      {isLoading ? (
        <View className='loading-state'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      ) : ticketHistory.length > 0 ? (
        <View className='ticket-list'>
          {ticketHistory.map(ticket => (
            <View key={ticket.id} className='ticket-item'>
              <View className='ticket-header'>
                <View className='ticket-info'>
                  <Text className='ticket-id'>#{ticket.id}</Text>
                  <View
                    className='ticket-status'
                    style={{ backgroundColor: statusLabels[ticket.status].color }}
                  >
                    <Text className='status-text'>{statusLabels[ticket.status].label}</Text>
                  </View>
                </View>
                <View
                  className='ticket-priority'
                  style={{ color: priorityOptions.find(p => p.value === ticket.priority)?.color }}
                >
                  {priorityOptions.find(p => p.value === ticket.priority)?.label}
                </View>
              </View>

              <Text className='ticket-title'>{ticket.title}</Text>
              <Text className='ticket-type'>
                {feedbackTypes.find(t => t.value === ticket.type)?.label}
              </Text>

              <View className='ticket-description'>
                <Text className='description-text'>{ticket.description}</Text>
              </View>

              {ticket.response && (
                <View className='ticket-response'>
                  <Text className='response-label'>客服回复：</Text>
                  <Text className='response-text'>{ticket.response}</Text>
                </View>
              )}

              <View className='ticket-footer'>
                <Text className='ticket-time'>创建时间：{ticket.createdAt}</Text>
                <Text className='ticket-time'>更新时间：{ticket.updatedAt}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className='empty-state'>
          <Text className='empty-icon'>📝</Text>
          <Text className='empty-text'>暂无反馈记录</Text>
          <Text className='empty-tip'>遇到问题可以随时提交反馈</Text>
        </View>
      )}
    </View>
  )

  return (
    <View className='feedback-center'>
      {/* 头部导航 */}
      <View className='feedback-header'>
        <Text className='feedback-title'>意见反馈</Text>
        <Text className='feedback-subtitle'>您的反馈是我们改进的动力</Text>
      </View>

      {/* 标签页导航 */}
      <View className='tab-navigation'>
        <View
          className={`tab-item ${activeTab === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveTab('submit')}
        >
          <Text className='tab-icon'>✍️</Text>
          <Text className='tab-text'>提交反馈</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Text className='tab-icon'>📋</Text>
          <Text className='tab-text'>我的工单</Text>
        </View>
      </View>

      {/* 内容区域 */}
      <View className='content-area'>
        {activeTab === 'submit' && renderSubmitTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </View>
    </View>
  )
}

export default FeedbackCenter