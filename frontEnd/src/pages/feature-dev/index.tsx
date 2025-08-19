import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import './index.scss'

export default function FeatureDev() {
  const [featureName, setFeatureName] = useState('该功能')

  useLoad((options) => {
    if (options.featureName) {
      setFeatureName(decodeURIComponent(options.featureName))
    }
  })

  const handleGoBack = () => {
    try {
      if (typeof Taro.navigateBack === 'function') {
        Taro.navigateBack()
      } else {
        // 降级到浏览器导航
        window.history.back()
      }
    } catch (error) {
      console.error('返回失败:', error)
      // 最后的备选方案
      window.history.back()
    }
  }

  return (
    <View className='feature-dev-page'>
      <View className='header'>
        <View className='back-btn' onClick={handleGoBack}>
          <Text className='back-icon'>‹</Text>
        </View>
        <Text className='page-title'>
          {featureName === '我的电卡' ? '电卡功能开发中' :
           featureName === '包月套餐' ? '套餐功能开发中' :
           featureName === '充电会员' ? '会员功能开发中' :
           featureName === '常用设置' ? '设置功能开发中' :
           featureName === '电池报告' ? '电池报告开发中' : '功能开发中'}
        </Text>
      </View>

      <View className='content'>
        <View className='dev-icon'>
          <Text className='icon'>🚧</Text>
        </View>
        
        <View className='dev-title'>
          <Text className='title'>{featureName}正在开发中</Text>
        </View>
        
        <View className='dev-message'>
          <Text className='message'>
            {featureName === '我的电卡' && '我们正在开发电卡管理系统，让您随时查看电卡余额和消费记录，享受更便捷的充电体验。'}
            {featureName === '包月套餐' && '我们正在设计多种包月套餐方案，为您提供最优惠的价格和最灵活的选择，让充电更省钱。'}
            {featureName === '充电会员' && '我们正在打造会员服务体系，为您提供专属优惠、积分奖励和优先服务，让充电更有价值。'}
            {featureName === '常用设置' && '我们正在完善个性化设置功能，让您可以根据自己的使用习惯定制应用界面和功能。'}
            {featureName === '电池报告' && '我们正在开发专业的电池分析系统，为您提供电池健康检测和充电优化建议，延长电池寿命。'}
            {!['我的电卡', '包月套餐', '充电会员', '常用设置', '电池报告'].includes(featureName) && `我们正在努力开发${featureName}功能，为您提供更好的服务体验。`}
          </Text>
        </View>
        
        <View className='dev-status'>
          <Text className='status-text'>
            开发进度: {
              featureName === '我的电卡' ? '45%' :
              featureName === '包月套餐' ? '35%' :
              featureName === '充电会员' ? '60%' :
              featureName === '常用设置' ? '25%' :
              featureName === '电池报告' ? '40%' : '30%'
            }
          </Text>
          <View className='progress-bar'>
            <View 
              className='progress-fill' 
              style={{ 
                width: featureName === '我的电卡' ? '45%' :
                       featureName === '包月套餐' ? '35%' :
                       featureName === '充电会员' ? '60%' :
                       featureName === '常用设置' ? '25%' :
                       featureName === '电池报告' ? '40%' : '30%'
              }}
            ></View>
          </View>
        </View>
        
        <View className='dev-features'>
          <Text className='features-title'>即将推出的功能:</Text>
          <View className='feature-list'>
            {featureName === '我的电卡' && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>💳</Text>
                  <Text className='feature-text'>电卡余额查询</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>📊</Text>
                  <Text className='feature-text'>消费记录统计</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🔒</Text>
                  <Text className='feature-text'>电卡安全保护</Text>
                </View>
              </>
            )}
            {featureName === '包月套餐' && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>📦</Text>
                  <Text className='feature-text'>多种套餐选择</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>💰</Text>
                  <Text className='feature-text'>优惠价格计算</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>⏰</Text>
                  <Text className='feature-text'>套餐到期提醒</Text>
                </View>
              </>
            )}
            {featureName === '充电会员' && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>👑</Text>
                  <Text className='feature-text'>会员专享优惠</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🎁</Text>
                  <Text className='feature-text'>积分奖励系统</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🚀</Text>
                  <Text className='feature-text'>优先充电服务</Text>
                </View>
              </>
            )}
            {featureName === '常用设置' && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>⚙️</Text>
                  <Text className='feature-text'>个性化配置</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🔔</Text>
                  <Text className='feature-text'>消息通知设置</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🌍</Text>
                  <Text className='feature-text'>语言地区选择</Text>
                </View>
              </>
            )}
            {featureName === '电池报告' && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>📊</Text>
                  <Text className='feature-text'>电池健康检测</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>📈</Text>
                  <Text className='feature-text'>性能数据分析</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🔋</Text>
                  <Text className='feature-text'>充电建议优化</Text>
                </View>
              </>
            )}
            {!['我的电卡', '包月套餐', '充电会员', '常用设置', '电池报告'].includes(featureName) && (
              <>
                <View className='feature-item'>
                  <Text className='feature-icon'>✨</Text>
                  <Text className='feature-text'>智能推荐系统</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🎯</Text>
                  <Text className='feature-text'>个性化设置</Text>
                </View>
                <View className='feature-item'>
                  <Text className='feature-icon'>🚀</Text>
                  <Text className='feature-text'>快速操作模式</Text>
                </View>
              </>
            )}
          </View>
        </View>
        
        <View className='dev-notice'>
          <Text className='notice-text'>
            {featureName === '我的电卡' && '电卡功能即将上线，让您的充电体验更加便捷！'}
            {featureName === '包月套餐' && '多种套餐选择，为您提供最优惠的充电方案！'}
            {featureName === '充电会员' && '成为会员，享受专属优惠和贴心服务！'}
            {featureName === '常用设置' && '个性化设置，让应用更符合您的使用习惯！'}
            {featureName === '电池报告' && '专业的电池分析，助您延长电池使用寿命！'}
            {!['我的电卡', '包月套餐', '充电会员', '常用设置', '电池报告'].includes(featureName) && '感谢您的耐心等待，我们会尽快完成开发并通知您！'}
          </Text>
        </View>
      </View>

      <View className='footer'>
        <Button className='back-button' onClick={handleGoBack}>
          <Text className='button-text'>返回上一页</Text>
        </Button>
      </View>
    </View>
  )
}
