# 智能充电前端项目

基于 Taro + React + TypeScript + NutUI 开发的跨平台智能充电应用。

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 开发调试

```bash
# 微信小程序
npm run dev:weapp

# H5
npm run dev:h5

# 支付宝小程序
npm run dev:alipay

# 其他平台
npm run dev:swan    # 百度小程序
npm run dev:tt      # 字节跳动小程序
npm run dev:qq      # QQ小程序
npm run dev:jd      # 京东小程序
```

### 构建打包

```bash
# 微信小程序
npm run build:weapp

# H5
npm run build:h5

# 支付宝小程序
npm run build:alipay
```

## 📁 项目结构

```
src/
├── assets/          # 静态资源
│   └── icons/       # 图标文件
├── components/      # 可复用组件
│   ├── common/      # 通用组件
│   ├── business/    # 业务组件
│   └── form/        # 表单组件
├── pages/           # 页面文件
│   ├── index/       # 首页
│   ├── map/         # 地图页面
│   ├── charging/    # 充电页面
│   └── profile/     # 个人中心
├── types/           # 类型定义
├── utils/           # 工具函数
│   ├── constants.ts # 常量定义
│   ├── index.ts     # 通用工具
│   └── request.ts   # 网络请求
├── app.config.ts    # 应用配置
├── app.scss         # 全局样式
└── app.ts           # 应用入口
```

## 🛠️ 技术栈

- **框架**: Taro 4.x
- **语言**: TypeScript
- **UI库**: NutUI React Taro
- **样式**: Sass
- **构建**: Vite
- **代码规范**: ESLint + Stylelint + Husky

## 🎯 功能特性

- ✅ 跨平台支持（微信小程序、H5、支付宝小程序等）
- ✅ TypeScript 类型安全
- ✅ 组件化开发
- ✅ 统一的网络请求封装
- ✅ 完善的工具函数库
- ✅ 代码规范和Git工作流
- ✅ 环境变量配置
- ✅ 主题定制支持

## 📋 开发规范

### 代码规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Stylelint 规范
- 组件命名使用 PascalCase
- 文件命名使用 kebab-case
- 常量使用 UPPER_SNAKE_CASE

### 提交规范

使用 Conventional Commits 规范：

```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

### 组件开发

1. 每个组件应有独立目录
2. 包含 index.tsx、index.scss、types.ts（可选）
3. 具有良好的类型定义和默认值
4. 支持主题定制

## 🔧 配置说明

### 环境变量

在 `.env.*` 文件中配置环境变量：

- `TARO_APP_API_BASE_URL`: API基础URL
- `TARO_APP_WS_BASE_URL`: WebSocket基础URL
- `TARO_APP_AMAP_KEY`: 高德地图API Key
- `TARO_APP_DEBUG`: 调试模式
- `TARO_APP_LOG_LEVEL`: 日志级别

### 路径别名

已配置以下路径别名：

- `@/*`: src目录
- `@/components/*`: 组件目录
- `@/pages/*`: 页面目录
- `@/utils/*`: 工具目录
- `@/types/*`: 类型目录
- `@/assets/*`: 资源目录

## 📱 平台适配

### 微信小程序

- 支持微信小程序特有API
- 配置了小程序项目信息
- 支持分包加载

### H5

- 支持现代浏览器
- 响应式设计
- PWA支持（可选）

### 支付宝小程序

- 适配支付宝小程序API
- 支持支付宝特有功能

## 🚀 部署

### 微信小程序

1. 运行 `npm run build:weapp`
2. 使用微信开发者工具打开 `dist` 目录
3. 上传代码到微信小程序后台

### H5

1. 运行 `npm run build:h5`
2. 将 `dist` 目录部署到Web服务器

### 支付宝小程序

1. 运行 `npm run build:alipay`
2. 使用支付宝开发者工具打开 `dist` 目录
3. 上传代码到支付宝小程序后台

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。