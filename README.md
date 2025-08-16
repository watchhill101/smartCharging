# smartCharging

## 开发环境配置

### 前端开发服务器HTTPS配置

#### 依赖要求

在配置HTTPS开发服务器之前，请确保安装以下依赖：

```bash
# 开发依赖
npm install --save-dev node-forge    # 用于生成SSL证书
npm install --save-dev cross-env     # 用于设置环境变量（如果尚未安装）

# Taro相关依赖（如果尚未安装）
npm install @tarojs/cli
npm install @tarojs/plugin-html
npm install @tarojs/plugin-generator
```

为了支持地理位置、摄像头等需要安全上下文的API，我们为前端开发服务器启用了HTTPS。

#### 1. 证书生成

我们使用Node.js的node-forge库生成自签名SSL证书：

```javascript
// 在frontEnd目录下创建generate-cert.js
const fs = require('fs');
const forge = require('node-forge');

// 创建一个证书
const generateCertificate = () => {
  console.log('生成自签名证书...');
  
  // 生成一对公钥/私钥
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // 创建证书
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  // 设置证书信息
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'CN' },
    { name: 'localityName', value: 'LocalCity' },
    { name: 'organizationName', value: 'DevOrg' },
    { name: 'organizationalUnitName', value: 'Dev' }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  // 设置扩展
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' }
      ]
    }
  ]);
  
  // 使用私钥对证书进行签名
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  // 将证书和私钥转换为PEM格式
  const certPem = forge.pki.certificateToPem(cert);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  
  // 确保cert目录存在
  if (!fs.existsSync('./cert')) {
    fs.mkdirSync('./cert');
  }
  
  // 保存证书和私钥到文件
  fs.writeFileSync('./cert/cert.pem', certPem);
  fs.writeFileSync('./cert/key.pem', privateKeyPem);
  
  console.log('证书生成完成！');
};

generateCertificate();
```

运行脚本生成证书：
```bash
cd frontEnd
npm install --save-dev node-forge
node generate-cert.js
```

#### 2. 配置开发服务器

在`frontEnd/config/dev.ts`中添加HTTPS配置：

```typescript
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
        "/v1_0/": {
          target: 'http://localhost:8080',  // 代理到后端服务
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/v1_0/, '')
        }
      }
    }
  }
} satisfies UserConfigExport<'vite'>
```

#### 3. 更新.gitignore

将证书文件添加到`.gitignore`中：

```
cert/*.pem
cert/*.pfx
```

#### 4. 启动HTTPS开发服务器

```bash
cd frontEnd
npm run dev:h5
```

服务器将在以下地址启动：
- https://localhost:8000/
- https://[本机IP]:8000/ (用于移动设备测试)

#### 5. 注意事项

1. **证书警告**：由于使用自签名证书，浏览器会显示不受信任的证书警告。点击"高级"选项继续访问即可。

2. **移动设备测试**：在同一网络下使用开发机IP地址访问，如：`https://192.168.x.x:8000`。

3. **WebSocket连接**：如果应用需要WebSocket连接，请使用WSS协议：`wss://localhost:8081`。

4. **微信小程序**：在微信开发者工具中设置允许不校验合法域名。

5. **证书更新**：证书有效期为一年，到期需重新生成。

6. **Windows PowerShell策略**：如果在Windows PowerShell中遇到脚本执行策略限制，可以临时调整执行策略：
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

#### 技术栈概览

此HTTPS配置适用于以下技术栈：

- **框架**：Taro + React
- **构建工具**：Vite
- **开发服务器**：Vite内置的开发服务器
- **代理配置**：已配置API代理到后端服务
- **SSL证书**：使用node-forge生成的自签名证书

#### 文件结构

```
frontEnd/
├── config/
│   ├── dev.ts               # 开发环境配置，包含HTTPS设置
│   ├── index.ts             # 基础配置
│   └── prod.ts              # 生产环境配置
├── cert/
│   ├── cert.pem             # SSL证书
│   └── key.pem              # 私钥
└── generate-cert.js         # 证书生成脚本
```

