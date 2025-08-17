import type { UserConfigExport } from "@tarojs/cli"
import fs from 'fs'
import path from 'path'

export default {
  logger: {
    quiet: false,
    stats: true
  },
  mini: {},
  h5: {
    devServer: {
      host: '0.0.0.0',  // 允许外部访问
      port: 8000,       // 指定端口
      open: false,      // 不自动打开浏览器
      strictPort: true, // 严格端口模式
      cors: true,       // 启用CORS
      https: {
        key: fs.readFileSync(path.join(__dirname, '../cert/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '../cert/cert.pem'))
      },
      proxy: {
        "/v1_0/auth": {
          target: 'http://localhost:8080',  // 代理到后端服务
          changeOrigin: true,
          rewrite: (path) => path.replace('/v1_0/auth', '')
        }
      }
    }
  }
} satisfies UserConfigExport<'vite'>
