import { View, Text, Button } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import './index.scss';

export default function TestJump() {
  useLoad(() => {
    console.log('🧪 测试跳转页面加载');
  });

  const handleGoBack = () => {
    Taro.navigateBack();
  };

  const handleTestJump = () => {
    console.log('🧪 测试跳转到功能开发中页面');
    Taro.navigateTo({
      url: '/pages/under-development/index?functionName=测试功能',
      success: () => {
        console.log('✅ 测试跳转成功');
      },
      fail: (error) => {
        console.error('❌ 测试跳转失败:', error);
        Taro.showToast({
          title: '跳转失败',
          icon: 'error'
        });
      }
    });
  };

  return (
    <View className='test-jump-page'>
      <View className='header'>
        <Text className='title'>测试跳转页面</Text>
        <Button className='back-btn' onClick={handleGoBack}>返回</Button>
      </View>
      
      <View className='content'>
        <Text className='description'>这是一个测试页面，用于验证页面跳转功能</Text>
        
        <Button className='test-btn' onClick={handleTestJump}>
          测试跳转到功能开发中页面
        </Button>
        
        <View className='info'>
          <Text className='info-text'>如果跳转成功，说明路由配置正确</Text>
          <Text className='info-text'>如果跳转失败，请检查控制台错误信息</Text>
        </View>
      </View>
    </View>
  );
} 