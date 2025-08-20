import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Progress } from '@tarojs/components';
import {
  Button as NutButton,
  Toast,
  Card,
  Tag,
  Loading,
  Icon
} from '@nutui/nutui-react-taro';
import ChargingControl from '../ChargingControl';
import './index.scss';

export interface ChargingStatus {
  sessionId: string;
  pileId: string;
  pileName: string;
  stationName: string;
  
  // 充电状态
  status: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted';
  
  // 时间信息
  startTime: string;
  endTime?: string;
  duration: number; // 秒
  estimatedEndTime?: string;
  
  // 电量信息
  currentPower: number; // kW
  maxPower: number; // kW
  energyDelivered: number; // kWh
  targetEnergy?: number; // kWh
  
  // 电气参数
  voltage: number; // V
  current: number; // A
  temperature: number; // °C
  
  // 费用信息
  cost: number; // 元
  pricePerKwh: number; // 元/kWh
  
  // 车辆信息
  vehicleInfo?: {
    batteryCapacity: number; // kWh
    currentSoc: number; // %
    targetSoc: number; // %
  };
  
  // 异常信息
  errorCode?: string;
  errorMessage?: string;
}

export interface ChargingMonitorProps {
  sessionId: string;
  onStopCharging?: (sessionId: string, reason?: string) => Promise<void>;
  onPauseCharging?: (sessionId: string) => Promise<void>;
  onResumeCharging?: (sessionId: string) => Promise<void>;
  onUpdateSettings?: (sessionId: string, settings: any) => Promise<void>;
  onEmergencyStop?: (sessionId: string) => Promise<void>;
  onRefresh?: () => void;
  className?: string;
}

interface MonitorState {
  chargingStatus: ChargingStatus | null;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  lastUpdateTime: number;
  anomalies: any[];
  notifications: any[];
}

