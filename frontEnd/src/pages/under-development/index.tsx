import { View, Text, Button } from '@tarojs/components';
import { useState } from 'react';
import { useLoad } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import './index.scss';

export default function UnderDevelopment() {
  const [functionName, setFunctionName] = useState<string>('');

  useLoad(() => {
    console.log('🚧 功能开发中页面加载');
    
    // 从URL参数中获取功能名称
    try {
      const pages = Taro.getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const options = currentPage.options;
      
      if (options.functionName) {
        const decodedName = decodeURIComponent(options.functionName);
        console.log('📝 获取到功能名称:', decodedName);
        setFunctionName(decodedName);
      }
    } catch (error) {
      console.error('❌ 获取功能名称失败:', error);
    }
  });

  const handleGoBack = () => {
    console.log('⬅️ 返回上一页');
    Taro.navigateBack();
  };

  const handleGoHome = () => {
    console.log('🏠 回到首页');
    Taro.switchTab({
      url: '/pages/index/index'
    });
  };

  return (
    <View className='under-development-page'>
      {/* 头部导航栏 */}
      <View className='header-navbar'>
        <View className='navbar-left' onClick={handleGoBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <View className='navbar-center'>
          <Text className='navbar-title'>{functionName || '功能开发中'}</Text>
        </View>
        <View className='navbar-right'>
          <View className='home-button' onClick={handleGoHome}>
            <Text className='home-icon'>🏠</Text>
          </View>
        </View>
      </View>

      {/* 主要内容区域 */}
      <View className='main-content'>
        {/* 开发中图标 */}
        <View className='development-illustration'>
          <View className='construction-icon'>🚧</View>
        </View>

        {/* 标题和描述 */}
        <View className='content-text'>
          <Text className='main-title'>功能开发中</Text>
          <Text className='sub-title'>
            {functionName ? `${functionName}功能` : '该功能'}正在紧锣密鼓地开发中
          </Text>
          <Text className='description'>
            我们的开发团队正在努力完善这个功能，为您提供更好的用户体验。
            敬请期待！
          </Text>
        </View>

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <Button className='action-btn primary' onClick={handleGoBack}>
            <Text className='btn-text'>返回上一页</Text>
          </Button>
          <Button className='action-btn secondary' onClick={handleGoHome}>
            <Text className='btn-text'>回到首页</Text>
          </Button>
        </View>

        {/* 调试信息 */}
        <View className='debug-info'>
          <Text className='debug-text'>调试信息:</Text>
          <Text className='debug-text'>功能名称: {functionName || '未获取到'}</Text>
          <Text className='debug-text'>页面路径: /pages/under-development/index</Text>
        </View>
      </View>
    </View>
  );
} 