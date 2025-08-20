import { View, Text, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { useNotification } from '../../contexts/NotificationContext'
import request from '../../utils/request'
import './index.scss'

const NotificationTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<string[]>([])
  const { 
    notifications, 
    unreadCount, 
    isConnected, 
    error,
    refreshNotifications,
    reconnect
  } = useNotification()

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const runTest = async (testType: string, testName: string) => {
    setIsLoading(true)
    addTestResult(`开始${testName}测试...`)
    
    try {
      const response = await request({
        url: `/notification-test/${testType}`,
        method: 'POST'
      })

      if (response.data.success) {
        addTestResult(`✅ ${testName}测试成功: ${response.data.message}`)
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
    setIsLoading(true)
    addTestResult('开始运行完整测试套件...')
    
    try {
      const response = await request({
        url: '/notification-test/run-full-suite',
        method: 'POST'
      })

      if (response.data.success) {
        addTestResult(`✅ 测试套件启动成功: ${response.data.message}`)
        addTestResult('请观察通知中心的实时通知')
      } else {
        addTestResult(`❌ 测试套件启动失败: ${response.data.message}`)
      }
    } catch (error: any) {
      console.error('测试套件启动失败:', error)
      addTestResult(`❌ 测试套件启动失败: ${error.message || '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getWebSocketStatus = async () => {
    try {
      const response = await request({
        url: '/notification-test/websocket-status',
        method: 'GET'
      })

      if (response.data.success) {
        const { data } = response.data
        addTestResult(`📡 WebSocket状态:`)
        addTestResult(`   - 服务已初始化: ${data.isInitialized ? '是' : '否'}`)
        addTestResult(`   - 在线用户数: ${data.onlineUsers}`)
        addTestResult(`   - 当前用户在线: ${data.isCurrentUserOnline ? '是' : '否'}`)
      }
    } catch (error: any) {
      addTestResult(`❌ 获取WebSocket状态失败: ${error.message}`)
    }
  }

  const clearResults = () => {
    setTestResults([])
  }

  const handleReconnect = () => {
    addTestResult('尝试重新连接WebSocket...')
    reconnect()
  }

  return (
    <View className='notification-test'>
      <View className='test-header'>
        <Text className='page-title'>通知系统测试</Text>
        
        <View className='connection-status'>
          <View className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
          <Text className='status-text'>
            {isConnected ? '已连接' : '未连接'}
          </Text>
          {error && (
            <Text className='error-text'>({error})</Text>
          )}
        </View>
      </View>

      <View className='notification-stats'>
        <View className='stat-item'>
          <Text className='stat-number'>{notifications.length}</Text>
          <Text className='stat-label'>总通知</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-number unread'>{unreadCount}</Text>
          <Text className='stat-label'>未读</Text>
        </View>
      </View>

      <View className='test-controls'>
        <View className='control-section'>
          <Text className='section-title'>连接控制</Text>
          <View className='button-row'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={getWebSocketStatus}
              disabled={isLoading}
            >
              检查连接状态
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={handleReconnect}
              disabled={isLoading || isConnected}
            >
              重新连接
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={refreshNotifications}
              disabled={isLoading}
            >
              刷新通知
            </Button>
          </View>
        </View>

        <View className='control-section'>
          <Text className='section-title'>单项测试</Text>
          <View className='button-grid'>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runTest('test-charging', '充电通知')}
              disabled={isLoading}
            >
              充电通知
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runTest('test-payment', '支付通知')}
              disabled={isLoading}
            >
              支付通知
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runTest('test-maintenance', '系统维护')}
              disabled={isLoading}
            >
              系统维护
            </Button>
            <Button 
              className='test-btn'
              size='mini'
              onClick={() => runTest('test-priorities', '优先级测试')}
              disabled={isLoading}
            >
              优先级测试
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
          1. 确保WebSocket连接正常（状态显示为"已连接"）{"\n"}
          2. 点击各种测试按钮发送测试通知{"\n"}
          3. 观察通知中心是否收到实时通知{"\n"}
          4. 检查通知的内容、优先级和时间是否正确{"\n"}
          5. 测试标记已读、删除等功能是否正常
        </Text>
      </View>
    </View>
  )
}

export default NotificationTest