const ChargingMonitor: React.FC<ChargingMonitorProps> = ({
  sessionId,
  onStopCharging,
  onPauseCharging,
  onResumeCharging,
  onUpdateSettings,
  onEmergencyStop,
  onRefresh,
  className = ''
}) => {
  const [state, setState] = useState<MonitorState>({
    chargingStatus: null,
    loading: true,
    error: null,
    isConnected: false,
    lastUpdateTime: 0,
    anomalies: [],
    notifications: []
  });

  const wsRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 状态映射
  const statusMap = {
    preparing: { label: '准备中', color: '#1890ff', icon: '⏳' },
    charging: { label: '充电中', color: '#52c41a', icon: '⚡' },
    suspended: { label: '已暂停', color: '#faad14', icon: '⏸️' },
    finishing: { label: '结束中', color: '#722ed1', icon: '🔄' },
    completed: { label: '已完成', color: '#52c41a', icon: '✅' },
    faulted: { label: '故障', color: '#ff4d4f', icon: '❌' }
  };

  // 初始化WebSocket连接
  const initWebSocket = useCallback(() => {
    try {
      // 模拟WebSocket连接
      wsRef.current = {
        onOpen: () => {
          // WebSocket连接已建立
          setState(prev => ({ ...prev, isConnected: true, error: null }));
          
          // 订阅充电状态更新
          // TODO: 发送订阅消息到WebSocket服务器
        },
        
        onMessage: (event: any) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'charging_status_update') {
              setState(prev => ({
                ...prev,
                chargingStatus: data.status,
                lastUpdateTime: Date.now(),
                loading: false
              }));
            } else if (data.type === 'anomaly_detected') {
              setState(prev => ({
                ...prev,
                anomalies: [data.data, ...prev.anomalies.slice(0, 9)]
              }));
              
              // 显示异常警告
              Toast.show({
                content: `检测到充电异常: ${data.data.anomalies[0]?.message}`,
                type: 'warning',
                duration: 3000
              });
            } else if (data.type === 'notification') {
              setState(prev => ({
                ...prev,
                notifications: [data, ...prev.notifications.slice(0, 19)]
              }));
            }
          } catch (error) {
            console.error('❌ 解析WebSocket消息失败:', error);
          }
        },
        
        onError: (error: any) => {
          console.error('❌ WebSocket连接错误:', error);
          setState(prev => ({ 
            ...prev, 
            isConnected: false, 
            error: 'WebSocket连接错误' 
          }));
          
          // 重连
          scheduleReconnect();
        },
        
        onClose: () => {
          // WebSocket连接已关闭
          setState(prev => ({ ...prev, isConnected: false }));
          
          // 如果不是主动关闭，则重连
          if (wsRef.current) {
            scheduleReconnect();
          }
        }
      };
      
      // 模拟连接成功
      setTimeout(() => {
        wsRef.current?.onOpen();
        // 模拟接收数据
        startMockDataUpdate();
      }, 1000);
      
    } catch (error) {
      console.error('❌ 初始化WebSocket失败:', error);
      setState(prev => ({ ...prev, error: 'WebSocket初始化失败' }));
    }
  }, [sessionId]);

  // 重连调度
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      // 尝试重连WebSocket
      initWebSocket();
    }, 3000);
  }, [initWebSocket]);

  // 模拟数据更新（用于演示）
  const startMockDataUpdate = useCallback(() => {
    let mockData: ChargingStatus = {
      sessionId: sessionId,
      pileId: 'pile_001',
      pileName: 'A001',
      stationName: '万达广场充电站',
      status: 'charging',
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      duration: 30 * 60,
      currentPower: 45.5,
      maxPower: 60.0,
      energyDelivered: 22.5,
      voltage: 380,
      current: 120,
      temperature: 35,
      cost: 33.75,
      pricePerKwh: 1.5,
      vehicleInfo: {
        batteryCapacity: 75,
        currentSoc: 65,
        targetSoc: 80
      }
    };

    // 初始数据
    setState(prev => ({
      ...prev,
      chargingStatus: mockData,
      loading: false,
      lastUpdateTime: Date.now()
    }));

    // 定期更新数据
    updateIntervalRef.current = setInterval(() => {
      mockData = {
        ...mockData,
        duration: mockData.duration + 5,
        currentPower: 45.5 + Math.random() * 10 - 5,
        energyDelivered: mockData.energyDelivered + 0.1,
        cost: (mockData.energyDelivered + 0.1) * mockData.pricePerKwh,
        voltage: 380 + Math.random() * 20 - 10,
        current: 120 + Math.random() * 20 - 10,
        temperature: 35 + Math.random() * 10 - 5,
        vehicleInfo: mockData.vehicleInfo ? {
          ...mockData.vehicleInfo,
          currentSoc: Math.min(mockData.vehicleInfo.currentSoc + 0.1, mockData.vehicleInfo.targetSoc)
        } : undefined
      };

      setState(prev => ({
        ...prev,
        chargingStatus: mockData,
        lastUpdateTime: Date.now()
      }));
    }, 5000);
  }, [sessionId]);

  // 组件初始化
  useEffect(() => {
    initWebSocket();
    
    return () => {
      // 清理资源
      if (wsRef.current) {
        wsRef.current.onClose = null;
        wsRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [initWebSocket]);

  // 刷新数据
  const handleRefresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }));
    onRefresh?.();
    
    // 重新初始化连接
    setTimeout(() => {
      initWebSocket();
    }, parseInt(process.env.TARO_APP_WEBSOCKET_RECONNECT_DELAY || '1000'));
  }, [onRefresh, initWebSocket]);

  // 格式化时间
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  }, []);

  // 获取异常警告
  const getAnomalyWarnings = useCallback(() => {
    if (!state.chargingStatus) return [];
    
    const warnings = [];
    const { temperature, voltage, currentPower, maxPower } = state.chargingStatus;
    
    if (temperature > 60) {
      warnings.push({
        type: 'temperature',
        message: '温度过高',
        severity: temperature > 80 ? 'critical' : 'warning'
      });
    }
    
    if (voltage < 300 || voltage > 450) {
      warnings.push({
        type: 'voltage',
        message: '电压异常',
        severity: 'warning'
      });
    }
    
    if (currentPower < maxPower * 0.1) {
      warnings.push({
        type: 'power',
        message: '功率异常偏低',
        severity: 'warning'
      });
    }
    
    return warnings;
  }, [state.chargingStatus]);

  if (state.loading) {
    return (
      <View className={`charging-monitor loading ${className}`}>
        <Loading type="spinner" />
        <Text className="loading-text">正在加载充电状态...</Text>
      </View>
    );
  }

  if (state.error || !state.chargingStatus) {
    return (
      <View className={`charging-monitor error ${className}`}>
        <View className="error-content">
          <Text className="error-icon">❌</Text>
          <Text className="error-text">{state.error || '无法获取充电状态'}</Text>
          <NutButton type="primary" onClick={handleRefresh}>
            重新加载
          </NutButton>
        </View>
      </View>
    );
  }

  const status = state.chargingStatus;
  const statusInfo = statusMap[status.status];
  const warnings = getAnomalyWarnings();

  return (
    <View className={`charging-monitor ${className}`}>
      {/* 连接状态指示 */}
      <View className="connection-status">
        <View className={`status-dot ${state.isConnected ? 'connected' : 'disconnected'}`} />
        <Text className="status-text">
          {state.isConnected ? '实时连接' : '连接中断'}
        </Text>
        <Text className="update-time">
          更新于 {new Date(state.lastUpdateTime).toLocaleTimeString()}
        </Text>
      </View>

      {/* 充电站信息 */}
      <Card className="station-info">
        <View className="station-header">
          <Text className="station-name">{status.stationName}</Text>
          <Text className="pile-name">充电桩 {status.pileName}</Text>
        </View>
        
        <View className="status-badge">
          <Text className="status-icon">{statusInfo.icon}</Text>
          <Tag type="primary" style={{ backgroundColor: statusInfo.color }}>
            {statusInfo.label}
          </Tag>
        </View>

        {/* 异常警告 */}
        {warnings.length > 0 && (
          <View className="warnings">
            {warnings.map((warning, index) => (
              <View key={index} className={`warning-item ${warning.severity}`}>
                <Icon name="warning" size="14" />
                <Text className="warning-text">{warning.message}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* 充电进度 */}
      {status.vehicleInfo && (
        <Card className="charging-progress">
          <View className="progress-header">
            <Text className="progress-title">充电进度</Text>
            <Text className="progress-percentage">
              {status.vehicleInfo.currentSoc.toFixed(1)}%
            </Text>
          </View>
          
          <Progress 
            percentage={(status.vehicleInfo.currentSoc / status.vehicleInfo.targetSoc) * 100}
            strokeColor="#52c41a"
            className="progress-bar"
          />
          
          <View className="progress-info">
            <Text className="progress-text">
              {status.vehicleInfo.currentSoc.toFixed(1)}% → {status.vehicleInfo.targetSoc}%
            </Text>
            {status.estimatedEndTime && (
              <Text className="remaining-time">
                预计完成: {new Date(status.estimatedEndTime).toLocaleTimeString()}
              </Text>
            )}
          </View>
        </Card>
      )}

      {/* 实时数据 */}
      <Card className="realtime-data">
        <Text className="card-title">实时数据</Text>
        
        <View className="data-grid">
          <View className="data-item">
            <Text className="data-label">当前功率</Text>
            <Text className="data-value power">
              {status.currentPower.toFixed(1)} kW
            </Text>
          </View>
          
          <View className="data-item">
            <Text className="data-label">已充电量</Text>
            <Text className="data-value energy">
              {status.energyDelivered.toFixed(1)} kWh
            </Text>
          </View>
          
          <View className="data-item">
            <Text className="data-label">充电时长</Text>
            <Text className="data-value duration">
              {formatDuration(status.duration)}
            </Text>
          </View>
          
          <View className="data-item">
            <Text className="data-label">当前费用</Text>
            <Text className="data-value cost">
              ¥{status.cost.toFixed(2)}
            </Text>
          </View>
        </View>
      </Card>

      {/* 电气参数 */}
      <Card className="electrical-params">
        <Text className="card-title">电气参数</Text>
        
        <View className="params-grid">
          <View className="param-item">
            <Text className="param-icon">⚡</Text>
            <View className="param-info">
              <Text className="param-label">电压</Text>
              <Text className="param-value">{status.voltage.toFixed(0)} V</Text>
            </View>
          </View>
          
          <View className="param-item">
            <Text className="param-icon">🔌</Text>
            <View className="param-info">
              <Text className="param-label">电流</Text>
              <Text className="param-value">{status.current.toFixed(1)} A</Text>
            </View>
          </View>
          
          <View className="param-item">
            <Text className="param-icon">🌡️</Text>
            <View className="param-info">
              <Text className="param-label">温度</Text>
              <Text className="param-value">{status.temperature.toFixed(1)} °C</Text>
            </View>
          </View>
          
          <View className="param-item">
            <Text className="param-icon">⚙️</Text>
            <View className="param-info">
              <Text className="param-label">最大功率</Text>
              <Text className="param-value">{status.maxPower} kW</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* 充电控制组件 */}
      <ChargingControl
        sessionId={sessionId}
        currentStatus={status.status}
        currentPower={status.currentPower}
        maxPower={status.maxPower}
        energyDelivered={status.energyDelivered}
        targetEnergy={status.targetEnergy}
        targetSoc={status.vehicleInfo?.targetSoc}
        currentSoc={status.vehicleInfo?.currentSoc}
        currentCost={status.cost}
        duration={status.duration}
        estimatedEndTime={status.estimatedEndTime}
        onStopCharging={onStopCharging}
        onPauseCharging={onPauseCharging}
        onResumeCharging={onResumeCharging}
        onUpdateSettings={onUpdateSettings}
        onEmergencyStop={onEmergencyStop}
      />

      {/* 异常信息 */}
      {status.errorCode && (
        <Card className="error-info">
          <Text className="card-title error">异常信息</Text>
          <View className="error-details">
            <Text className="error-code">错误代码: {status.errorCode}</Text>
            {status.errorMessage && (
              <Text className="error-message">{status.errorMessage}</Text>
            )}
          </View>
        </Card>
      )}

      {/* 最近异常 */}
      {state.anomalies.length > 0 && (
        <Card className="anomalies-card">
          <Text className="card-title">最近异常</Text>
          <View className="anomalies-list">
            {state.anomalies.slice(0, 3).map((anomaly, index) => (
              <View key={index} className="anomaly-item">
                <View className={`anomaly-severity ${anomaly.riskLevel}`} />
                <View className="anomaly-content">
                  <Text className="anomaly-message">
                    {anomaly.anomalies[0]?.message}
                  </Text>
                  <Text className="anomaly-time">
                    {new Date(anomaly.anomalies[0]?.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* 刷新按钮 */}
      <View className="refresh-section">
        <NutButton
          type="default"
          size="large"
          onClick={handleRefresh}
          className="refresh-btn"
        >
          🔄 刷新数据
        </NutButton>
      </View>
    </View>
  );
};

export default ChargingMonitor;