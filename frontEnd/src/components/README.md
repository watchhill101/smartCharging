# 组件目录说明

此目录用于存放可复用的组件。

## 目录结构

```
components/
├── common/          # 通用组件
│   ├── Loading/     # 加载组件
│   ├── Empty/       # 空状态组件
│   └── ErrorBoundary/ # 错误边界组件
├── business/        # 业务组件
│   ├── StationCard/ # 充电站卡片
│   ├── ChargerItem/ # 充电桩项目
│   ├── MapMarker/   # 地图标记
│   └── ChargingStatus/ # 充电状态
└── form/           # 表单组件
    ├── SliderVerify/ # 滑块验证
    ├── FaceVerify/   # 人脸验证
    └── SearchBar/    # 搜索栏
```

## 组件开发规范

1. 每个组件应有独立的目录
2. 组件目录包含：
   - `index.tsx` - 组件主文件
   - `index.scss` - 组件样式
   - `types.ts` - 组件类型定义（如需要）
   - `README.md` - 组件说明文档

3. 组件命名使用 PascalCase
4. 组件应具有良好的类型定义
5. 组件应支持主题定制
6. 组件应具有合理的默认值

## 使用示例

```typescript
import StationCard from '@/components/business/StationCard'

// 在页面中使用
<StationCard 
  station={stationData}
  onSelect={handleStationSelect}
/>
```