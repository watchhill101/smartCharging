// 首先加载Taro API Polyfill
import "./utils/taroPolyfill";

import { PropsWithChildren, useEffect } from "react";
import { useLaunch } from "@tarojs/taro";
import { env } from "./utils/platform";
import { NotificationProvider } from "./contexts/NotificationContext";
import { initPerformanceOptimization, cleanupPerformanceOptimization } from "./utils/performanceInit";
import "./app.scss";
import './utils/fontawesome'

function App({ children }: PropsWithChildren<any>) {
  
  // 全局错误处理和清理
  useEffect(() => {
    // 捕获未处理的Promise错误
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('未处理的Promise错误:', event.reason);
      event.preventDefault();
    };

    // 捕获全局错误
    const handleError = (event: ErrorEvent) => {
      console.error('全局错误:', event.error);
    };

    // 页面卸载时清理性能优化资源
    const handleBeforeUnload = () => {
      if (process.env.TARO_ENV === 'h5') {
        cleanupPerformanceOptimization();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      window.addEventListener('error', handleError);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('error', handleError);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        // 组件卸载时也清理资源
        if (process.env.TARO_ENV === 'h5') {
          cleanupPerformanceOptimization();
        }
      };
    }
  }, []);
  
  useLaunch(async () => {
    // 初始化应用配置
    console.log('🚀 启动智能充电应用...');
    
    try {
      // 初始化性能优化（仅在H5环境）
      if (process.env.TARO_ENV === 'h5') {
        console.log('🔧 初始化H5性能优化...');
        await initPerformanceOptimization();
      }
      
      // 在小程序环境中给出提示，表明已禁用可能导致问题的功能
      if (env.isMiniProgram) {
        console.log('📱 小程序环境兼容模式');
        // 小程序环境兼容模式
      }
      
      console.log('✅ 应用初始化完成');
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
    }
  });

  // children 是将要会渲染的页面
  return (
    <NotificationProvider>
      {children}
    </NotificationProvider>
  );
}

export default App;
