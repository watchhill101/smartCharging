# StationDetail 充电站详情组件

## 概述

StationDetail 是一个功能完整的充电站详情展示组件，提供充电站的全面信息展示和交互功能。

## 功能特性

### 📋 信息展示

- **基本信息**: 充电站名称、地址、运营商、距离等
- **充电桩信息**: 充电桩列表、状态、类型、功率、价格等
- **服务设施**: 停车场、餐厅、WiFi 等配套服务
- **营业时间**: 营业状态、营业时间、高峰时段
- **用户评价**: 评分分布、用户评论统计
- **价格信息**: 服务费、电费价格区间
- **统计数据**: 使用次数、充电量、使用率等

### 🎯 交互功能

- **导航**: 一键打开地图导航到充电站
- **开始充电**: 选择充电桩开始充电流程
- **收藏**: 添加/取消收藏充电站
- **评分**: 为充电站进行星级评分
- **问题反馈**: 举报充电站相关问题
- **联系**: 拨打运营商或充电站电话
- **充电桩详情**: 查看单个充电桩的详细信息

### 🎨 界面特性

- **图片轮播**: 充电站环境图片展示
- **状态指示**: 实时显示充电桩可用状态
- **响应式设计**: 适配不同屏幕尺寸
- **深色模式**: 支持深色主题切换
- **加载状态**: 优雅的加载和错误状态处理

## 使用方法

### 基本用法

```tsx
import React from "react";
import StationDetail from "@/components/StationDetail";

const MyPage = () => {
  const stationData = {
    stationId: "station_001",
    name: "万达广场充电站",
    address: "北京市朝阳区建国路93号",
    // ... 其他数据
  };

  return (
    <StationDetail
      stationData={stationData}
      onNavigate={(station) => {
        // 处理导航
        console.log("导航到:", station.name);
      }}
      onStartCharging={(station, pile) => {
        // 处理开始充电
        console.log("开始充电:", pile.pileNumber);
      }}
    />
  );
};
```

### 完整配置

```tsx
<StationDetail
  stationId="station_001"
  stationData={stationData}
  loading={false}
  currentLocation={currentLocation}
  // 事件回调
  onNavigate={handleNavigate}
  onStartCharging={handleStartCharging}
  onFavorite={handleFavorite}
  onRate={handleRate}
  onReport={handleReport}
  onCall={handleCall}
  // 样式配置
  className="custom-station-detail"
/>
```

## API 接口

### Props

| 属性            | 类型                            | 默认值  | 说明           |
| --------------- | ------------------------------- | ------- | -------------- |
| stationId       | `string`                        | -       | 充电站 ID      |
| stationData     | `StationDetailData`             | -       | 充电站详情数据 |
| loading         | `boolean`                       | `false` | 加载状态       |
| currentLocation | `LocationInfo`                  | -       | 用户当前位置   |
| onNavigate      | `(station) => void`             | -       | 导航回调       |
| onStartCharging | `(station, pile) => void`       | -       | 开始充电回调   |
| onFavorite      | `(station, isFavorite) => void` | -       | 收藏回调       |
| onRate          | `(station, rating) => void`     | -       | 评分回调       |
| onReport        | `(station, issue) => void`      | -       | 举报回调       |
| onCall          | `(phoneNumber) => void`         | -       | 拨打电话回调   |
| className       | `string`                        | -       | 自定义样式类名 |

### 数据类型

#### StationDetailData

```typescript
interface StationDetailData {
  stationId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  city: string;
  district: string;
  province: string;

  operator: {
    name: string;
    phone: string;
    email?: string;
    website?: string;
  };

  piles: ChargingPile[];
  totalPiles: number;
  availablePiles: number;

  openTime: {
    start: string;
    end: string;
    is24Hours: boolean;
  };

  services: string[];

  priceRange: {
    minServicePrice: number;
    maxServicePrice: number;
    minElectricityPrice: number;
    maxElectricityPrice: number;
  };

  rating: {
    average: number;
    count: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };

  images: string[];
  description?: string;

  contact: {
    phone?: string;
    emergencyPhone?: string;
  };

  status: "active" | "inactive" | "maintenance" | "construction";
  isVerified: boolean;

  stats: {
    totalSessions: number;
    totalEnergy: number;
    averageSessionDuration: number;
    peakHours: string[];
  };

  occupancyRate?: number;
  isOpen?: boolean;
}
```

