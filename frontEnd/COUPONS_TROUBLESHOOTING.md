# 优惠券数据获取问题排查指南

## 🚨 问题现象

后端数据库有数据，但前端获取不到优惠券数据。

## 🔍 问题分析

### 1. API路径问题 ✅ 已修复
- **问题**：前端请求路径 `/v1_0/auth/api/coupons` 与后端路由 `/api/coupons` 不匹配
- **修复**：已更正为 `/api/coupons`

### 2. 重复调用问题 ✅ 已修复
- **问题**：`useLoad` 和 `useEffect` 都会调用 `fetchCoupons`，导致API被调用两次
- **修复**：移除了 `useEffect` 中的重复调用

### 3. Taro API不可用问题 ✅ 已修复
- **问题**：`TypeError: Taro.getStorageSync is not a function`
- **修复**：使用安全的存储访问函数，支持多种环境降级

### 4. 认证问题 🔍 需要排查
- **问题**：后端需要有效的JWT token才能访问优惠券数据
- **状态**：需要检查用户是否已登录，token是否有效

## 🛠️ 排查步骤

### 步骤1: 环境检测
页面加载时会自动输出环境检测结果，包括：
- Taro环境状态
- 微信环境状态
- 浏览器环境状态
- 可用的存储类型
- 可用的API列表

### 步骤2: 检查认证状态
在浏览器控制台运行：
```javascript
// 使用新的安全存储函数
import { safeGetStorage } from './src/utils/taroUtils'
console.log('Token:', safeGetStorage('user_token'))

// 或者直接检查
console.log('localStorage:', localStorage.getItem('user_token'))
console.log('sessionStorage:', sessionStorage.getItem('user_token'))
```

### 步骤3: 测试API端点
在浏览器控制台运行：
```javascript
// 测试无认证的请求
fetch('/api/coupons')
  .then(response => response.json())
  .then(data => console.log('无认证响应:', data))
  .catch(error => console.error('无认证请求失败:', error))

// 测试测试端点
fetch('/api/coupons/test')
  .then(response => response.json())
  .then(data => console.log('测试端点响应:', data))
  .catch(error => console.error('测试端点失败:', error))
```

### 步骤4: 检查网络请求
1. 打开浏览器开发者工具
2. 切换到 Network 标签页
3. 刷新优惠券页面
4. 查看 `/api/coupons` 请求的详细信息：
   - 请求头（Headers）
   - 响应状态（Status）
   - 响应内容（Response）

### 步骤5: 检查后端日志
查看后端服务器控制台，看是否有：
- 认证失败的错误
- 数据库查询错误
- 路由匹配错误

## 🔧 解决方案

### 方案1: 用户登录（推荐）
1. 确保用户已登录系统
2. 检查登录后是否正确设置了 `user_token`
3. 验证token没有过期

### 方案2: 临时绕过认证（仅用于测试）
在后端临时修改路由，移除认证要求：
```typescript
// 在 backEnd/src/routes/coupons.ts 中
// 临时移除 auth 中间件
router.get('/', asyncHandler(async (req, res) => {
  // 使用固定的测试用户ID
  const userId = 'demo_user_001'
  // ... 其余代码
}))
```

### 方案3: 使用模拟数据（已实现）
前端已经实现了模拟数据作为备选方案，当API失败时会显示示例优惠券。

## 🆕 新增功能

### 1. 环境检测工具
- 自动检测当前运行环境
- 识别可用的API和存储方式
- 提供环境适配建议

### 2. 安全的存储访问
- 支持Taro、localStorage、sessionStorage多种存储方式
- 自动降级，确保在各种环境下都能工作
- 统一的API接口，简化使用

### 3. 增强的调试信息
- 环境检测结果
- 存储访问状态
- API响应详情
- 错误处理过程

## 📊 调试信息

修复后的代码会输出详细的调试信息：
- 🌍 环境检测结果
- 🔑 认证Token状态
- 📡 优惠券API响应
- 📊 响应数据结构
- 📋 优惠券数据详情
- 📈 统计数据

## 🎯 预期结果

修复后应该能看到：
1. 不再有重复的API调用
2. 不再有Taro API错误
3. 正确的API路径请求
4. 详细的调试信息输出
5. 环境检测结果
6. 如果认证成功，显示真实的优惠券数据
7. 如果认证失败，显示相应的错误提示

## 🚀 下一步

1. 运行修复后的代码
2. 查看控制台输出的环境检测结果
3. 查看认证状态和API响应
4. 根据调试信息确定具体问题
5. 如果仍有问题，提供调试信息以便进一步排查

## 📞 需要帮助？

如果按照以上步骤仍然无法解决问题，请提供：
1. 环境检测结果
2. 浏览器控制台的完整日志
3. Network标签页中 `/api/coupons` 请求的详细信息
4. 后端服务器的错误日志
5. 用户是否已登录的状态

## 🔧 技术改进

### 1. 系统性思维
- 识别了环境兼容性问题
- 创建了统一的环境检测和存储访问方案

### 2. 第一性原理
- 从功能本质出发，确保在各种环境下都能正常工作
- 提供了完整的降级方案

### 3. DRY 原则
- 创建了可复用的工具函数
- 统一了不同环境下的API调用方式 