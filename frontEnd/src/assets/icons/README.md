# 图标资源说明

此目录用于存放应用中使用的图标文件。

## 需要的图标文件

### 底部导航图标
- `home.png` - 首页图标（未选中）
- `home-active.png` - 首页图标（选中）
- `map.png` - 地图图标（未选中）
- `map-active.png` - 地图图标（选中）
- `charging.png` - 充电图标（未选中）
- `charging-active.png` - 充电图标（选中）
- `profile.png` - 个人中心图标（未选中）
- `profile-active.png` - 个人中心图标（选中）

### 功能图标
- `location.png` - 定位图标
- `search.png` - 搜索图标
- `filter.png` - 筛选图标
- `qr-code.png` - 二维码图标
- `charging-station.png` - 充电站图标
- `fast-charging.png` - 快充图标
- `slow-charging.png` - 慢充图标

## 图标规格要求

- 格式：PNG（支持透明背景）
- 尺寸：建议 64x64px 或 128x128px
- 颜色：未选中状态使用灰色 (#999999)，选中状态使用主题色 (#1890ff)

## 使用方法

```typescript
// 在组件中引用图标
import homeIcon from '@/assets/icons/home.png'

// 在Taro组件中使用
<Image src={homeIcon} className="icon" />
```

## 注意事项

1. 图标文件名请严格按照上述命名规范
2. 确保图标在不同设备上显示清晰
3. 建议使用矢量图标或高分辨率位图
4. 图标设计应符合应用整体风格