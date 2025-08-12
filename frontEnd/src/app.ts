import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { env } from './utils/platform'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('智能充电应用启动')
    // 初始化应用配置
    console.log('应用版本:', '1.0.0')
    console.log('构建环境:', process.env.NODE_ENV)
    console.log('运行平台:', env.getPlatform())
    
    // 在小程序环境中给出提示，表明已禁用可能导致问题的功能
    if (env.isMiniProgram) {
      console.log('小程序环境：已启用兼容模式，禁用动态组件功能')
    }
  })

  // children 是将要会渲染的页面
  return children
}

export default App
