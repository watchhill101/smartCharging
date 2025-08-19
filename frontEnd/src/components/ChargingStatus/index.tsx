import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  Button as NutButton,
  Progress,
  Card,
  Divider,
  Tag,
  Toast,
  Dialog,
  Loading,
  Icon
} from '@nutui/nutui-react-taro';
import './index.scss';

export interface ChargingStatusData {
  sessionId: string;
  pileId: string;
  pileName: string;
  pileNumber: string;
  
  // 充电状态
  status: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted';
  
  // 时间信息
  startTime: string;
  currentTime: string;
  estimatedEndTime?: string;
  duration: number; // 秒
  
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
  currentCost: number; // 元
  pricePerKwh: number; // 元/kWh
  
  // 车辆信息
  batteryLevel?: number; // %
  batteryCapacity?: number; // kWh
  
  // 预估信息
  estimatedCost?: number; // 元
  estimatedDuration?: number; // 秒
  chargingEfficiency?: number; // %
}

export interface ChargingStatusProps {
  sessionId: string;
  data?: ChargingStatusData;
  loading?: boolean;
  
  // 事件回调
  onStopCharging?: (sessionId: string) => void;
  onPauseCharging?: (sessionId: string) => void;
  onResumeCharging?: (sessionId: string) => void;
  onRefresh?: () => void;
  onNavigateToStation?: (pileId: string) => void;
  
  // 显示配置
  showControls?: boolean;
  showDetails?: boolean;
  showChart?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  
  className?: string;
}

interface StatusState {
  showStopDialog: boolean;
  showDetailsDialog: boolean;
  showChartDialog: boolean;
  chartType: 'power' | 'energy' | 'cost';
  powerHistory: Array<{ time: string; power: number }>;
  energyHistory: Array<{ time: string; energy: number }>;
  costHistory: Array<{ time: string; cost: number }>;
}

