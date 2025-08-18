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
      port: 10086,      // 修改前端端口避免与后端冲突
      open: false,      // 不自动打开浏览器
      strictPort: true, // 严格端口模式
      cors: true,       // 启用CORS
      https: {
        key: fs.readFileSync(path.join(__dirname, '../cert/key.pem')),
        cert: fs.readFileSync(path.join(__dirname, '../cert/cert.pem'))
      },
      proxy: {
        "/api/": {
          target: 'http://localhost:8080',  // 后端实际端口8080
          changeOrigin: true,
          secure: false,
          pathRewrite: {
            '^/api': '/api'
          }
        }
      }
    }
  }
} satisfies UserConfigExport<'vite'>