#### ChargingPile

```typescript
interface ChargingPile {
  pileId: string;
  pileNumber: string;
  type: "AC" | "DC" | "AC_DC";
  power: number;
  voltage: number;
  current: number;
  connectorType: string[];
  status: "available" | "occupied" | "offline" | "maintenance" | "reserved";
  price: {
    servicePrice: number;
    electricityPrice: number;
    parkingPrice?: number;
  };
  lastMaintenance?: string;
  manufacturer?: string;
  model?: string;
}
```

## 样式定制

### CSS 变量

```scss
.station-detail {
  // 主色调
  --primary-color: #1890ff;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;

  // 背景色
  --bg-color: #f5f5f5;
  --card-bg-color: #fff;

  // 文字颜色
  --text-color: #333;
  --text-secondary-color: #666;
  --text-disabled-color: #999;

  // 边框和分割线
  --border-color: #e9ecef;
  --divider-color: #f0f0f0;
}
```

### 自定义样式

```scss
.custom-station-detail {
  .station-info {
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .pile-card {
    &.available {
      border-color: var(--success-color);
      background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
    }
  }

  .action-buttons {
    .nav-btn {
      background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    }
  }
}
```

## 最佳实践

### 1. 数据预加载

```typescript
// 在页面加载时预加载充电站数据
useEffect(() => {
  const loadStationData = async () => {
    setLoading(true);
    try {
      const data = await stationService.getStationDetail(stationId);
      setStationData(data);
    } catch (error) {
      console.error("加载失败:", error);
    } finally {
      setLoading(false);
    }
  };

  loadStationData();
}, [stationId]);
```

### 2. 错误处理

```typescript
const handleStartCharging = async (station, pile) => {
  try {
    if (pile.status !== "available") {
      Toast.show({
        content: "该充电桩当前不可用",
        type: "warning",
      });
      return;
    }

    await chargingService.startCharging(station.stationId, pile.pileId);
    // 跳转到充电页面
  } catch (error) {
    Toast.show({
      content: "启动充电失败，请重试",
      type: "error",
    });
  }
};
```

### 3. 性能优化

```typescript
// 使用 React.memo 优化渲染性能
const StationDetail = React.memo<StationDetailProps>(({ ... }) => {
  // 使用 useCallback 缓存回调函数
  const handleNavigate = useCallback((station) => {
    onNavigate?.(station);
  }, [onNavigate]);

  // 使用 useMemo 缓存计算结果
  const availabilityRate = useMemo(() => {
    if (!stationData) return 0;
    return (stationData.availablePiles / stationData.totalPiles) * 100;
  }, [stationData]);

  // ...
});
```

### 4. 无障碍访问

```tsx
// 添加适当的 ARIA 标签
<View
  className="pile-card"
  role="button"
  tabIndex={0}
  aria-label={`充电桩 ${pile.pileNumber}, ${pile.type}类型, ${pile.power}千瓦, 状态: ${statusInfo.label}`}
  onClick={() => handlePileDetail(pile)}
>
  {/* 充电桩内容 */}
</View>
```

## 测试

### 单元测试

```bash
# 运行组件测试
npm test -- StationDetail

# 运行测试覆盖率
npm test -- --coverage StationDetail
```

### 集成测试

```bash
# 运行页面集成测试
npm test -- stationDetail/index.test.tsx
```

## 注意事项

1. **数据完整性**: 确保传入的 `stationData` 包含所有必需字段
2. **权限处理**: 拨打电话和获取位置需要相应权限
3. **网络状态**: 在网络不佳时提供适当的错误提示
4. **性能考虑**: 大量充电桩数据时考虑虚拟滚动
5. **兼容性**: 确保在不同平台（微信小程序、H5、App）上的兼容性

## 更新日志

### v1.0.0

- ✅ 基础功能实现
- ✅ 充电站信息展示
- ✅ 充电桩状态管理
- ✅ 用户交互功能
- ✅ 响应式设计
- ✅ 测试覆盖

### 计划功能

- 🔄 实时数据更新
- 🔄 离线数据缓存
- 🔄 多语言支持
- 🔄 主题定制
- 🔄 动画效果优化
