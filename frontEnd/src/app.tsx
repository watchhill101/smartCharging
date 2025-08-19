// 首先加载Taro API Polyfill
import "./utils/taroPolyfill";

import { PropsWithChildren, useEffect } from "react";
import { useLaunch } from "@tarojs/taro";
import { env } from "./utils/platform";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./app.scss";
import './utils/fontawesome'

function App({ children }: PropsWithChildren<any>) {
  
  // 全局错误处理
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

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      window.addEventListener('error', handleError);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('error', handleError);
      };
    }
  }, []);
  
  useLaunch(() => {
    console.log("智能充电应用启动");
    // 初始化应用配置
    console.log("应用版本:", "1.0.0");
    console.log("构建环境:", process.env.NODE_ENV);
    console.log("运行平台:", env.getPlatform());

    // 在小程序环境中给出提示，表明已禁用可能导致问题的功能
    if (env.isMiniProgram) {
      console.log("小程序环境：已启用兼容模式，禁用动态组件功能");
    }

    // H5环境特殊处理
    if (process.env.TARO_ENV === 'h5') {
      console.log("H5环境：已启用浏览器兼容模式");
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
