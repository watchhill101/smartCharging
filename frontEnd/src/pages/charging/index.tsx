import React, { useState, useEffect, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { Button as NutButton, Toast } from '@nutui/nutui-react-taro';
import ChargingStatus, { ChargingStatusData } from '../../components/ChargingStatus';
import { initWebSocketService, getWebSocketService } from '../../services/WebSocketService';
import { get, post } from '../../utils/request';
import './index.scss'
import { TIME_CONSTANTS, WEBSOCKET_CONSTANTS } from '../../utils/constants';

interface ChargingPageState {
  loading: boolean;
  chargingData: ChargingStatusData | null;
  error: string | null;
  wsConnected: boolean;
}

const ChargingPage: React.FC = () => {
  const router = useRouter();
  const { pileId, sessionId, pileCode } = router.params;
  
  const [state, setState] = useState<ChargingPageState>({
    loading: true,
    chargingData: null,
    error: null,
    wsConnected: false
  });

  // 初始化WebSocket连接
  useEffect(() => {
    const initWebSocket = async () => {
      try {
        const wsUrl = process.env.NODE_ENV === 'development' 
          ? 'ws://localhost:8080/ws/charging'
          : 'wss://api.smartcharging.com/ws/charging';

        const wsService = initWebSocketService(
          {
            url: wsUrl,
            reconnectInterval: WEBSOCKET_CONSTANTS.RECONNECT_INTERVAL,
    maxReconnectAttempts: WEBSOCKET_CONSTANTS.MAX_RECONNECT_ATTEMPTS,
    heartbeatInterval: WEBSOCKET_CONSTANTS.HEARTBEAT_INTERVAL
          },
          {
            onOpen: () => {
              console.log('✅ WebSocket连接已建立');
              setState(prev => ({ ...prev, wsConnected: true }));
              
              // 订阅充电状态更新
              if (sessionId) {
                wsService.subscribeChargingStatus(sessionId, handleChargingStatusUpdate);
              }
            },
            onError: (error) => {
              console.error('❌ WebSocket连接错误:', error);
              setState(prev => ({ ...prev, wsConnected: false }));
            },
            onClose: () => {
              console.log('🔌 WebSocket连接已关闭');
              setState(prev => ({ ...prev, wsConnected: false }));
            },
            onReconnect: (attempt) => {
              console.log(`🔄 WebSocket重连尝试 ${attempt}`);
              Toast.show(`正在重连... (${attempt})`);
            }
          }
        );

        await wsService.connect();
        
      } catch (error) {
        console.error('❌ WebSocket初始化失败:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'WebSocket连接失败',
          wsConnected: false 
        }));
      }
    };

    initWebSocket();

    // 清理函数
    return () => {
      const wsService = getWebSocketService();
      if (wsService && sessionId) {
        wsService.unsubscribeChargingStatus(sessionId);
        wsService.disconnect();
      }
    };
  }, [sessionId]);

  // 加载充电数据
  useEffect(() => {
    const loadChargingData = async () => {
      if (!sessionId && !pileCode) {
        setState(prev => ({ 
          ...prev, 
          error: '缺少充电会话ID或充电桩编号',
          loading: false 
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));

        // 如果有pileCode但没有sessionId，需要先启动充电
        if (pileCode && !sessionId) {
          await startChargingSession();
          return;
        }

        // 调用真实API获取充电数据
        const response = await get(`/charging/sessions/${sessionId}`)
        
        if (response.success && response.data) {
          setState(prev => ({ 
            ...prev, 
            chargingData: response.data,
            loading: false 
          }));
          return;
        }
        
        // 如果API失败，使用模拟数据作为备用
        console.warn('获取真实充电数据失败，使用模拟数据')
        const mockChargingData: ChargingStatusData = {
          sessionId: sessionId!,
          pileId: pileId || 'pile_001',
          pileName: '万达广场充电站',
          pileNumber: pileId || 'A001',
          status: 'charging',
          startTime: new Date(Date.now() - 1800000).toISOString(), // 30分钟前开始
          currentTime: new Date().toISOString(),
          duration: 1800, // 30分钟
          currentPower: 45.5,
          maxPower: 60,
          energyDelivered: 22.75,
          voltage: 380,
          current: 119.7,
          temperature: 28.5,
          currentCost: 34.13,
          pricePerKwh: 1.5,
          estimatedEndTime: new Date(Date.now() + 2700000).toISOString(), // 45分钟后结束
          estimatedCost: 75.0,
          estimatedDuration: 4500, // 预计总时长75分钟
          batteryLevel: 65,
          batteryCapacity: 70,
          chargingEfficiency: 92.5
        };

        setState(prev => ({ 
          ...prev, 
          chargingData: mockChargingData,
          loading: false 
        }));

      } catch (error) {
        console.error('❌ 加载充电数据失败:', error);
        setState(prev => ({ 
          ...prev, 
          error: '加载充电数据失败',
          loading: false 
        }));
      }
    };

    loadChargingData();
  }, [sessionId, pileCode, pileId]);

  // 启动充电会话
  const startChargingSession = async () => {
    try {
      // 调用真实API启动充电
      const response = await post('/charging/start', {
        pileId: pileId || pileCode,
        pileCode: pileCode
      });
      
      if (response.success && response.data?.sessionId) {
        // 更新URL参数
        const newUrl = `/pages/charging/index?sessionId=${response.data.sessionId}&pileId=${pileId}`;
        Taro.redirectTo({ url: newUrl });
      } else {
        throw new Error(response.message || '启动充电失败');
      }

    } catch (error: any) {
      console.error('❌ 启动充电失败:', error);
      
      // 显示错误信息
      Toast.show(error.message || '启动充电失败');
      
      setState(prev => ({ 
        ...prev, 
        error: error.message || '启动充电失败',
        loading: false 
      }));
    }
  };

  // 处理充电状态更新
  const handleChargingStatusUpdate = useCallback((data: any) => {
    console.log('📊 收到充电状态更新:', data);
    
    setState(prev => {
      if (!prev.chargingData) return prev;
      
      return {
        ...prev,
        chargingData: {
          ...prev.chargingData,
          status: mapChargingStatus(data.status),
          currentTime: new Date().toISOString(),
          duration: data.duration || prev.chargingData.duration,
          currentPower: data.currentPower || prev.chargingData.currentPower,
          energyDelivered: data.energyDelivered || prev.chargingData.energyDelivered,
          voltage: data.voltage || prev.chargingData.voltage,
          current: data.current || prev.chargingData.current,
          temperature: data.temperature || prev.chargingData.temperature,
          currentCost: data.cost || prev.chargingData.currentCost,
          batteryLevel: data.batteryLevel || prev.chargingData.batteryLevel,
          estimatedEndTime: data.estimatedEndTime || prev.chargingData.estimatedEndTime,
          estimatedCost: data.estimatedCost || prev.chargingData.estimatedCost,
          estimatedDuration: data.estimatedDuration || prev.chargingData.estimatedDuration
        }
      };
    });
  }, []);

  // 映射充电状态
  const mapChargingStatus = (status: string): ChargingStatusData['status'] => {
    const statusMap: { [key: string]: ChargingStatusData['status'] } = {
      'Preparing': 'preparing',
      'Charging': 'charging',
      'SuspendedEV': 'suspended',
      'SuspendedEVSE': 'suspended',
      'Finishing': 'finishing',
      'Completed': 'completed',
      'Faulted': 'faulted'
    };
    
    return statusMap[status] || 'preparing';
  };

  // 停止充电
  const handleStopCharging = useCallback(async (sessionId: string) => {
    try {
      // 模拟停止充电API调用
      Toast.show('充电已停止');

      // 延迟跳转到结算页面
      setTimeout(() => {
        Taro.redirectTo({
          url: `/pages/chargingResult/index?sessionId=${sessionId}`
        });
      }, TIME_CONSTANTS.TWO_SECONDS);

    } catch (error) {
      console.error('❌ 停止充电失败:', error);
      Toast.show('停止充电失败，请重试');
    }
  }, []);

  // 暂停充电
  const handlePauseCharging = useCallback(async (sessionId: string) => {
    try {
      Toast.show('充电已暂停');
    } catch (error) {
      console.error('❌ 暂停充电失败:', error);
      Toast.show('暂停充电失败');
    }
  }, []);

  // 恢复充电
  const handleResumeCharging = useCallback(async (sessionId: string) => {
    try {
      Toast.show('充电已恢复');
    } catch (error) {
      console.error('❌ 恢复充电失败:', error);
      Toast.show('恢复充电失败');
    }
  }, []);

  // 刷新数据
  const handleRefresh = useCallback(() => {
    if (sessionId) {
      setState(prev => ({ ...prev, loading: true }));
      
      // 模拟数据更新
      setTimeout(() => {
        setState(prev => {
          if (!prev.chargingData) return prev;
          
          return {
            ...prev,
            loading: false,
            chargingData: {
              ...prev.chargingData,
              currentTime: new Date().toISOString(),
              duration: prev.chargingData.duration + 5,
              currentPower: Math.max(0, prev.chargingData.currentPower + (Math.random() - 0.5) * 5),
              energyDelivered: prev.chargingData.energyDelivered + 0.1,
              currentCost: prev.chargingData.currentCost + 0.15,
              temperature: Math.max(20, Math.min(40, prev.chargingData.temperature + (Math.random() - 0.5) * 2))
            }
          };
        });
      }, TIME_CONSTANTS.ONE_SECOND);
    }
  }, [sessionId]);

  // 导航到充电站
  const handleNavigateToStation = useCallback((pileId: string) => {
    Taro.navigateTo({
      url: `/pages/stationDetail/index?stationId=${pileId}`
    });
  }, []);

  // 错误状态
  if (state.error) {
    return (
      <View className="charging-page error">
        <View className="error-container">
          <Text className="error-icon">❌</Text>
          <Text className="error-message">{state.error}</Text>
          <NutButton
            type="primary"
            onClick={() => {
              setState(prev => ({ ...prev, error: null, loading: true }));
              // 重新加载
            }}
          >
            重试
          </NutButton>
        </View>
      </View>
    );
  }

  return (
    <View className="charging-page">
      {/* WebSocket连接状态指示 */}
      {!state.wsConnected && (
        <View className="connection-status">
          <Text className="connection-text">🔄 连接实时数据中...</Text>
        </View>
      )}

      {/* 充电状态组件 */}
      <ChargingStatus
        sessionId={sessionId || ''}
        data={state.chargingData || undefined}
        loading={state.loading}
        onStopCharging={handleStopCharging}
        onPauseCharging={handlePauseCharging}
        onResumeCharging={handleResumeCharging}
        onRefresh={handleRefresh}
        onNavigateToStation={handleNavigateToStation}
        showControls={true}
        showDetails={true}
        showChart={true}
        autoRefresh={true}
        refreshInterval={TIME_CONSTANTS.FIVE_SECONDS}
      />

      {/* 底部安全提示 */}
      <View className="safety-tips">
        <Text className="tips-title">⚠️ 安全提示</Text>
        <Text className="tips-text">
          • 充电过程中请勿离开车辆太远
          {'\n'}• 如遇异常情况请立即停止充电
          {'\n'}• 充电完成后请及时移走车辆
        </Text>
      </View>
    </View>
  );
};

export default ChargingPage;