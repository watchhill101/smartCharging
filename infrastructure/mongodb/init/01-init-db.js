// MongoDB初始化脚本
// 创建数据库和基础集合

// 切换到smart_charging数据库
db = db.getSiblingDB('smart_charging');

// 创建用户集合并设置索引
db.createCollection('users');
db.users.createIndex({ "phone": 1 }, { unique: true });
db.users.createIndex({ "createdAt": -1 });

// 创建充电站集合并设置索引
db.createCollection('chargingstations');
db.chargingstations.createIndex({ "location": "2dsphere" });
db.chargingstations.createIndex({ "name": "text", "address": "text" });
db.chargingstations.createIndex({ "operator": 1 });
db.chargingstations.createIndex({ "rating": -1 });
db.chargingstations.createIndex({ "chargers.type": 1 });
db.chargingstations.createIndex({ "chargers.status": 1 });

// 创建充电会话集合并设置索引
db.createCollection('chargingsessions');
db.chargingsessions.createIndex({ "sessionId": 1 }, { unique: true });
db.chargingsessions.createIndex({ "userId": 1, "createdAt": -1 });
db.chargingsessions.createIndex({ "stationId": 1 });
db.chargingsessions.createIndex({ "chargerId": 1 });
db.chargingsessions.createIndex({ "status": 1 });
db.chargingsessions.createIndex({ "paymentStatus": 1 });
db.chargingsessions.createIndex({ "startTime": -1 });

// 创建订单集合并设置索引
db.createCollection('orders');
db.orders.createIndex({ "orderId": 1 }, { unique: true });
db.orders.createIndex({ "userId": 1, "createdAt": -1 });
db.orders.createIndex({ "status": 1 });
db.orders.createIndex({ "type": 1 });
db.orders.createIndex({ "paymentMethod": 1 });
db.orders.createIndex({ "thirdPartyOrderId": 1 });
db.orders.createIndex({ "sessionId": 1 });

// 插入示例充电站数据
db.chargingstations.insertMany([
  {
    name: "北京国贸充电站",
    address: "北京市朝阳区建国门外大街1号",
    location: {
      type: "Point",
      coordinates: [116.4074, 39.9042]
    },
    operator: "国家电网",
    operatingHours: {
      open: "00:00",
      close: "24:00"
    },
    parkingFee: 5,
    photos: [
      "https://example.com/station1_1.jpg",
      "https://example.com/station1_2.jpg"
    ],
    chargers: [
      {
        chargerId: "GD001",
        type: "fast",
        power: 120,
        status: "available",
        pricing: {
          electricityFee: 1.2,
          serviceFee: 0.8
        }
      },
      {
        chargerId: "GD002",
        type: "fast",
        power: 120,
        status: "available",
        pricing: {
          electricityFee: 1.2,
          serviceFee: 0.8
        }
      },
      {
        chargerId: "GD003",
        type: "slow",
        power: 7,
        status: "busy",
        pricing: {
          electricityFee: 0.8,
          serviceFee: 0.4
        }
      }
    ],
    rating: 4.5,
    reviewCount: 128,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "上海陆家嘴充电站",
    address: "上海市浦东新区陆家嘴环路1000号",
    location: {
      type: "Point",
      coordinates: [121.4737, 31.2304]
    },
    operator: "特来电",
    operatingHours: {
      open: "06:00",
      close: "22:00"
    },
    parkingFee: 8,
    photos: [
      "https://example.com/station2_1.jpg"
    ],
    chargers: [
      {
        chargerId: "TLD001",
        type: "fast",
        power: 180,
        status: "available",
        pricing: {
          electricityFee: 1.5,
          serviceFee: 1.0
        }
      },
      {
        chargerId: "TLD002",
        type: "fast",
        power: 180,
        status: "offline",
        pricing: {
          electricityFee: 1.5,
          serviceFee: 1.0
        }
      }
    ],
    rating: 4.2,
    reviewCount: 89,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "深圳科技园充电站",
    address: "深圳市南山区科技园南区科苑路15号",
    location: {
      type: "Point",
      coordinates: [113.9547, 22.5431]
    },
    operator: "星星充电",
    operatingHours: {
      open: "00:00",
      close: "24:00"
    },
    parkingFee: 0,
    photos: [],
    chargers: [
      {
        chargerId: "XX001",
        type: "fast",
        power: 60,
        status: "available",
        pricing: {
          electricityFee: 1.0,
          serviceFee: 0.6
        }
      },
      {
        chargerId: "XX002",
        type: "slow",
        power: 7,
        status: "available",
        pricing: {
          electricityFee: 0.7,
          serviceFee: 0.3
        }
      },
      {
        chargerId: "XX003",
        type: "slow",
        power: 7,
        status: "available",
        pricing: {
          electricityFee: 0.7,
          serviceFee: 0.3
        }
      }
    ],
    rating: 4.8,
    reviewCount: 256,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print("数据库初始化完成！");
print("已创建集合：users, chargingstations, chargingsessions, orders");
print("已插入示例充电站数据：3个充电站，8个充电桩");
print("已创建必要的索引");