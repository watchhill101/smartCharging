/**
 * 数据播种脚本
 * 为智能充电系统添加测试数据
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');

// 连接数据库
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_charging');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

// 充电站数据模型
const chargingStationSchema = new mongoose.Schema({
  stationId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  city: { type: String, required: true },
  district: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  totalPiles: { type: Number, required: true },
  availablePiles: { type: Number, required: true },
  operator: {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String }
  },
  pricing: {
    pricePerKwh: { type: Number, required: true },
    serviceFee: { type: Number, default: 0 },
    parkingFee: { type: Number, default: 0 }
  },
  facilities: [{ type: String }],
  openTime: { type: String, default: '00:00' },
  closeTime: { type: String, default: '23:59' },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  images: [{ type: String }],
  isVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 用户数据模型
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, sparse: true }, // 使用sparse索引允许多个null值
  avatar: { type: String },
  isDeleted: { type: Boolean, default: false },
  verificationLevel: { type: Number, default: 1 },
  faceEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// FAQ数据模型
const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 通知数据模型
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['system', 'charging', 'payment', 'promotion'], required: true },
  status: { type: String, enum: ['unread', 'read'], default: 'unread' },
  data: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
});

// 创建模型
const ChargingStation = mongoose.model('ChargingStation', chargingStationSchema);
const User = mongoose.model('User', userSchema);
const FAQ = mongoose.model('FAQ', faqSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// 生成充电站数据
const generateChargingStations = (count = 50) => {
  const stations = [];
  
  // 北京主要区域的坐标范围
  const beijingAreas = [
    { name: '朝阳区', center: [116.4836, 39.9320], radius: 0.1 },
    { name: '海淀区', center: [116.2991, 39.9701], radius: 0.1 },
    { name: '西城区', center: [116.3748, 39.9149], radius: 0.08 },
    { name: '东城区', center: [116.4174, 39.9280], radius: 0.08 },
    { name: '丰台区', center: [116.2868, 39.8579], radius: 0.1 },
    { name: '石景山区', center: [116.2224, 39.9063], radius: 0.08 },
    { name: '通州区', center: [116.6564, 39.9023], radius: 0.12 },
    { name: '昌平区', center: [116.2356, 40.2206], radius: 0.15 }
  ];
  
  const stationTypes = ['购物中心', '写字楼', '住宅小区', '公共停车场', '高速服务区', '酒店', '医院', '学校'];
  const operators = ['国家电网', '特来电', '星星充电', '小桔充电', '蔚来充电', '云快充'];
  const facilities = ['WiFi', '休息区', '便利店', '洗手间', '监控', '遮雨棚', '照明', '24小时营业'];
  
  for (let i = 0; i < count; i++) {
    const area = beijingAreas[Math.floor(Math.random() * beijingAreas.length)];
    const lng = area.center[0] + (Math.random() - 0.5) * area.radius * 2;
    const lat = area.center[1] + (Math.random() - 0.5) * area.radius * 2;
    
    const totalPiles = Math.floor(Math.random() * 20) + 4; // 4-23个充电桩
    const availablePiles = Math.floor(Math.random() * (totalPiles + 1)); // 0到全部可用
    
    const station = {
      stationId: `station_${Date.now()}_${i.toString().padStart(3, '0')}`,
      name: `${faker.company.name()}${stationTypes[Math.floor(Math.random() * stationTypes.length)]}充电站`,
      address: faker.location.streetAddress() + ', ' + area.name + ', 北京市',
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      city: '北京市',
      district: area.name,
      status: faker.helpers.arrayElement(['active', 'active', 'active', 'maintenance']), // 大部分是active
      totalPiles,
      availablePiles,
      operator: {
        name: operators[Math.floor(Math.random() * operators.length)],
        phone: faker.phone.number(),
        email: faker.internet.email()
      },
      pricing: {
        pricePerKwh: parseFloat((Math.random() * 1.5 + 1.0).toFixed(2)), // 1.0-2.5元/kWh
        serviceFee: parseFloat((Math.random() * 0.5).toFixed(2)), // 0-0.5元服务费
        parkingFee: Math.random() > 0.7 ? parseFloat((Math.random() * 5).toFixed(2)) : 0 // 30%概率有停车费
      },
      facilities: faker.helpers.arrayElements(facilities, Math.floor(Math.random() * 4) + 2),
      openTime: faker.helpers.arrayElement(['00:00', '06:00', '07:00']),
      closeTime: faker.helpers.arrayElement(['23:59', '22:00', '24:00']),
      rating: {
        average: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0-5.0分
        count: Math.floor(Math.random() * 500) + 10
      },
      images: [
        `https://example.com/stations/${i}_1.jpg`,
        `https://example.com/stations/${i}_2.jpg`
      ],
      isVerified: Math.random() > 0.1, // 90%已验证
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent({ days: 30 })
    };
    
    stations.push(station);
  }
  
  return stations;
};

// 生成用户数据
const generateUsers = (count = 100) => {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    const user = {
      userId: `user_${Date.now()}_${i.toString().padStart(3, '0')}`,
      phone: `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 900000000) + 100000000}`,
      name: faker.person.fullName(),
      email: Math.random() > 0.3 ? faker.internet.email() : null, // 70%有邮箱
      avatar: Math.random() > 0.5 ? faker.image.avatar() : null,
      isDeleted: false,
      verificationLevel: faker.helpers.arrayElement([1, 2, 3]), // 认证等级
      faceEnabled: Math.random() > 0.6, // 40%开启人脸识别
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: faker.date.recent({ days: 7 })
    };
    
    users.push(user);
  }
  
  return users;
};

// 生成FAQ数据
const generateFAQs = () => {
  const faqs = [
    {
      question: '如何开始充电？',
      answer: '1. 打开智能充电APP\n2. 扫描充电桩二维码\n3. 选择充电模式\n4. 插入充电枪\n5. 确认开始充电',
      category: 'charging',
      priority: 1
    },
    {
      question: '充电费用如何计算？',
      answer: '充电费用 = 充电电量(kWh) × 电价(元/kWh) + 服务费 + 停车费（如有）',
      category: 'payment',
      priority: 1
    },
    {
      question: '支持哪些支付方式？',
      answer: '支持微信支付、支付宝、银行卡、充电钱包等多种支付方式。',
      category: 'payment',
      priority: 2
    },
    {
      question: '充电过程中遇到故障怎么办？',
      answer: '立即停止充电，联系客服热线400-XXX-XXXX，或在APP内提交故障报告。',
      category: 'charging',
      priority: 1
    },
    {
      question: '如何查找附近的充电站？',
      answer: '在APP首页点击"找桩"，系统会自动显示附近的充电站，支持按距离、价格、可用状态筛选。',
      category: 'general',
      priority: 2
    },
    {
      question: '可以预约充电吗？',
      answer: '部分充电站支持预约服务，您可以在充电站详情页查看是否支持预约。',
      category: 'charging',
      priority: 3
    },
    {
      question: '如何开通发票？',
      answer: '在个人中心-发票管理中，可以申请开具充电发票，支持个人和企业发票。',
      category: 'payment',
      priority: 3
    },
    {
      question: '充电钱包如何充值？',
      answer: '在钱包页面点击"充值"，选择金额和支付方式即可完成充值。',
      category: 'payment',
      priority: 2
    },
    {
      question: '人脸识别功能如何开启？',
      answer: '在个人中心-安全设置中，可以录入人脸信息并开启人脸识别功能。',
      category: 'general',
      priority: 4
    },
    {
      question: '充电记录在哪里查看？',
      answer: '在个人中心-充电记录中可以查看所有历史充电记录，包括时间、地点、费用等信息。',
      category: 'general',
      priority: 2
    }
  ];
  
  return faqs.map((faq, index) => ({
    ...faq,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 30 })
  }));
};

// 生成通知数据
const generateNotifications = (users, count = 200) => {
  const notifications = [];
  const notificationTypes = ['system', 'charging', 'payment', 'promotion'];
  const templates = {
    system: [
      { title: '系统维护通知', content: '系统将于今晚23:00-02:00进行维护，期间可能影响部分功能使用。' },
      { title: '版本更新', content: '新版本已发布，新增多项便民功能，请及时更新体验。' }
    ],
    charging: [
      { title: '充电完成', content: '您的充电已完成，本次充电{energy}kWh，费用{cost}元。' },
      { title: '充电异常', content: '检测到充电异常，已自动停止充电，请检查车辆连接。' }
    ],
    payment: [
      { title: '支付成功', content: '您已成功支付{amount}元，钱包余额{balance}元。' },
      { title: '余额不足', content: '钱包余额不足，请及时充值以免影响充电。' }
    ],
    promotion: [
      { title: '优惠活动', content: '充电满100元送10元优惠券，活动有效期至本月底。' },
      { title: '会员特权', content: '恭喜成为VIP会员，享受充电8.8折优惠！' }
    ]
  };
  
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
    const template = templates[type][Math.floor(Math.random() * templates[type].length)];
    
    const notification = {
      userId: user.userId,
      title: template.title,
      content: template.content
        .replace('{energy}', (Math.random() * 50 + 10).toFixed(1))
        .replace('{cost}', (Math.random() * 100 + 20).toFixed(2))
        .replace('{amount}', (Math.random() * 200 + 50).toFixed(2))
        .replace('{balance}', (Math.random() * 500 + 100).toFixed(2)),
      type,
      status: faker.helpers.arrayElement(['unread', 'read', 'read']), // 大部分已读
      data: {
        id: `${type}_${i}`,
        timestamp: new Date().toISOString()
      },
      createdAt: faker.date.recent({ days: 30 }),
      readAt: Math.random() > 0.3 ? faker.date.recent({ days: 15 }) : null
    };
    
    notifications.push(notification);
  }
  
  return notifications;
};

// 清空现有数据
const clearData = async () => {
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    ChargingStation.deleteMany({}),
    User.deleteMany({}),
    FAQ.deleteMany({}),
    Notification.deleteMany({})
  ]);
  console.log('✅ Existing data cleared');
};

// 播种数据
const seedData = async () => {
  try {
    console.log('🌱 Starting data seeding...');
    
    // 清空现有数据
    await clearData();
    
    // 生成并插入充电站数据
    console.log('📍 Generating charging stations...');
    const stations = generateChargingStations(50);
    await ChargingStation.insertMany(stations);
    console.log(`✅ Created ${stations.length} charging stations`);
    
    // 生成并插入用户数据
    console.log('👥 Generating users...');
    const users = generateUsers(100);
    await User.insertMany(users);
    console.log(`✅ Created ${users.length} users`);
    
    // 生成并插入FAQ数据
    console.log('❓ Generating FAQs...');
    const faqs = generateFAQs();
    await FAQ.insertMany(faqs);
    console.log(`✅ Created ${faqs.length} FAQs`);
    
    // 生成并插入通知数据
    console.log('🔔 Generating notifications...');
    const notifications = generateNotifications(users, 200);
    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} notifications`);
    
    // 创建地理索引
    console.log('🗺️  Creating geospatial index...');
    await ChargingStation.collection.createIndex({ location: '2dsphere' });
    console.log('✅ Geospatial index created');
    
    console.log('\n🎉 Data seeding completed successfully!');
    console.log('📊 Data Summary:');
    console.log(`  - ${stations.length} charging stations`);
    console.log(`  - ${users.length} users`);
    console.log(`  - ${faqs.length} FAQs`);
    console.log(`  - ${notifications.length} notifications`);
    
  } catch (error) {
    console.error('❌ Data seeding failed:', error);
    throw error;
  }
};

// 运行脚本
const run = async () => {
  try {
    await connectDB();
    await seedData();
    console.log('\n✨ All done! You can now test the application with sample data.');
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
    process.exit(0);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  run();
}

module.exports = { seedData, generateChargingStations, generateUsers, generateFAQs, generateNotifications };
