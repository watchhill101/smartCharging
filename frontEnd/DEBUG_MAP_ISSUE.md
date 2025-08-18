# 地图双标记问题调试指南

## 问题描述
手机端地图页面只显示一个蓝色标记（我的位置），没有显示红色标记（充电站位置）。

## 调试步骤

### 1. 检查控制台日志
在手机端打开地图页面，查看控制台是否有以下日志：

#### 地图页面日志
```
[Map] 初始化坐标数据: {...}
[Map] 初始化站点数据: {...}
[Map] 当前状态: { coord: {...}, stationInfo: {...} }
[Map] 开始解析参数...
[Map] 路由参数: {...}
[Map] 最终解析结果: { lng: ..., lat: ..., station: {...} }
```

#### Device组件日志
```
[Device] 开始初始化地图标记...
[Device] 当前props: { initialCoord: {...}, stationInfo: {...} }
[Device] 添加充电站标记: { coord: {...}, title: "..." }
[Device] 添加我的位置标记: { lng: ..., lat: ..., title: "..." }
[Device] 开始调整地图视野...
[Device] 总标记数量: 2
```

### 2. 检查数据传递

#### 从充电站详情跳转时
1. 在充电站详情页面点击"导航"按钮
2. 检查控制台是否有以下日志：
   ```
   地图数据已保存到Taro存储
   地图数据已保存到浏览器localStorage
   ```

#### 检查存储数据
在浏览器控制台执行：
```javascript
// 检查坐标数据
console.log('map_target_coord:', localStorage.getItem('map_target_coord'))
console.log('map_target_station:', localStorage.getItem('map_target_station'))

// 或者使用Taro存储（如果可用）
if (typeof Taro !== 'undefined' && Taro.getStorageSync) {
  console.log('Taro map_target_coord:', Taro.getStorageSync('map_target_coord'))
  console.log('Taro map_target_station:', Taro.getStorageSync('map_target_station'))
}
```

### 3. 常见问题排查

#### 问题1：数据没有保存到存储
**症状**：控制台没有"地图数据已保存"的日志
**原因**：充电站详情页面的handleNavigate函数没有正确执行
**解决**：检查充电站详情页面的导航按钮点击事件

#### 问题2：数据保存了但没有读取到
**症状**：有保存日志，但地图页面没有读取到数据
**原因**：存储键名不匹配或数据格式错误
**解决**：检查存储键名和数据格式

#### 问题3：数据读取到了但没有创建标记
**症状**：有数据但地图上没有标记
**原因**：Device组件的标记创建逻辑有问题
**解决**：检查initializeMapMarkers函数和addStationMarker函数

#### 问题4：标记创建了但没有显示
**症状**：有创建日志但地图上看不到
**原因**：标记的zIndex或样式问题
**解决**：检查标记的zIndex设置和CSS样式

### 4. 手动测试

#### 测试1：直接设置存储数据
在控制台手动设置测试数据：
```javascript
// 设置测试坐标（保定市）
localStorage.setItem('map_target_coord', JSON.stringify({
  lng: 115.480656,
  lat: 38.877012
}))

// 设置测试站点信息
localStorage.setItem('map_target_station', JSON.stringify({
  name: '测试充电站',
  address: '河北省保定市测试地址',
  distance: 1000,
  rating: 4.5
}))

// 刷新页面
location.reload()
```

#### 测试2：检查地图实例
在控制台检查地图是否正确初始化：
```javascript
// 检查地图容器
console.log('地图容器:', document.getElementById('map-container'))

// 检查高德地图API
console.log('AMap API:', window.AMap)

// 检查地图实例
// 在Device组件中添加的mapRef.current
```

### 5. 环境检测

#### 检查Taro环境
```javascript
console.log('TARO_ENV:', process.env.TARO_ENV)
console.log('是否H5环境:', process.env.TARO_ENV === 'h5')
```

#### 检查高德地图配置
```javascript
console.log('高德地图安全配置:', window._AMapSecurityConfig)
console.log('高德地图API Key:', 'fe211b3e07c4e9b86b16adfd57925547')
```

### 6. 修复建议

#### 如果数据传递有问题
1. 检查充电站详情页面的导航函数
2. 确保存储键名一致
3. 验证数据格式正确

#### 如果标记创建有问题
1. 检查地图实例是否正确初始化
2. 验证高德地图API是否加载成功
3. 检查标记的DOM元素是否正确创建

#### 如果标记显示有问题
1. 检查zIndex设置
2. 验证标记位置计算
3. 检查CSS样式和层级

## 预期结果
修复成功后，地图页面应该显示：
1. 两个信息卡片：
   - 我的位置（蓝色，上面）
   - 充电站信息（红色，下面）
2. 两个地图标记：
   - 蓝色标记（我的位置）
   - 红色标记（充电站位置）
3. 地图视野自动调整以显示两个标记

## 联系支持
如果问题仍然存在，请提供：
1. 控制台完整日志
2. 手机端环境信息
3. 具体的操作步骤
4. 错误截图
