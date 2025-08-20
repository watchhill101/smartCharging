import React, { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button as NutButton, Toast } from '@nutui/nutui-react-taro';
import QRScanner, { ScanResult } from '../../components/QRScanner';
import { TaroHelper } from '../../utils/taroHelpers';
import './index.scss'
import { TIME_CONSTANTS } from '../../utils/constants';

interface ScanPageState {
  showScanner: boolean;
  scanHistory: ScanResult[];
  currentResult: ScanResult | null;
}

const ScanPage: React.FC = () => {
  const [state, setState] = useState<ScanPageState>({
    showScanner: false,
    scanHistory: [],
    currentResult: null
  });

  // 开始扫描
  const handleStartScan = useCallback(() => {
    setState(prev => ({ ...prev, showScanner: true }));
  }, []);

  // 扫描成功
  const handleScanSuccess = useCallback((result: ScanResult) => {
    console.log('📱 扫描成功:', result);
    
    setState(prev => ({
      ...prev,
      showScanner: false,
      currentResult: result,
      scanHistory: [result, ...prev.scanHistory.slice(0, 9)] // 保留最近10条记录
    }));

    // 根据扫描结果类型进行不同处理
    if (result.scanType === 'manual' || isChargingPileCode(result.result)) {
      // 充电桩编号，跳转到充电页面
      handleChargingPileScanned(result.result);
    } else if (isURL(result.result)) {
      // URL链接，询问是否打开
      handleURLScanned(result.result);
    } else {
      // 其他类型，显示结果
      Toast.show({
        content: `扫描到内容: ${result.result}`,
        type: 'success',
        duration: TIME_CONSTANTS.THREE_SECONDS
      });
    }
  }, []);

  // 扫描失败
  const handleScanError = useCallback((error: string) => {
    console.error('❌ 扫描失败:', error);
    
    Toast.show({
      content: error,
      type: 'error',
      duration: 2000
    });
  }, []);

  // 关闭扫描器
  const handleCloseScanner = useCallback(() => {
    setState(prev => ({ ...prev, showScanner: false }));
  }, []);

  // 处理充电桩扫描
  const handleChargingPileScanned = useCallback((pileCode: string) => {
    TaroHelper.showModal({
      title: '确认充电',
      content: `检测到充电桩编号: ${pileCode}，是否开始充电？`,
      confirmText: '开始充电',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转到充电页面
          Taro.navigateTo({
            url: `/pages/charging/index?pileCode=${pileCode}&source=scan`
          }).catch(error => {
            console.error('❌ 跳转充电页面失败:', error);
            Toast.show({
              content: '跳转失败，请重试',
              type: 'error',
              duration: TIME_CONSTANTS.TWO_SECONDS
            });
          });
        }
      }
    });
  }, []);

  // 处理URL扫描
  const handleURLScanned = useCallback((url: string) => {
    TaroHelper.showModal({
      title: '打开链接',
      content: `检测到链接: ${url}，是否打开？`,
      confirmText: '打开',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 在小程序中打开网页
          Taro.navigateTo({
            url: `/pages/webview/index?url=${encodeURIComponent(url)}`
          }).catch(error => {
            console.error('❌ 打开链接失败:', error);
            Toast.show({
              content: '打开链接失败',
              type: 'error',
              duration: 2000
            });
          });
        }
      }
    });
  }, []);

  // 重新扫描
  const handleRescan = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      showScanner: true, 
      currentResult: null 
    }));
  }, []);

  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    TaroHelper.showModal({
      title: '清空历史',
      content: '确定要清空所有扫描历史记录吗？',
      confirmText: '清空',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          setState(prev => ({ ...prev, scanHistory: [] }));
          Toast.show({
            content: '历史记录已清空',
            type: 'success',
            duration: 1500
          });
        }
      }
    });
  }, []);

  // 处理历史记录点击
  const handleHistoryItemClick = useCallback((result: ScanResult) => {
    setState(prev => ({ ...prev, currentResult: result }));
    
    if (isChargingPileCode(result.result)) {
      handleChargingPileScanned(result.result);
    } else if (isURL(result.result)) {
      handleURLScanned(result.result);
    }
  }, [handleChargingPileScanned, handleURLScanned]);

  // 判断是否为充电桩编号
  const isChargingPileCode = (text: string): boolean => {
    // 充电桩编号格式：字母+数字，如 A001, BC123 等
    const pilePattern = /^[A-Z]{1,3}\d{2,6}$/i;
    return pilePattern.test(text);
  };

  // 判断是否为URL
  const isURL = (text: string): boolean => {
    const urlPattern = /^https?:\/\/.+/i;
    return urlPattern.test(text);
  };

  // 格式化扫描时间
  const formatScanTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) { // 24小时内
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View className="scan-page">
      {/* 主要内容区域 */}
      <View className="scan-container">
        {/* 页面标题 */}
        <View className="page-header">
          <Text className="page-title">扫码充电</Text>
          <Text className="page-subtitle">扫描充电桩二维码开始充电</Text>
        </View>

        {/* 扫描按钮区域 */}
        <View className="scan-main">
          <View className="scan-icon-container">
            <View className="scan-icon">📱</View>
            <View className="scan-animation">
              <View className="scan-line" />
            </View>
          </View>
          
          <NutButton
            type="primary"
            size="large"
            onClick={handleStartScan}
            className="scan-btn"
          >
            🔍 开始扫描
          </NutButton>
          
          <Text className="scan-tip">
            将充电桩二维码对准扫描框，即可快速开始充电
          </Text>
        </View>

        {/* 当前扫描结果 */}
        {state.currentResult && (
          <View className="current-result">
            <View className="result-header">
              <Text className="result-title">最近扫描</Text>
              <NutButton
                type="primary"
                size="mini"
                onClick={handleRescan}
                className="rescan-btn"
              >
                重新扫描
              </NutButton>
            </View>
            
            <View className="result-content">
              <View className="result-info">
                <Text className="result-type">
                  {state.currentResult.scanType === 'manual' ? '手动输入' : 
                   isChargingPileCode(state.currentResult.result) ? '充电桩' :
                   isURL(state.currentResult.result) ? '网页链接' : '其他'}
                </Text>
                <Text className="result-text">{state.currentResult.result}</Text>
              </View>
              
              {isChargingPileCode(state.currentResult.result) && (
                <NutButton
                  type="success"
                  size="small"
                  onClick={() => handleChargingPileScanned(state.currentResult!.result)}
                  className="action-btn"
                >
                  开始充电
                </NutButton>
              )}
            </View>
          </View>
        )}

        {/* 扫描历史 */}
        {state.scanHistory.length > 0 && (
          <View className="scan-history">
            <View className="history-header">
              <Text className="history-title">扫描历史</Text>
              <NutButton
                type="default"
                size="mini"
                onClick={handleClearHistory}
                className="clear-btn"
              >
                清空
              </NutButton>
            </View>
            
            <View className="history-list">
              {state.scanHistory.map((item, index) => (
                <View
                  key={`${item.result}_${index}`}
                  className="history-item"
                  onClick={() => handleHistoryItemClick(item)}
                >
                  <View className="history-content">
                    <View className="history-type">
                      {item.scanType === 'manual' ? '📝' : 
                       isChargingPileCode(item.result) ? '⚡' :
                       isURL(item.result) ? '🔗' : '📄'}
                    </View>
                    <View className="history-info">
                      <Text className="history-text">{item.result}</Text>
                      <Text className="history-time">
                        {formatScanTime(Date.now() - index * 60000)} {/* 模拟时间 */}
                      </Text>
                    </View>
                  </View>
                  <View className="history-arrow">›</View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 功能说明 */}
        <View className="feature-tips">
          <Text className="tips-title">功能说明</Text>
          <View className="tips-list">
            <View className="tip-item">
              <Text className="tip-icon">📷</Text>
              <Text className="tip-text">支持相机扫描和相册识别</Text>
            </View>
            <View className="tip-item">
              <Text className="tip-icon">⌨️</Text>
              <Text className="tip-text">支持手动输入充电桩编号</Text>
            </View>
            <View className="tip-item">
              <Text className="tip-icon">💡</Text>
              <Text className="tip-text">暗光环境可开启闪光灯</Text>
            </View>
            <View className="tip-item">
              <Text className="tip-icon">🔗</Text>
              <Text className="tip-text">支持扫描网页链接和其他内容</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 二维码扫描器 */}
      <QRScanner
        visible={state.showScanner}
        scanType="all"
        continuous={false}
        showGallery={true}
        showManualInput={true}
        showFlashlight={true}
        onScanSuccess={handleScanSuccess}
        onScanError={handleScanError}
        onClose={handleCloseScanner}
        text={{
          title: '扫描二维码',
          tip: '将二维码放入框内，即可自动扫描',
          gallery: '相册',
          manual: '手动输入',
          flashlight: '闪光灯',
          inputPlaceholder: '请输入充电桩编号',
          inputConfirm: '确认',
          inputCancel: '取消'
        }}
      />
    </View>
  );
};

export default ScanPage;
