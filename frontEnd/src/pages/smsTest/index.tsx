import { View, Text, Button, Input } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import request from '../../utils/request'
import SmsSettings from '../../components/SmsSettings'
import { TaroHelper } from '../../utils/taroHelpers'
import './index.scss'

const SmsTest: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const handlePhoneNumberChange = (e: any) => {
    const value = e.detail.value.replace(/\D/g, '') // 只保留数字
    if (value.length <= 11) {
      setPhoneNumber(value)
    }
  }

  const showToast = (options: { title: string; icon: 'success' | 'error' | 'loading' | 'none' }) => {
    TaroHelper.showToast(options)
  }

  const validatePhoneNumber = (): boolean => {
    if (!phoneNumber) {
      showToast({
        title: '请输入手机号',
        icon: 'error'
      })
      return false
    }
    
    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      showToast({
        title: '手机号格式不正确',
        icon: 'error'
      })
      return false
    }
    
    return true
  }

  const runSmsTest = async (testType: string, testName: string, requireAuth: boolean = true) => {
    if (!validatePhoneNumber()) return
    
    setIsLoading(true)
    addTestResult(`开始${testName}测试...`)
    
    try {
      const response = await request({
        url: `/sms-test/${testType}`,
        method: 'POST',
        data: { phoneNumber }
      })

      if (response.data.success) {
        addTestResult(`✅ ${testName}测试成功: ${response.data.message}`)
        if (response.data.data?.code) {
          addTestResult(`   验证码: ${response.data.data.code}`)
        }
      } else {
        addTestResult(`❌ ${testName}测试失败: ${response.data.message}`)
      }
    } catch (error: any) {
      console.error(`${testName}测试失败:`, error)
      addTestResult(`❌ ${testName}测试失败: ${error.message || '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const runFullSuite = async () => {
    if (!validatePhoneNumber()) return
    
    setIsLoading(true)
    addTestResult('开始运行完整短信测试套件...')
    
    try {
      const response = await request({
        url: '/sms-test/run-full-suite',
        method: 'POST',
        data: { phoneNumber }
      })

      if (response.data.success) {
        addTestResult(`✅ 测试套件完成: ${response.data.message}`)
        
        const { summary } = response.data.data
        addTestResult(`   总计: ${summary.total} 条`)
        addTestResult(`   成功: ${summary.success} 条`)
        addTestResult(`   失败: ${summary.failed} 条`)
        addTestResult(`   成功率: ${summary.successRate}`)
      } else {
        addTestResult(`❌ 测试套件失败: ${response.data.message}`)
      }
    } catch (error: any) {
      console.error('测试套件失败:', error)
      addTestResult(`❌ 测试套件失败: ${error.message || '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const testSystemMaintenance = async () => {
    if (!validatePhoneNumber()) return
    
    setIsLoading(true)
    addTestResult('开始系统维护通知测试...')
    
    try {
      const response = await request({
        url: '/sms-test/test-system-maintenance',
        method: 'POST',
        data: { phoneNumbers: [phoneNumber] }
      })

      if (response.data.success) {
        addTestResult(`✅ 系统维护通知测试成功: ${response.data.message}`)
      } else {
        addTestResult(`❌ 系统维护通知测试失败: ${response.data.message}`)
      }
    } catch (error: any) {
      console.error('系统维护通知测试失败:', error)
      addTestResult(`❌ 系统维护通知测试失败: ${error.message || '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getSmsStatistics = async () => {
    try {
      const response = await request({
        url: '/sms/statistics?timeRange=day',
        method: 'GET'
      })

      if (response.data.success) {
        const { statistics } = response.data.data
        addTestResult('📊 今日短信统计:')
        addTestResult(`   总计: ${statistics.total} 条`)
        addTestResult(`   成功: ${statistics.sent} 条`)
        addTestResult(`   失败: ${statistics.failed} 条`)
        addTestResult(`   成功率: ${statistics.successRate.toFixed(1)}%`)
      }
    } catch (error: any) {
      addTestResult(`❌ 获取统计失败: ${error.message}`)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  return (
    <View className='sms-test'>
      <View className='test-header'>
        <Text className='page-title'>短信通知测试</Text>
        <Button 
          className='settings-btn'
          size='mini'
          onClick={() => setShowSettings(true)}
        >
          设置
        </Button>
      </View>

      <View className='phone-input-section'>
        <Text className='input-label'>测试手机号</Text>
        <Input
          className='phone-input'
          type='number'
          placeholder='请输入11位手机号码'
          value={phoneNumber}
          onInput={handlePhoneNumberChange}
          maxlength={11}
        />
        {phoneNumber && (
          <Text className='phone-hint'>
            {/^1[3-9]\d{9}$/.test(phoneNumber) ? '✅ 手机号格式正确' : '❌ 手机号格式不正确'}
          </Text>
        )}
      </View>

      <View className='test-controls'>
        <View className='control-section'>
          <Text className='section-title'>基础功能测试</Text>
          <View className='button-grid'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-verification-code', '验证码短信', false)}
              disabled={isLoading}
            >
              验证码短信
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-charging-started', '充电开始')}
              disabled={isLoading}
            >
              充电开始
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-charging-completed', '充电完成')}
              disabled={isLoading}
            >
              充电完成
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-charging-failed', '充电异常')}
              disabled={isLoading}
            >
              充电异常
            </Button>
          </View>
        </View>

        <View className='control-section'>
          <Text className='section-title'>支付相关测试</Text>
          <View className='button-grid'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-payment-success', '支付成功')}
              disabled={isLoading}
            >
              支付成功
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-payment-failed', '支付失败')}
              disabled={isLoading}
            >
              支付失败
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-balance-low', '余额不足')}
              disabled={isLoading}
            >
              余额不足
            </Button>
          </View>
        </View>

        <View className='control-section'>
          <Text className='section-title'>优惠券测试</Text>
          <View className='button-grid'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-coupon-received', '优惠券到账')}
              disabled={isLoading}
            >
              优惠券到账
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runSmsTest('test-coupon-expiring', '优惠券过期')}
              disabled={isLoading}
            >
              优惠券过期
            </Button>
          </View>
        </View>

        <View className='control-section'>
          <Text className='section-title'>系统功能测试</Text>
          <View className='button-row'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={testSystemMaintenance}
              disabled={isLoading}
            >
              系统维护通知
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={getSmsStatistics}
              disabled={isLoading}
            >
              获取统计信息
            </Button>
          </View>
        </View>

        <View className='control-section'>
          <Text className='section-title'>综合测试</Text>
          <View className='button-row'>
            <Button 
              className='test-btn primary'
              size='mini'
              onClick={runFullSuite}
              disabled={isLoading}
            >
              {isLoading ? '测试中...' : '运行完整测试'}
            </Button>
          </View>
        </View>
      </View>

      <View className='test-results'>
        <View className='results-header'>
          <Text className='results-title'>测试结果</Text>
          <Button 
            className='clear-btn'
            size='mini'
            onClick={clearResults}
          >
            清空
          </Button>
        </View>
        
        <View className='results-content'>
          {testResults.length > 0 ? (
            testResults.map((result, index) => (
              <View key={index} className='result-item'>
                <Text className='result-text'>{result}</Text>
              </View>
            ))
          ) : (
            <View className='empty-results'>
              <Text className='empty-text'>暂无测试结果</Text>
            </View>
          )}
        </View>
      </View>

      <View className='test-instructions'>
        <Text className='instructions-title'>使用说明</Text>
        <Text className='instructions-text'>
          1. 输入有效的11位手机号码{"\n"}
          2. 点击各种测试按钮发送测试短信{"\n"}
          3. 查看手机是否收到短信通知{"\n"}
          4. 在设置中可以配置短信通知偏好{"\n"}
          5. 测试环境使用模拟发送，实际不会产生费用
        </Text>
      </View>

      <SmsSettings 
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </View>
  )
}

export default SmsTest