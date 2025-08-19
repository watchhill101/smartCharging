import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  Button as NutButton,
  Toast,
  Dialog,
  Card,
  Progress,
  CountDown,
  Tag,
  Divider,
  Icon,
  Popup,
  Input,
  Radio,
  Switch
} from '@nutui/nutui-react-taro';
import './index.scss';

export interface ChargingControlProps {
  sessionId: string;
  currentStatus: 'preparing' | 'charging' | 'suspended' | 'finishing' | 'completed' | 'faulted';
  currentPower: number;
  maxPower: number;
  energyDelivered: number;
  targetEnergy?: number;
  targetSoc?: number;
  currentSoc?: number;
  maxCost?: number;
  currentCost: number;
  duration: number;
  estimatedEndTime?: string;
  onStopCharging?: (sessionId: string, reason?: string) => Promise<void>;
  onPauseCharging?: (sessionId: string) => Promise<void>;
  onResumeCharging?: (sessionId: string) => Promise<void>;
  onUpdateSettings?: (sessionId: string, settings: ChargingSettings) => Promise<void>;
  onEmergencyStop?: (sessionId: string) => Promise<void>;
  className?: string;
}

export interface ChargingSettings {
  targetSoc?: number;
  maxEnergy?: number;
  maxCost?: number;
  autoStop: boolean;
  powerLimit?: number;
}

interface ControlState {
  showStopDialog: boolean;
  showPauseDialog: boolean;
  showEmergencyDialog: boolean;
  showSettingsDialog: boolean;
  stopReason: string;
  isProcessing: boolean;
  processingAction: string;
  settings: ChargingSettings;
}