const ChargingStatus: React.FC<ChargingStatusProps> = ({
  sessionId,
  data,
  loading = false,
  onStopCharging,
  onPauseCharging,
  onResumeCharging,
  onRefresh,
  onNavigateToStation,
  showControls = true,
  showDetails = true,
  showChart = true,
  autoRefresh = true,
  refreshInterval = 5000,
  className = ''
}) => {
  const [state, setState] = useState<StatusState>({
    showStopDialog: false,
    showDetailsDialog: false,
    showChartDialog: false,
    chartType: 'power',
    powerHistory: [],
    energyHistory: [],
    costHistory: []
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<any>(null);

  // 状态映射
  const statusMap = {
    preparing: { label: '准备中', color: '#faad14', icon: '⏳' },
    charging: { label: '充电中', color: '#52c41a', icon: '⚡' },
    suspended: { label: '已暂停', color: '#1890ff', icon: '⏸️' },
    finishing: { label: '结束中', color: '#722ed1', icon: '🔄' },
    completed: { label: '已完成', color: '#13c2c2', icon: '✅' },
    faulted: { label: '故障', color: '#ff4d4f', icon: '❌' }
  };

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && data?.status === 'charging') {
      refreshTimerRef.current = setInterval(() => {
        onRefresh?.();
      }, refreshInterval);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, data?.status, refreshInterval, onRefresh]);

  // 更新历史数据
  useEffect(() => {
    if (data) {
      const currentTime = new Date().toLocaleTimeString();
      
      setState(prev => ({
        ...prev,
        powerHistory: [
          ...prev.powerHistory.slice(-19), // 保留最近20个数据点
          { time: currentTime, power: data.currentPower }
        ],
        energyHistory: [
          ...prev.energyHistory.slice(-19),
          { time: currentTime, energy: data.energyDelivered }
        ],
        costHistory: [
          ...prev.costHistory.slice(-19),
          { time: currentTime, cost: data.currentCost }
        ]
      }));
    }
  }, [data]);

  // 格式化时间
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }, []);

  // 格式化时间（预估）
  const formatEstimatedTime = useCallback((seconds?: number): string => {
    if (!seconds) return '--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `约${hours}小时${minutes}分钟`;
    } else {
      return `约${minutes}分钟`;
    }
  }, []);

  // 计算充电进度
  const getChargingProgress = useCallback((): number => {
    if (!data) return 0;
    
    if (data.targetEnergy && data.targetEnergy > 0) {
      return Math.min((data.energyDelivered / data.targetEnergy) * 100, 100);
    }
    
    if (data.batteryLevel && data.batteryLevel > 0) {
      return data.batteryLevel;
    }
    
    // 根据时间进度估算
    if (data.estimatedDuration && data.duration > 0) {
      return Math.min((data.duration / data.estimatedDuration) * 100, 100);
    }
    
    return 0;
  }, [data]);

  // 处理停止充电
  const handleStopCharging = useCallback(() => {
    setState(prev => ({ ...prev, showStopDialog: true }));
  }, []);

  const confirmStopCharging = useCallback(() => {
    onStopCharging?.(sessionId);
    setState(prev => ({ ...prev, showStopDialog: false }));
    
    Toast.show({
      content: '正在停止充电...',
      type: 'loading',
      duration: 2000
    });
  }, [sessionId, onStopCharging]);

  // 处理暂停/恢复充电
  const handlePauseResume = useCallback(() => {
    if (data?.status === 'charging') {
      onPauseCharging?.(sessionId);
      Toast.show({
        content: '正在暂停充电...',
        type: 'loading',
        duration: 2000
      });
    } else if (data?.status === 'suspended') {
      onResumeCharging?.(sessionId);
      Toast.show({
        content: '正在恢复充电...',
        type: 'loading',
        duration: 2000
      });
    }
  }, [data?.status, sessionId, onPauseCharging, onResumeCharging]);

  // 处理导航到充电站
  const handleNavigateToStation = useCallback(() => {
    if (data?.pileId) {
      onNavigateToStation?.(data.pileId);
    }
  }, [data?.pileId, onNavigateToStation]);

  // 显示详情
  const showDetails = useCallback(() => {
    setState(prev => ({ ...prev, showDetailsDialog: true }));
  }, []);

  // 显示图表
  const showChart = useCallback((chartType: 'power' | 'energy' | 'cost') => {
    setState(prev => ({ 
      ...prev, 
      showChartDialog: true,
      chartType 
    }));
  }, []);

  // 绘制图表
  const drawChart = useCallback(() => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = 300;
    const height = 200;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 获取数据
    let chartData: Array<{ time: string; value: number }> = [];
    let label = '';
    let unit = '';
    let color = '#1890ff';
    
    switch (state.chartType) {
      case 'power':
        chartData = state.powerHistory.map(item => ({ time: item.time, value: item.power }));
        label = '功率';
        unit = 'kW';
        color = '#52c41a';
        break;
      case 'energy':
        chartData = state.energyHistory.map(item => ({ time: item.time, value: item.energy }));
        label = '电量';
        unit = 'kWh';
        color = '#1890ff';
        break;
      case 'cost':
        chartData = state.costHistory.map(item => ({ time: item.time, value: item.cost }));
        label = '费用';
        unit = '元';
        color = '#faad14';
        break;
    }
    
    if (chartData.length < 2) return;
    
    // 计算数据范围
    const values = chartData.map(item => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;
    
    // 绘制坐标轴
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 1;
    
    // Y轴
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(40, height - 40);
    ctx.stroke();
    
    // X轴
    ctx.beginPath();
    ctx.moveTo(40, height - 40);
    ctx.lineTo(width - 20, height - 40);
    ctx.stroke();
    
    // 绘制数据线
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    chartData.forEach((point, index) => {
      const x = 40 + (index / (chartData.length - 1)) * (width - 60);
      const y = height - 40 - ((point.value - minValue) / valueRange) * (height - 60);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // 绘制数据点
    ctx.fillStyle = color;
    chartData.forEach((point, index) => {
      const x = 40 + (index / (chartData.length - 1)) * (width - 60);
      const y = height - 40 - ((point.value - minValue) / valueRange) * (height - 60);
      
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制标签
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${label} (${unit})`, width / 2, 15);
    
    // 绘制数值标签
    ctx.textAlign = 'right';
    ctx.fillText(maxValue.toFixed(1), 35, 25);
    ctx.fillText(minValue.toFixed(1), 35, height - 45);
    
  }, [data, state.chartType, state.powerHistory, state.energyHistory, state.costHistory]);

  // 图表显示时绘制
  useEffect(() => {
    if (state.showChartDialog) {
      setTimeout(drawChart, 100);
    }
  }, [state.showChartDialog, drawChart]);

  if (loading) {
    return (
      <View className={`charging-status loading ${className}`}>
        <Loading type="spinner" />
        <Text className="loading-text">加载充电状态...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View className={`charging-status error ${className}`}>
        <Text className="error-text">充电状态数据不可用</Text>
        <NutButton type="primary" onClick={onRefresh}>
          重新加载
        </NutButton>
      </View>
    );
  }

  const statusInfo = statusMap[data.status];
  const progress = getChargingProgress();

  return (
    <View className={`charging-status ${className}`}>
      {/* 状态卡片 */}
      <Card className="status-card">
        <View className="status-header">
          <View className="status-info">
            <View className="status-badge" style={{ backgroundColor: statusInfo.color }}>
              <Text className="status-icon">{statusInfo.icon}</Text>
              <Text className="status-text">{statusInfo.label}</Text>
            </View>
            <Text className="pile-info">{data.pileName} - {data.pileNumber}</Text>
          </View>
          
          <View className="status-actions">
            <NutButton
              type="default"
              size="mini"
              onClick={onRefresh}
              className="refresh-btn"
            >
              🔄
            </NutButton>
            
            <NutButton
              type="default"
              size="mini"
              onClick={handleNavigateToStation}
              className="navigate-btn"
            >
              📍
            </NutButton>
          </View>
        </View>

        {/* 充电进度 */}
        <View className="charging-progress">
          <View className="progress-header">
            <Text className="progress-label">充电进度</Text>
            <Text className="progress-value">{progress.toFixed(1)}%</Text>
          </View>
          
          <Progress
            percentage={progress}
            strokeColor={statusInfo.color}
            showText={false}
            className="progress-bar"
          />
          
          {data.targetEnergy && (
            <Text className="progress-detail">
              {data.energyDelivered.toFixed(1)} / {data.targetEnergy.toFixed(1)} kWh
            </Text>
          )}
        </View>

        {/* 关键指标 */}
        <View className="key-metrics">
          <View className="metric-item">
            <Text className="metric-label">当前功率</Text>
            <Text className="metric-value">{data.currentPower.toFixed(1)} kW</Text>
          </View>
          
          <View className="metric-item">
            <Text className="metric-label">已充电量</Text>
            <Text className="metric-value">{data.energyDelivered.toFixed(1)} kWh</Text>
          </View>
          
          <View className="metric-item">
            <Text className="metric-label">充电时长</Text>
            <Text className="metric-value">{formatDuration(data.duration)}</Text>
          </View>
          
          <View className="metric-item">
            <Text className="metric-label">当前费用</Text>
            <Text className="metric-value">¥{data.currentCost.toFixed(2)}</Text>
          </View>
        </View>

        {/* 预估信息 */}
        {(data.estimatedEndTime || data.estimatedCost || data.estimatedDuration) && (
          <>
            <Divider />
            <View className="estimated-info">
              <Text className="section-title">预估信息</Text>
              
              <View className="estimated-items">
                {data.estimatedDuration && (
                  <View className="estimated-item">
                    <Text className="estimated-label">预计剩余时间</Text>
                    <Text className="estimated-value">
                      {formatEstimatedTime(data.estimatedDuration - data.duration)}
                    </Text>
                  </View>
                )}
                
                {data.estimatedCost && (
                  <View className="estimated-item">
                    <Text className="estimated-label">预计总费用</Text>
                    <Text className="estimated-value">¥{data.estimatedCost.toFixed(2)}</Text>
                  </View>
                )}
                
                {data.estimatedEndTime && (
                  <View className="estimated-item">
                    <Text className="estimated-label">预计完成时间</Text>
                    <Text className="estimated-value">
                      {new Date(data.estimatedEndTime).toLocaleTimeString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </Card>

      {/* 详细信息按钮 */}
      {showDetails && (
        <View className="detail-buttons">
          <NutButton
            type="default"
            onClick={showDetails}
            className="detail-btn"
          >
            📊 详细信息
          </NutButton>
          
          {showChart && (
            <>
              <NutButton
                type="default"
                onClick={() => showChart('power')}
                className="chart-btn"
              >
                📈 功率图表
              </NutButton>
              
              <NutButton
                type="default"
                onClick={() => showChart('energy')}
                className="chart-btn"
              >
                📊 电量图表
              </NutButton>
            </>
          )}
        </View>
      )}

      {/* 控制按钮 */}
      {showControls && (data.status === 'charging' || data.status === 'suspended') && (
        <View className="control-buttons">
          {data.status === 'charging' && (
            <NutButton
              type="warning"
              onClick={handlePauseResume}
              className="pause-btn"
            >
              ⏸️ 暂停充电
            </NutButton>
          )}
          
          {data.status === 'suspended' && (
            <NutButton
              type="success"
              onClick={handlePauseResume}
              className="resume-btn"
            >
              ▶️ 恢复充电
            </NutButton>
          )}
          
          <NutButton
            type="danger"
            onClick={handleStopCharging}
            className="stop-btn"
          >
            ⏹️ 停止充电
          </NutButton>
        </View>
      )}

      {/* 停止充电确认对话框 */}
      <Dialog
        visible={state.showStopDialog}
        title="确认停止充电"
        content={`确定要停止充电吗？\n当前已充电 ${data.energyDelivered.toFixed(1)} kWh，费用 ¥${data.currentCost.toFixed(2)}`}
        confirmText="确认停止"
        cancelText="取消"
        onConfirm={confirmStopCharging}
        onCancel={() => setState(prev => ({ ...prev, showStopDialog: false }))}
      />

      {/* 详细信息对话框 */}
      <Dialog
        visible={state.showDetailsDialog}
        title="充电详细信息"
        onClose={() => setState(prev => ({ ...prev, showDetailsDialog: false }))}
        className="details-dialog"
      >
        <View className="details-content">
          <View className="detail-section">
            <Text className="section-title">电气参数</Text>
            <View className="detail-items">
              <View className="detail-item">
                <Text className="detail-label">电压</Text>
                <Text className="detail-value">{data.voltage.toFixed(1)} V</Text>
              </View>
              <View className="detail-item">
                <Text className="detail-label">电流</Text>
                <Text className="detail-value">{data.current.toFixed(1)} A</Text>
              </View>
              <View className="detail-item">
                <Text className="detail-label">温度</Text>
                <Text className="detail-value">{data.temperature.toFixed(1)} °C</Text>
              </View>
              <View className="detail-item">
                <Text className="detail-label">最大功率</Text>
                <Text className="detail-value">{data.maxPower.toFixed(1)} kW</Text>
              </View>
            </View>
          </View>

          <View className="detail-section">
            <Text className="section-title">费用信息</Text>
            <View className="detail-items">
              <View className="detail-item">
                <Text className="detail-label">电价</Text>
                <Text className="detail-value">¥{data.pricePerKwh.toFixed(2)}/kWh</Text>
              </View>
              <View className="detail-item">
                <Text className="detail-label">当前费用</Text>
                <Text className="detail-value">¥{data.currentCost.toFixed(2)}</Text>
              </View>
              {data.chargingEfficiency && (
                <View className="detail-item">
                  <Text className="detail-label">充电效率</Text>
                  <Text className="detail-value">{data.chargingEfficiency.toFixed(1)}%</Text>
                </View>
              )}
            </View>
          </View>

          {data.batteryLevel && (
            <View className="detail-section">
              <Text className="section-title">电池信息</Text>
              <View className="detail-items">
                <View className="detail-item">
                  <Text className="detail-label">电池电量</Text>
                  <Text className="detail-value">{data.batteryLevel.toFixed(1)}%</Text>
                </View>
                {data.batteryCapacity && (
                  <View className="detail-item">
                    <Text className="detail-label">电池容量</Text>
                    <Text className="detail-value">{data.batteryCapacity.toFixed(1)} kWh</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Dialog>

      {/* 图表对话框 */}
      <Dialog
        visible={state.showChartDialog}
        title={`${state.chartType === 'power' ? '功率' : state.chartType === 'energy' ? '电量' : '费用'}趋势图`}
        onClose={() => setState(prev => ({ ...prev, showChartDialog: false }))}
        className="chart-dialog"
      >
        <View className="chart-content">
          <Canvas
            ref={canvasRef}
            canvasId="chargingChart"
            style={{ width: '300px', height: '200px' }}
            className="chart-canvas"
          />
          
          <View className="chart-controls">
            <NutButton
              type={state.chartType === 'power' ? 'primary' : 'default'}
              size="mini"
              onClick={() => setState(prev => ({ ...prev, chartType: 'power' }))}
            >
              功率
            </NutButton>
            <NutButton
              type={state.chartType === 'energy' ? 'primary' : 'default'}
              size="mini"
              onClick={() => setState(prev => ({ ...prev, chartType: 'energy' }))}
            >
              电量
            </NutButton>
            <NutButton
              type={state.chartType === 'cost' ? 'primary' : 'default'}
              size="mini"
              onClick={() => setState(prev => ({ ...prev, chartType: 'cost' }))}
            >
              费用
            </NutButton>
          </View>
        </View>
      </Dialog>
    </View>
  );
};

export default ChargingStatus;