# 充电站数据文件说明

## 文件结构

- `chargingStations.json` - 包含所有充电站数据的JSON文件
- `stationDetails.json` - 包含充电站详情数据的JSON文件，用于详情页面显示

## 数据结构

每个充电站包含以下字段：

```typescript
interface ChargingStation {
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
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
}
```

## 使用方法

### 1. 导入数据

```typescript
import chargingStationsData from '../../data/chargingStations.json'

// 使用类型断言确保类型安全
const allStations: ChargingStation[] = chargingStationsData as unknown as ChargingStation[]
```

### 2. 在组件中使用

```typescript
// 筛选特定城市的充电站
const cityStations = allStations.filter(station => 
  station.address.includes('保定市')
)

// 筛选快充充电站
const fastChargers = allStations.filter(station =>
  station.chargers.some(charger => charger.type === 'fast')
)

// 按距离排序
const sortedByDistance = allStations.sort((a, b) => 
  (a.distance || 0) - (b.distance || 0)
)
```

## 数据来源

### chargingStations.json
当前包含以下城市的充电站数据：
- 保定市（9个充电站）
- 北京市（3个充电站）
- 邯郸市（3个充电站）
- 武汉市（3个充电站）
- 成都市（3个充电站）

总计：21个充电站

### stationDetails.json
包含9个精选充电站的完整详细信息，用于详情页面显示：
- 天鹅湾充电站（保定市）
- 保定市志广好滋味快餐饮食连锁有限公司保定市东兴东路店
- 董傲国际仓储充电站（保定市）
- 保定市天鹅湾购物中心充电站
- 保定市火车站北广场充电站
- 北京国贸CBD充电站
- 邯郸市丛台公园充电站
- 武汉市光谷广场充电站
- 成都市春熙路充电站

## 注意事项

1. 所有坐标使用WGS84坐标系
2. 距离单位为米
3. 价格单位为元/度
4. 时间格式为24小时制（HH:MM）
5. 评分范围为1-5分

## 扩展数据

如需添加新的充电站数据，请按照上述数据结构格式添加到相应的JSON文件中，并确保：
- `_id` 字段唯一
- 坐标数据准确
- 必填字段完整

### 选择合适的数据文件
- **chargingStations.json** - 添加新的充电站基础信息（用于列表显示）
- **stationDetails.json** - 添加需要详细展示的充电站完整信息（用于详情页面）