const ChargingControl: React.FC<ChargingControlProps> = ({
  sessionId,
  currentStatus,
  currentPower,
  maxPower,
  energyDelivered,
  targetEnergy,
  targetSoc = 80,
  currentSoc = 0,
  maxCost,
  currentCost,
  duration,
  estimatedEndTime,
  onStopCharging,
  onPauseCharging,
  onResumeCharging,
  onUpdateSettings,
  onEmergencyStop,
  className = ''
}) => {
  const [state, setState] = useState<ControlState>({
    showStopDialog: false,
    showPauseDialog: false,
    showEmergencyDialog: false,
    showSettingsDialog: false,
    stopReason: 'user_request',
    isProcessing: false,
    processingAction: '',
    settings: {
      targetSoc,
      maxEnergy,
      maxCost,
      autoStop: true,
      powerLimit: maxPower
    }
  });

  const emergencyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 停止原因选项
  const stopReasons = [
    { value: 'user_request', label: '用户主动停止' },
    { value: 'target_reached', label: '达到目标电量' },
    { value: 'cost_limit', label: '达到费用上限' },
    { value: 'emergency', label: '紧急停止' },
    { value: 'maintenance', label: '设备维护' }
  ];

  // 状态映射
  const statusConfig = {
    preparing: { 
      label: '准备中', 
      color: '#1890ff', 
      icon: '⏳',
      canControl: false 
    },
    charging: { 
      label: '充电中', 
      color: '#52c41a', 
      icon: '⚡',
      canControl: true 
    },
    suspended: { 
      label: '已暂停', 
      color: '#faad14', 
      icon: '⏸️',
      canControl: true 
    },
    finishing: { 
      label: '结束中', 
      color: '#722ed1', 
      icon: '🔄',
      canControl: false 
    },
    completed: { 
      label: '已完成', 
      color: '#52c41a', 
      icon: '✅',
      canControl: false 
    },
    faulted: { 
      label: '故障', 
      color: '#ff4d4f', 
      icon: '❌',
      canControl: false 
    }
  };

  // 初始化设置
  useEffect(() => {
    setState(prev => ({
      ...prev,
      settings: {
        targetSoc,
        maxEnergy,
        maxCost,
        autoStop: true,
        powerLimit: maxPower
      }
    }));\n  }, [targetSoc, maxEnergy, maxCost, maxPower]);\n\n  // 停止充电\n  const handleStopCharging = useCallback(() => {\n    setState(prev => ({ ...prev, showStopDialog: true }));\n  }, []);\n\n  const confirmStopCharging = useCallback(async () => {\n    setState(prev => ({ \n      ...prev, \n      showStopDialog: false, \n      isProcessing: true,\n      processingAction: '正在停止充电...'\n    }));\n\n    try {\n      await onStopCharging?.(sessionId, state.stopReason);\n      \n      Toast.show({\n        content: '充电已停止',\n        type: 'success',\n        duration: 2000\n      });\n    } catch (error) {\n      console.error('❌ 停止充电失败:', error);\n      \n      Toast.show({\n        content: '停止充电失败，请重试',\n        type: 'error',\n        duration: 2000\n      });\n    } finally {\n      setState(prev => ({ \n        ...prev, \n        isProcessing: false,\n        processingAction: ''\n      }));\n    }\n  }, [sessionId, state.stopReason, onStopCharging]);\n\n  // 暂停充电\n  const handlePauseCharging = useCallback(() => {\n    setState(prev => ({ ...prev, showPauseDialog: true }));\n  }, []);\n\n  const confirmPauseCharging = useCallback(async () => {\n    setState(prev => ({ \n      ...prev, \n      showPauseDialog: false,\n      isProcessing: true,\n      processingAction: '正在暂停充电...'\n    }));\n\n    try {\n      await onPauseCharging?.(sessionId);\n      \n      Toast.show({\n        content: '充电已暂停',\n        type: 'success',\n        duration: 2000\n      });\n    } catch (error) {\n      console.error('❌ 暂停充电失败:', error);\n      \n      Toast.show({\n        content: '暂停充电失败，请重试',\n        type: 'error',\n        duration: 2000\n      });\n    } finally {\n      setState(prev => ({ \n        ...prev, \n        isProcessing: false,\n        processingAction: ''\n      }));\n    }\n  }, [sessionId, onPauseCharging]);\n\n  // 恢复充电\n  const handleResumeCharging = useCallback(async () => {\n    setState(prev => ({ \n      ...prev,\n      isProcessing: true,\n      processingAction: '正在恢复充电...'\n    }));\n\n    try {\n      await onResumeCharging?.(sessionId);\n      \n      Toast.show({\n        content: '充电已恢复',\n        type: 'success',\n        duration: 2000\n      });\n    } catch (error) {\n      console.error('❌ 恢复充电失败:', error);\n      \n      Toast.show({\n        content: '恢复充电失败，请重试',\n        type: 'error',\n        duration: 2000\n      });\n    } finally {\n      setState(prev => ({ \n        ...prev, \n        isProcessing: false,\n        processingAction: ''\n      }));\n    }\n  }, [sessionId, onResumeCharging]);\n\n  // 紧急停止\n  const handleEmergencyStop = useCallback(() => {\n    setState(prev => ({ ...prev, showEmergencyDialog: true }));\n  }, []);\n\n  const confirmEmergencyStop = useCallback(async () => {\n    setState(prev => ({ \n      ...prev, \n      showEmergencyDialog: false,\n      isProcessing: true,\n      processingAction: '紧急停止中...'\n    }));\n\n    try {\n      await onEmergencyStop?.(sessionId);\n      \n      Toast.show({\n        content: '紧急停止成功',\n        type: 'success',\n        duration: 2000\n      });\n    } catch (error) {\n      console.error('❌ 紧急停止失败:', error);\n      \n      Toast.show({\n        content: '紧急停止失败，请联系客服',\n        type: 'error',\n        duration: 3000\n      });\n    } finally {\n      setState(prev => ({ \n        ...prev, \n        isProcessing: false,\n        processingAction: ''\n      }));\n    }\n  }, [sessionId, onEmergencyStop]);\n\n  // 长按紧急停止\n  const handleEmergencyLongPress = useCallback(() => {\n    // 长按3秒触发紧急停止\n    emergencyTimeoutRef.current = setTimeout(() => {\n      confirmEmergencyStop();\n    }, 3000);\n\n    Toast.show({\n      content: '继续长按3秒执行紧急停止',\n      type: 'warning',\n      duration: 3000\n    });\n  }, [confirmEmergencyStop]);\n\n  const handleEmergencyLongPressEnd = useCallback(() => {\n    if (emergencyTimeoutRef.current) {\n      clearTimeout(emergencyTimeoutRef.current);\n      emergencyTimeoutRef.current = null;\n    }\n  }, []);\n\n  // 更新充电设置\n  const handleUpdateSettings = useCallback(() => {\n    setState(prev => ({ ...prev, showSettingsDialog: true }));\n  }, []);\n\n  const confirmUpdateSettings = useCallback(async () => {\n    setState(prev => ({ \n      ...prev, \n      showSettingsDialog: false,\n      isProcessing: true,\n      processingAction: '正在更新设置...'\n    }));\n\n    try {\n      await onUpdateSettings?.(sessionId, state.settings);\n      \n      Toast.show({\n        content: '设置更新成功',\n        type: 'success',\n        duration: 2000\n      });\n    } catch (error) {\n      console.error('❌ 更新设置失败:', error);\n      \n      Toast.show({\n        content: '更新设置失败，请重试',\n        type: 'error',\n        duration: 2000\n      });\n    } finally {\n      setState(prev => ({ \n        ...prev, \n        isProcessing: false,\n        processingAction: ''\n      }));\n    }\n  }, [sessionId, state.settings, onUpdateSettings]);\n\n  // 计算充电进度\n  const getChargingProgress = useCallback((): number => {\n    if (targetSoc && currentSoc) {\n      return Math.min((currentSoc / targetSoc) * 100, 100);\n    }\n    if (targetEnergy && energyDelivered) {\n      return Math.min((energyDelivered / targetEnergy) * 100, 100);\n    }\n    return 0;\n  }, [targetSoc, currentSoc, targetEnergy, energyDelivered]);\n\n  // 格式化时间\n  const formatDuration = useCallback((seconds: number): string => {\n    const hours = Math.floor(seconds / 3600);\n    const minutes = Math.floor((seconds % 3600) / 60);\n    const secs = seconds % 60;\n    \n    if (hours > 0) {\n      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;\n    } else {\n      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;\n    }\n  }, []);\n\n  // 检查是否接近停止条件\n  const checkStopConditions = useCallback(() => {\n    const warnings = [];\n    \n    if (targetSoc && currentSoc >= targetSoc * 0.95) {\n      warnings.push('即将达到目标电量');\n    }\n    \n    if (maxCost && currentCost >= maxCost * 0.95) {\n      warnings.push('即将达到费用上限');\n    }\n    \n    if (targetEnergy && energyDelivered >= targetEnergy * 0.95) {\n      warnings.push('即将达到目标电量');\n    }\n    \n    return warnings;\n  }, [targetSoc, currentSoc, maxCost, currentCost, targetEnergy, energyDelivered]);\n\n  const statusInfo = statusConfig[currentStatus];\n  const canControl = statusInfo.canControl && !state.isProcessing;\n  const warnings = checkStopConditions();\n\n  return (\n    <View className={`charging-control ${className}`}>\n      {/* 状态指示器 */}\n      <Card className=\"status-card\">\n        <View className=\"status-header\">\n          <View className=\"status-info\">\n            <Text className=\"status-icon\">{statusInfo.icon}</Text>\n            <Tag type=\"primary\" style={{ backgroundColor: statusInfo.color }}>\n              {statusInfo.label}\n            </Tag>\n          </View>\n          \n          <View className=\"session-info\">\n            <Text className=\"session-id\">会话: {sessionId.slice(-8)}</Text>\n            <Text className=\"duration\">时长: {formatDuration(duration)}</Text>\n          </View>\n        </View>\n\n        {/* 充电进度 */}\n        {(targetSoc || targetEnergy) && (\n          <View className=\"progress-section\">\n            <View className=\"progress-header\">\n              <Text className=\"progress-label\">充电进度</Text>\n              <Text className=\"progress-value\">\n                {getChargingProgress().toFixed(1)}%\n              </Text>\n            </View>\n            \n            <Progress \n              percentage={getChargingProgress()}\n              strokeColor={statusInfo.color}\n              className=\"progress-bar\"\n            />\n            \n            {estimatedEndTime && (\n              <Text className=\"estimated-time\">\n                预计完成: {new Date(estimatedEndTime).toLocaleTimeString()}\n              </Text>\n            )}\n          </View>\n        )}\n\n        {/* 警告信息 */}\n        {warnings.length > 0 && (\n          <View className=\"warnings\">\n            {warnings.map((warning, index) => (\n              <View key={index} className=\"warning-item\">\n                <Icon name=\"warning\" size=\"14\" color=\"#faad14\" />\n                <Text className=\"warning-text\">{warning}</Text>\n              </View>\n            ))}\n          </View>\n        )}\n      </Card>\n\n      {/* 实时数据 */}\n      <Card className=\"data-card\">\n        <Text className=\"card-title\">实时数据</Text>\n        \n        <View className=\"data-grid\">\n          <View className=\"data-item\">\n            <Text className=\"data-label\">当前功率</Text>\n            <Text className=\"data-value power\">\n              {currentPower.toFixed(1)} kW\n            </Text>\n            <View className=\"power-bar\">\n              <Progress \n                percentage={(currentPower / maxPower) * 100}\n                strokeColor=\"#1890ff\"\n                strokeWidth=\"4\"\n              />\n            </View>\n          </View>\n          \n          <View className=\"data-item\">\n            <Text className=\"data-label\">已充电量</Text>\n            <Text className=\"data-value energy\">\n              {energyDelivered.toFixed(2)} kWh\n            </Text>\n            {targetEnergy && (\n              <Text className=\"data-target\">\n                目标: {targetEnergy} kWh\n              </Text>\n            )}\n          </View>\n          \n          <View className=\"data-item\">\n            <Text className=\"data-label\">当前费用</Text>\n            <Text className=\"data-value cost\">\n              ¥{currentCost.toFixed(2)}\n            </Text>\n            {maxCost && (\n              <Text className=\"data-target\">\n                上限: ¥{maxCost}\n              </Text>\n            )}\n          </View>\n          \n          <View className=\"data-item\">\n            <Text className=\"data-label\">电池电量</Text>\n            <Text className=\"data-value soc\">\n              {currentSoc.toFixed(1)}%\n            </Text>\n            {targetSoc && (\n              <Text className=\"data-target\">\n                目标: {targetSoc}%\n              </Text>\n            )}\n          </View>\n        </View>\n      </Card>\n\n      {/* 控制按钮 */}\n      <View className=\"control-section\">\n        <Text className=\"section-title\">充电控制</Text>\n        \n        <View className=\"control-buttons\">\n          {/* 主要控制按钮 */}\n          {currentStatus === 'charging' && canControl && (\n            <>\n              <NutButton\n                type=\"warning\"\n                size=\"large\"\n                onClick={handlePauseCharging}\n                loading={state.isProcessing && state.processingAction.includes('暂停')}\n                className=\"pause-btn\"\n              >\n                ⏸️ 暂停充电\n              </NutButton>\n              \n              <NutButton\n                type=\"danger\"\n                size=\"large\"\n                onClick={handleStopCharging}\n                loading={state.isProcessing && state.processingAction.includes('停止')}\n                className=\"stop-btn\"\n              >\n                ⏹️ 停止充电\n              </NutButton>\n            </>\n          )}\n          \n          {currentStatus === 'suspended' && canControl && (\n            <>\n              <NutButton\n                type=\"success\"\n                size=\"large\"\n                onClick={handleResumeCharging}\n                loading={state.isProcessing && state.processingAction.includes('恢复')}\n                className=\"resume-btn\"\n              >\n                ▶️ 恢复充电\n              </NutButton>\n              \n              <NutButton\n                type=\"danger\"\n                size=\"large\"\n                onClick={handleStopCharging}\n                loading={state.isProcessing && state.processingAction.includes('停止')}\n                className=\"stop-btn\"\n              >\n                ⏹️ 停止充电\n              </NutButton>\n            </>\n          )}\n          \n          {/* 设置按钮 */}\n          {canControl && (\n            <NutButton\n              type=\"default\"\n              size=\"large\"\n              onClick={handleUpdateSettings}\n              className=\"settings-btn\"\n            >\n              ⚙️ 充电设置\n            </NutButton>\n          )}\n        </View>\n\n        {/* 紧急停止按钮 */}\n        {canControl && (\n          <View className=\"emergency-section\">\n            <NutButton\n              type=\"danger\"\n              size=\"small\"\n              onClick={handleEmergencyStop}\n              onLongPress={handleEmergencyLongPress}\n              onTouchEnd={handleEmergencyLongPressEnd}\n              loading={state.isProcessing && state.processingAction.includes('紧急')}\n              className=\"emergency-btn\"\n            >\n              🚨 紧急停止\n            </NutButton>\n            <Text className=\"emergency-tip\">\n              点击或长按3秒紧急停止充电\n            </Text>\n          </View>\n        )}\n\n        {/* 处理状态提示 */}\n        {state.isProcessing && (\n          <View className=\"processing-status\">\n            <Icon name=\"loading\" size=\"16\" />\n            <Text className=\"processing-text\">{state.processingAction}</Text>\n          </View>\n        )}\n      </View>\n\n      {/* 停止充电确认对话框 */}\n      <Dialog\n        visible={state.showStopDialog}\n        title=\"确认停止充电\"\n        onClose={() => setState(prev => ({ ...prev, showStopDialog: false }))}\n        onCancel={() => setState(prev => ({ ...prev, showStopDialog: false }))}\n        onConfirm={confirmStopCharging}\n      >\n        <View className=\"stop-dialog-content\">\n          <Text className=\"dialog-text\">\n            确定要停止当前充电会话吗？停止后将结算费用。\n          </Text>\n          \n          <View className=\"reason-section\">\n            <Text className=\"reason-label\">停止原因:</Text>\n            <Radio.Group\n              value={state.stopReason}\n              onChange={(value) => setState(prev => ({ ...prev, stopReason: value }))}\n            >\n              {stopReasons.map(reason => (\n                <Radio key={reason.value} value={reason.value}>\n                  {reason.label}\n                </Radio>\n              ))}\n            </Radio.Group>\n          </View>\n        </View>\n      </Dialog>\n\n      {/* 暂停充电确认对话框 */}\n      <Dialog\n        visible={state.showPauseDialog}\n        title=\"确认暂停充电\"\n        content=\"确定要暂停当前充电会话吗？可以随时恢复充电。\"\n        onClose={() => setState(prev => ({ ...prev, showPauseDialog: false }))}\n        onCancel={() => setState(prev => ({ ...prev, showPauseDialog: false }))}\n        onConfirm={confirmPauseCharging}\n      />\n\n      {/* 紧急停止确认对话框 */}\n      <Dialog\n        visible={state.showEmergencyDialog}\n        title=\"⚠️ 紧急停止充电\"\n        onClose={() => setState(prev => ({ ...prev, showEmergencyDialog: false }))}\n        onCancel={() => setState(prev => ({ ...prev, showEmergencyDialog: false }))}\n        onConfirm={confirmEmergencyStop}\n      >\n        <View className=\"emergency-dialog-content\">\n          <Text className=\"dialog-text warning\">\n            紧急停止将立即中断充电过程，可能对设备造成影响。\n          </Text>\n          <Text className=\"dialog-text\">\n            请确认是否遇到紧急情况需要立即停止？\n          </Text>\n        </View>\n      </Dialog>\n\n      {/* 充电设置对话框 */}\n      <Popup\n        visible={state.showSettingsDialog}\n        position=\"bottom\"\n        onClose={() => setState(prev => ({ ...prev, showSettingsDialog: false }))}\n        className=\"settings-popup\"\n      >\n        <View className=\"settings-content\">\n          <View className=\"settings-header\">\n            <Text className=\"settings-title\">充电设置</Text>\n            <Icon \n              name=\"close\" \n              size=\"20\" \n              onClick={() => setState(prev => ({ ...prev, showSettingsDialog: false }))}\n            />\n          </View>\n          \n          <View className=\"settings-form\">\n            <View className=\"form-item\">\n              <Text className=\"form-label\">目标电量 (%)</Text>\n              <Input\n                type=\"number\"\n                value={String(state.settings.targetSoc || '')}\n                onChange={(value) => setState(prev => ({\n                  ...prev,\n                  settings: { ...prev.settings, targetSoc: Number(value) }\n                }))}\n                placeholder=\"请输入目标电量\"\n              />\n            </View>\n            \n            <View className=\"form-item\">\n              <Text className=\"form-label\">最大电量 (kWh)</Text>\n              <Input\n                type=\"number\"\n                value={String(state.settings.maxEnergy || '')}\n                onChange={(value) => setState(prev => ({\n                  ...prev,\n                  settings: { ...prev.settings, maxEnergy: Number(value) }\n                }))}\n                placeholder=\"请输入最大充电量\"\n              />\n            </View>\n            \n            <View className=\"form-item\">\n              <Text className=\"form-label\">费用上限 (元)</Text>\n              <Input\n                type=\"number\"\n                value={String(state.settings.maxCost || '')}\n                onChange={(value) => setState(prev => ({\n                  ...prev,\n                  settings: { ...prev.settings, maxCost: Number(value) }\n                }))}\n                placeholder=\"请输入费用上限\"\n              />\n            </View>\n            \n            <View className=\"form-item\">\n              <Text className=\"form-label\">功率限制 (kW)</Text>\n              <Input\n                type=\"number\"\n                value={String(state.settings.powerLimit || '')}\n                onChange={(value) => setState(prev => ({\n                  ...prev,\n                  settings: { ...prev.settings, powerLimit: Number(value) }\n                }))}\n                placeholder=\"请输入功率限制\"\n              />\n            </View>\n            \n            <View className=\"form-item switch-item\">\n              <Text className=\"form-label\">自动停止</Text>\n              <Switch\n                checked={state.settings.autoStop}\n                onChange={(checked) => setState(prev => ({\n                  ...prev,\n                  settings: { ...prev.settings, autoStop: checked }\n                }))}\n              />\n            </View>\n          </View>\n          \n          <View className=\"settings-actions\">\n            <NutButton\n              type=\"default\"\n              onClick={() => setState(prev => ({ ...prev, showSettingsDialog: false }))}\n            >\n              取消\n            </NutButton>\n            <NutButton\n              type=\"primary\"\n              onClick={confirmUpdateSettings}\n              loading={state.isProcessing}\n            >\n              确认更新\n            </NutButton>\n          </View>\n        </View>\n      </Popup>\n    </View>\n  );\n};\n\nexport default ChargingControl;