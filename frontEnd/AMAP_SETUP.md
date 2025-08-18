# 高德地图API配置说明

## 获取API密钥

1. 访问 [高德开放平台](https://lbs.amap.com/dev/key/app)
2. 注册/登录账号
3. 创建新应用
4. 选择"Web端(JS API)"平台
5. 获取API密钥

## 配置步骤

1. 打开 `src/utils/constants.ts` 文件
2. 找到 `AMAP_CONFIG.API_KEY` 配置项
3. 将 `your_amap_key_here` 替换为你的实际API密钥

```typescript
export const AMAP_CONFIG = {
  API_KEY: '你的实际API密钥'
}
```

## 注意事项

- API密钥是敏感信息，不要提交到公共代码仓库
- 建议在 `.gitignore` 中添加配置文件
- 生产环境请使用环境变量管理API密钥

## 功能说明

配置完成后，城市选择器的"重新定位"功能将能够：
1. 获取用户当前位置
2. 通过逆地理编码获取城市名称
3. 自动更新当前城市
4. 显示定位成功提示 