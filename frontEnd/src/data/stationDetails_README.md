# 充电站详情数据文件说明

## 文件结构

- `stationDetails.json` - 包含充电站详情数据的JSON文件，用于详情页面显示

## 数据结构

每个充电站详情包含以下字段：

```typescript
interface ChargingStationDetail {
  _id: string                    // 充电站唯一标识
  name: string                   // 充电站名称
  address: string                // 详细地址
  location: {                    // 地理位置
    type: 'Point'                // 坐标类型（固定为'Point'）
    coordinates: [number, number] // 经纬度坐标 [经度, 纬度]
  }
  operator: string               // 运营商（如：国家电网、特来电等）
  operatingHours: {              // 营业时间
    open: string                 // 开始时间（格式：HH:MM）
    close: string                // 结束时间（格式：HH:MM）
  }
  parkingFee: number             // 停车费（0表示免费）
  photos: string[]               // 照片URL数组
  chargers: Array<{              // 充电桩信息
    chargerId: string            // 充电桩ID
    type: 'fast' | 'slow'        // 充电类型（快充/慢充）
    power: number                // 功率（kW）
    status: 'available' | 'busy' | 'offline' // 状态
    pricing: {                   // 价格信息
      electricityFee: number     // 电费（元/度）
      serviceFee: number         // 服务费（元/度）
    }
  }>
  rating: number                 // 评分（1-5）
  reviewCount: number            // 评价数量
  distance?: number              // 距离（米，可选）
  createdAt: string             // 创建时间（ISO格式字符串）
  updatedAt: string             // 更新时间（ISO格式字符串）
}
```

## 使用方法

### 1. 导入数据

```typescript
import stationDetailsData from '../../data/stationDetails.json'

// 使用类型断言确保类型安全
const mockStationData: ChargingStationDetail = stationDetailsData[0] as unknown as ChargingStationDetail
```

### 2. 在组件中使用

```typescript
// 获取默认的模拟数据（第一个充电站）
const defaultStation = stationDetailsData[0] as unknown as ChargingStationDetail

// 根据ID查找特定充电站
const findStationById = (id: string) => {
  return stationDetailsData.find(station => station._id === id) as unknown as ChargingStationDetail
}

// 获取所有充电站数据
const allStations = stationDetailsData as unknown as ChargingStationDetail[]
```

## 数据来源

当前包含以下充电站的详细信息：
- 天鹅湾充电站（保定市）
- 保定市志广好滋味快餐饮食连锁有限公司保定市东兴东路店
- 董傲国际仓储充电站（保定市）
- 保定市天鹅湾购物中心充电站
- 保定市火车站北广场充电站
- 北京国贸CBD充电站
- 邯郸市丛台公园充电站
- 武汉市光谷广场充电站
- 成都市春熙路充电站

总计：9个充电站详情

## 与主列表数据的区别

- `chargingStations.json` - 用于主页面列表显示，包含21个充电站的基础信息
- `stationDetails.json` - 用于详情页面显示，包含9个精选充电站的完整详细信息

## 注意事项

1. 所有坐标使用WGS84坐标系
2. 距离单位为米
3. 价格单位为元/度
4. 时间格式为24小时制（HH:MM）
5. 评分范围为1-5分
6. 日期字段使用ISO 8601格式字符串

## 扩展数据

如需添加新的充电站详情数据，请按照上述数据结构格式添加到JSON文件中，并确保：
- `_id` 字段唯一
- 坐标数据准确
- 必填字段完整
- 充电桩信息详细
- 照片URL有效

## 在详情页面中的使用场景

1. **默认显示数据** - 当没有从主页面传递充电站数据时，显示默认的模拟数据
2. **数据完整性** - 提供比主列表更详细的充电站信息
3. **开发测试** - 在开发阶段提供稳定的测试数据
4. **降级方案** - 当主数据加载失败时的备选数据源
