import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import '@nutui/nutui-react-taro/dist/style.css'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('智能充电应用启动')
    // 初始化应用配置
    console.log('应用版本:', '1.0.0')
    console.log('构建环境:', process.env.NODE_ENV)
  })

  // children 是将要会渲染的页面
  return children
}

export default App
