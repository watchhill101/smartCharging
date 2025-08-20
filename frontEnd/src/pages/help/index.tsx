import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
import { TIME_CONSTANTS } from '../../utils/constants'
import { TaroHelper } from '../../utils/taroHelpers'
// import { showToast } from '../../utils/toast'

interface FAQItem {
  id: number
  question: string
  answer: string
  category: string
  isExpanded?: boolean
}

interface ContactInfo {
  phone: string
  email: string
  workingHours: string
  onlineChat: boolean
}

const HelpCenter = () => {
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'feedback'>('faq')
  const [faqList, setFaqList] = useState<FAQItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  const contactInfo: ContactInfo = {
    phone: '400-123-4567',
    email: 'support@smartcharging.com',
    workingHours: '8:00-22:00',
    onlineChat: true
  }

  const faqCategories = [
    { id: 'all', name: '全部', icon: '📋' },
    { id: 'charging', name: '充电问题', icon: '🔌' },
    { id: 'payment', name: '支付问题', icon: '💰' },
    { id: 'account', name: '账户问题', icon: '👤' },
    { id: 'technical', name: '技术问题', icon: '🔧' },
    { id: 'other', name: '其他问题', icon: '❓' }
  ]

  const mockFAQData: FAQItem[] = [
    {
      id: 1,
      question: '如何开始充电？',
      answer: '1. 打开智能充电APP\n2. 扫描充电桩上的二维码\n3. 选择充电方式和时长\n4. 确认支付后开始充电\n5. 充电完成后会自动停止并结算费用',
      category: 'charging'
    },
    {
      id: 2,
      question: '充电费用如何计算？',
      answer: '充电费用 = 电费 + 服务费\n• 电费：按实际充电电量计算\n• 服务费：根据充电桩运营商设定\n• 会员用户享受优惠价格\n• 具体费用在充电前会显示预估金额',
      category: 'charging'
    },
    {
      id: 3,
      question: '支持哪些支付方式？',
      answer: '目前支持以下支付方式：\n• 账户余额支付\n• 支付宝支付\n• 微信支付（即将上线）\n• 银行卡支付（即将上线）\n建议优先使用账户余额，享受更多优惠',
      category: 'payment'
    },
    {
      id: 4,
      question: '如何充值账户余额？',
      answer: '充值方式：\n1. 进入"我的"页面\n2. 点击"钱包"或余额区域\n3. 选择充值金额\n4. 选择支付方式完成充值\n\n充值优惠：\n• 首次充值享受95折\n• 充值满100元送10元\n• 会员用户额外享受充值优惠',
      category: 'payment'
    },
    {
      id: 5,
      question: '忘记密码怎么办？',
      answer: '重置密码步骤：\n1. 在登录页面点击"忘记密码"\n2. 输入注册手机号\n3. 获取短信验证码\n4. 设置新密码\n5. 完成密码重置\n\n注意：新密码需包含字母和数字，长度6-20位',
      category: 'account'
    },
    {
      id: 6,
      question: '充电桩显示故障怎么办？',
      answer: '遇到充电桩故障：\n1. 立即停止充电操作\n2. 拍照记录故障信息\n3. 通过APP反馈问题\n4. 联系客服热线：400-123-4567\n5. 选择附近其他可用充电桩\n\n我们会在24小时内处理故障报告',
      category: 'technical'
    },
    {
      id: 7,
      question: '如何申请退款？',
      answer: '退款申请流程：\n1. 进入"我的订单"页面\n2. 找到需要退款的订单\n3. 点击"申请退款"\n4. 填写退款原因\n5. 提交申请等待审核\n\n退款时效：\n• 审核通过后1-3个工作日到账\n• 退款金额原路返回',
      category: 'payment'
    },
    {
      id: 8,
      question: '如何开具发票？',
      answer: '开票流程：\n1. 进入"我的"页面\n2. 点击"发票管理"\n3. 选择需要开票的订单\n4. 填写发票信息\n5. 提交开票申请\n\n发票类型：\n• 个人发票：提供姓名和手机号\n• 企业发票：提供完整企业信息\n• 电子发票会发送到邮箱',
      category: 'other'
    }
  ]

  useEffect(() => {
    setFaqList(mockFAQData)
  }, [])

  const filteredFAQs = faqList.filter(item => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchKeyword = searchKeyword === '' || 
      item.question.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchKeyword.toLowerCase())
    return matchCategory && matchKeyword
  })

  const toggleFAQ = (id: number) => {
    setFaqList(prev => prev.map(item => 
      item.id === id ? { ...item, isExpanded: !item.isExpanded } : item
    ))
  }

  const handlePhoneCall = () => {
    try {
      TaroHelper.makePhoneCall(contactInfo.phone)
    } catch (error) {
      TaroHelper.showToast({
        title: `客服电话：${contactInfo.phone}`,
        icon: 'none',
        duration: TIME_CONSTANTS.THREE_SECONDS
      })
    }
  }

  const handleOnlineChat = () => {
    Taro.navigateTo({
      url: '/pages/aiserver/index'
    })
  }

  const handleFeedback = () => {
    Taro.navigateTo({
      url: '/pages/feedback/index'
    })
  }

  const renderFAQTab = () => (
    <View className='faq-container'>
      {/* 搜索框 */}
      <View className='search-section'>
        <View className='search-box'>
          <Text className='search-icon'>🔍</Text>
          <input
            className='search-input'
            placeholder='搜索问题关键词...'
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </View>
      </View>

      {/* 分类标签 */}
      <View className='category-section'>
        <ScrollView scrollX className='category-scroll'>
          <View className='category-list'>
            {faqCategories.map(category => (
              <View
                key={category.id}
                className={`category-item ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <Text className='category-icon'>{category.icon}</Text>
                <Text className='category-name'>{category.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* FAQ列表 */}
      <View className='faq-list'>
        {filteredFAQs.length > 0 ? (
          filteredFAQs.map(item => (
            <View key={item.id} className='faq-item'>
              <View className='faq-question' onClick={() => toggleFAQ(item.id)}>
                <Text className='question-text'>{item.question}</Text>
                <Text className={`expand-icon ${item.isExpanded ? 'expanded' : ''}`}>
                  ▼
                </Text>
              </View>
              {item.isExpanded && (
                <View className='faq-answer'>
                  <Text className='answer-text'>{item.answer}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View className='no-results'>
            <Text className='no-results-icon'>🔍</Text>
            <Text className='no-results-text'>未找到相关问题</Text>
            <Text className='no-results-tip'>试试其他关键词或联系客服</Text>
          </View>
        )}
      </View>
    </View>
  )

  const renderContactTab = () => (
    <View className='contact-container'>
      <View className='contact-header'>
        <Text className='contact-title'>联系我们</Text>
        <Text className='contact-subtitle'>我们随时为您提供帮助</Text>
      </View>

      <View className='contact-methods'>
        {/* 在线客服 */}
        <View className='contact-item' onClick={handleOnlineChat}>
          <View className='contact-icon online-chat'>🤖</View>
          <View className='contact-info'>
            <Text className='contact-method'>AI智能客服</Text>
            <Text className='contact-desc'>24小时在线，即时回复</Text>
            <Text className='contact-status online'>● 在线</Text>
          </View>
          <Text className='contact-arrow'>›</Text>
        </View>

        {/* 电话客服 */}
        <View className='contact-item' onClick={handlePhoneCall}>
          <View className='contact-icon phone'>📞</View>
          <View className='contact-info'>
            <Text className='contact-method'>电话客服</Text>
            <Text className='contact-number'>{contactInfo.phone}</Text>
            <Text className='contact-hours'>服务时间：{contactInfo.workingHours}</Text>
          </View>
          <Text className='contact-arrow'>›</Text>
        </View>

        {/* 邮件支持 */}
        <View className='contact-item' onClick={() => {
          Taro.setClipboardData({
            data: contactInfo.email,
            success: () => {
              showToast({
                title: '邮箱地址已复制',
                icon: 'success'
              })
            }
          })
        }}>
          <View className='contact-icon email'>📧</View>
          <View className='contact-info'>
            <Text className='contact-method'>邮件支持</Text>
            <Text className='contact-email'>{contactInfo.email}</Text>
            <Text className='contact-desc'>点击复制邮箱地址</Text>
          </View>
          <Text className='contact-arrow'>›</Text>
        </View>

        {/* 意见反馈 */}
        <View className='contact-item' onClick={handleFeedback}>
          <View className='contact-icon feedback'>💬</View>
          <View className='contact-info'>
            <Text className='contact-method'>意见反馈</Text>
            <Text className='contact-desc'>提交问题和建议</Text>
          </View>
          <Text className='contact-arrow'>›</Text>
        </View>
      </View>

      <View className='contact-tips'>
        <Text className='tips-title'>💡 温馨提示</Text>
        <Text className='tips-text'>• 紧急问题请优先拨打客服电话</Text>
        <Text className='tips-text'>• AI客服可快速解答常见问题</Text>
        <Text className='tips-text'>• 复杂问题建议通过邮件详细描述</Text>
      </View>
    </View>
  )

  return (
    <View className='help-center'>
      {/* 头部导航 */}
      <View className='help-header'>
        <Text className='help-title'>帮助中心</Text>
        <Text className='help-subtitle'>为您提供全方位的服务支持</Text>
      </View>

      {/* 标签页导航 */}
      <View className='tab-navigation'>
        <View
          className={`tab-item ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => setActiveTab('faq')}
        >
          <Text className='tab-icon'>❓</Text>
          <Text className='tab-text'>常见问题</Text>
        </View>
        <View
          className={`tab-item ${activeTab === 'contact' ? 'active' : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          <Text className='tab-icon'>📞</Text>
          <Text className='tab-text'>联系客服</Text>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className='content-area' scrollY>
        {activeTab === 'faq' && renderFAQTab()}
        {activeTab === 'contact' && renderContactTab()}
      </ScrollView>
    </View>
  )
}

export default HelpCenter