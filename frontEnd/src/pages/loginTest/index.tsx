import React, { useState } from 'react';
import { View, Text, Button, Input } from '@tarojs/components';
import { post } from '../../utils/request';
import './index.scss';

export default function LoginTest() {
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-10), logMessage]); // 只保留最后10条日志
  };

  const handleSendCode = async () => {
    if (!phone) {
      addLog('❌ 请输入手机号');
      return;
    }

    addLog('📤 开始发送验证码...');
    setLoading(true);

    try {
      const response = await post('/auth/send-verify-code', { phone });
      addLog(`📥 验证码响应: ${JSON.stringify(response)}`);
      
      if (response.success) {
        addLog('✅ 验证码发送成功');
        if (response.data?.code) {
          addLog(`🔢 开发环境验证码: ${response.data.code}`);
          setVerifyCode(response.data.code);
        }
      } else {
        addLog(`❌ 验证码发送失败: ${response.message}`);
      }
    } catch (error: any) {
      addLog(`💥 验证码发送异常: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!phone || !verifyCode) {
      addLog('❌ 请填写手机号和验证码');
      return;
    }

    addLog('🔐 开始登录...');
    setLoading(true);

    try {
      const response = await post('/auth/login-with-code', {
        phone,
        verifyCode
      });
      
      addLog(`📥 登录响应: ${JSON.stringify(response)}`);
      
      if (response.success) {
        addLog('🎉 登录成功！');
      } else {
        addLog(`❌ 登录失败: ${response.message}`);
      }
    } catch (error: any) {
      addLog(`💥 登录异常: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <View className='login-test'>
      <View className='header'>
        <Text className='title'>登录测试页面</Text>
      </View>

      <View className='form'>
        <View className='input-group'>
          <Text className='label'>手机号:</Text>
          <Input
            className='input'
            type='number'
            placeholder='请输入手机号'
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>

        <View className='input-group'>
          <Text className='label'>验证码:</Text>
          <Input
            className='input'
            type='number'
            placeholder='请输入验证码'
            value={verifyCode}
            onInput={(e) => setVerifyCode(e.detail.value)}
          />
        </View>

        <View className='button-group'>
          <Button 
            className='btn btn-secondary'
            onClick={handleSendCode}
            disabled={loading}
          >
            {loading ? '发送中...' : '发送验证码'}
          </Button>
          
          <Button 
            className='btn btn-primary'
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </View>
      </View>

      <View className='logs'>
        <View className='logs-header'>
          <Text className='logs-title'>调试日志</Text>
          <Button className='btn-clear' onClick={clearLogs}>清空</Button>
        </View>
        <View className='logs-content'>
          {logs.map((log, index) => (
            <Text key={index} className='log-item'>{log}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}
