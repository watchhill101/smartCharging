import { View, Text, Switch, Button, Input } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import request from '../../utils/request'
import './index.scss'

interface SmsConfig {
  enabled: boolean
  chargingNotifications: boolean
  paymentNotifications: boolean
  couponNotifications: boolean
  systemNotifications: boolean
  verificationCodes: boolean
}

interface SmsPreferences {
  userId: string
  phoneNumber?: string
  config: SmsConfig
  createdAt: string
  updatedAt: string
}

interface SmsSettingsProps {
  visible: boolean
  onClose: () => void
}

const showToast = (options: { title: string; icon?: string }) => {
  Taro.showToast({
    title: options.title,
    icon: options.icon === 'error' ? 'error' : options.icon === 'success' ? 'success' : 'none'
  })
}

const SmsSettings: React.FC<SmsSettingsProps> = ({ visible, onClose }) => {
  const [preferences, setPreferences] = useState<SmsPreferences | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      loadPreferences()
    }
  }, [visible])

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      
      const response = await request({
        url: '/sms/preferences',
        method: 'GET'
      })

      if (response.data.success) {
        const prefs = response.data.data
        setPreferences(prefs)
        setPhoneNumber(prefs.phoneNumber || '')
      } else {
        throw new Error(response.data.message || '获取设置失败')
      }
    } catch (error: any) {
      console.error('获取短信设置失败:', error)
      
      // 使用默认设置
      const defaultPrefs: SmsPreferences = {
        userId: 'current_user',
        config: {
          enabled: true,
          chargingNotifications: true,
          paymentNotifications: true,
          couponNotifications: false,
          systemNotifications: true,
          verificationCodes: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      setPreferences(defaultPrefs)
      
      showToast({
        title: '加载失败，使用默认设置',
        icon: 'none'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateConfig = (key: keyof SmsConfig, value: boolean) => {
    if (!preferences) return
    
    setPreferences({
      ...preferences,
      config: {
        ...preferences.config,
        [key]: value
      }
    })
  }

  const handleSave = async () => {
    if (!preferences) return
    
    try {
      setIsSaving(true)
      
      // 验证手机号格式
      if (phoneNumber && !/^1[3-9]\d{9}$/.test(phoneNumber)) {
        showToast({
          title: '手机号格式不正确',
          icon: 'error'
        })
        return
      }
      
      const response = await request({
        url: '/sms/preferences',
        method: 'PUT',
        data: {
          config: preferences.config,
          phoneNumber: phoneNumber || undefined
        }
      })

      if (response.data.success) {
        setPreferences(response.data.data)
        
        showToast({
          title: '设置保存成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        throw new Error(response.data.message || '保存失败')
      }
    } catch (error: any) {
      console.error('保存短信设置失败:', error)
      
      showToast({
        title: error.message || '保存失败',
        icon: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhoneNumberChange = (e: any) => {
    const value = e.detail.value.replace(/\D/g, '') // 只保留数字
    if (value.length <= 11) {
      setPhoneNumber(value)
    }
  }

  if (!visible) return null

  return (
    <View className='sms-settings'>
      <View className='sms-settings-mask' onClick={onClose} />
      
      <View className='sms-settings-panel'>
        {/* 头部 */}
        <View className='settings-header'>
          <Text className='header-title'>短信通知设置</Text>
          <Button className='close-btn' onClick={onClose}>✕</Button>
        </View>

        {isLoading ? (
          <View className='loading-state'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        ) : preferences ? (
          <View className='settings-content'>
            {/* 手机号设置 */}
            <View className='setting-section'>
              <Text className='section-title'>手机号码</Text>
              <View className='phone-input-wrapper'>
                <Input
                  className='phone-input'
                  type='number'
                  placeholder='请输入手机号码'
                  value={phoneNumber}
                  onInput={handlePhoneNumberChange}
                  maxlength={11}
                />
                <Text className='input-hint'>
                  {phoneNumber ? '已设置' : '未设置手机号将无法接收短信通知'}
                </Text>
              </View>
            </View>

            {/* 总开关 */}
            <View className='setting-section'>
              <View className='setting-item main-switch'>
                <View className='setting-info'>
                  <Text className='setting-title'>短信通知</Text>
                  <Text className='setting-desc'>开启后可接收各类短信通知</Text>
                </View>
                <Switch
                  checked={preferences.config.enabled}
                  onChange={(e) => updateConfig('enabled', e.detail.value)}
                  color='#1890ff'
                />
              </View>
            </View>

            {/* 详细设置 */}
            {preferences.config.enabled && (
              <View className='setting-section'>
                <Text className='section-title'>通知类型</Text>
                
                <View className='setting-item'>
                  <View className='setting-info'>
                    <Text className='setting-title'>充电通知</Text>
                    <Text className='setting-desc'>充电开始、完成、异常等通知</Text>
                  </View>
                  <Switch
                    checked={preferences.config.chargingNotifications}
                    onChange={(e) => updateConfig('chargingNotifications', e.detail.value)}
                    color='#1890ff'
                  />
                </View>

                <View className='setting-item'>
                  <View className='setting-info'>
                    <Text className='setting-title'>支付通知</Text>
                    <Text className='setting-desc'>支付成功、失败、余额不足等通知</Text>
                  </View>
                  <Switch
                    checked={preferences.config.paymentNotifications}
                    onChange={(e) => updateConfig('paymentNotifications', e.detail.value)}
                    color='#1890ff'
                  />
                </View>

                <View className='setting-item'>
                  <View className='setting-info'>
                    <Text className='setting-title'>优惠券通知</Text>
                    <Text className='setting-desc'>优惠券到账、过期提醒等通知</Text>
                  </View>
                  <Switch
                    checked={preferences.config.couponNotifications}
                    onChange={(e) => updateConfig('couponNotifications', e.detail.value)}
                    color='#1890ff'
                  />
                </View>

                <View className='setting-item'>
                  <View className='setting-info'>
                    <Text className='setting-title'>系统通知</Text>
                    <Text className='setting-desc'>系统维护、重要公告等通知</Text>
                  </View>
                  <Switch
                    checked={preferences.config.systemNotifications}
                    onChange={(e) => updateConfig('systemNotifications', e.detail.value)}
                    color='#1890ff'
                  />
                </View>

                <View className='setting-item'>
                  <View className='setting-info'>
                    <Text className='setting-title'>验证码短信</Text>
                    <Text className='setting-desc'>登录、注册等验证码短信</Text>
                  </View>
                  <Switch
                    checked={preferences.config.verificationCodes}
                    onChange={(e) => updateConfig('verificationCodes', e.detail.value)}
                    color='#1890ff'
                  />
                </View>
              </View>
            )}

            {/* 说明信息 */}
            <View className='setting-section'>
              <View className='setting-notice'>
                <Text className='notice-title'>温馨提示</Text>
                <Text className='notice-text'>
                  • 短信通知可能产生运营商费用{"\n"}
                  • 验证码短信建议保持开启{"\n"}
                  • 关闭通知不影响应用内消息推送{"\n"}
                  • 设置修改后立即生效
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className='error-state'>
            <Text className='error-text'>加载失败</Text>
            <Button className='retry-btn' onClick={loadPreferences}>
              重试
            </Button>
          </View>
        )}

        {/* 底部按钮 */}
        {preferences && (
          <View className='settings-footer'>
            <Button 
              className='cancel-btn'
              onClick={onClose}
              disabled={isSaving}
            >
              取消
            </Button>
            <Button 
              className='save-btn'
              onClick={handleSave}
              disabled={isSaving || !phoneNumber}
            >
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}

export default SmsSettings