import mongoose from 'mongoose';
import User from '../models/User';
import Order from '../models/Order';
import ChargingSession from '../models/ChargingSession';

// 数据库连接
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_charging');
    console.log('✅ 数据库连接成功');
    console.log('📍 连接到数据库:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
};

// 生成随机日期（过去30天内）
const getRandomDate = () => {
  const now = new Date();
  const pastDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
  return pastDate;
};

// 生成随机金额
const getRandomAmount = (min: number, max: number) => {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
};

// 订单状态权重
const getRandomStatus = () => {
  const statuses = ['paid', 'paid', 'paid', 'paid', 'pending', 'cancelled'];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

// 支付方式权重
const getRandomPaymentMethod = () => {
  const methods = ['balance', 'alipay', 'alipay'];
  return methods[Math.floor(Math.random() * methods.length)];
};

// 充电站和充电器数据
const chargingStations = [
  { stationId: 'ST001', name: '万达广场充电站' },
  { stationId: 'ST002', name: '小区充电站A' },
  { stationId: 'ST003', name: '办公楼充电站' },
  { stationId: 'ST004', name: '购物中心充电站' },
  { stationId: 'ST005', name: '公园充电站' }
];

const chargerIds = ['CH001', 'CH002', 'CH003', 'CH004', 'CH005', 'CH006'];

// 生成充电会话数据
const createChargingSession = async (userId: mongoose.Types.ObjectId) => {
  const station = chargingStations[Math.floor(Math.random() * chargingStations.length)];
  const chargerId = chargerIds[Math.floor(Math.random() * chargerIds.length)];
  const startTime = getRandomDate();
  const duration = Math.random() * 120 + 30; // 30-150分钟
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  
  // 创建一个ObjectId作为stationId（模拟真实的充电站ID）
  const stationObjectId = new mongoose.Types.ObjectId();

  const session = new ChargingSession({
    sessionId: `CS${Date.now()}${Math.random().toString(36).substring(2, 8)}`.toUpperCase(),
    userId,
    stationId: stationObjectId, // 使用ObjectId
    chargerId,
    startTime,
    endTime,
    status: 'completed',
    duration: Math.floor(duration * 60), // 转换为秒
    energyDelivered: Math.round((Math.random() * 20 + 5) * 100) / 100, // 5-25 kWh
    totalCost: getRandomAmount(10, 50), // 使用totalCost字段
    paymentStatus: 'paid'
  });

  await session.save();
  return session;
};

// 为用户生成订单数据
const generateOrdersForUser = async (user: any) => {
  const orderCount = Math.floor(Math.random() * 8) + 3; // 每个用户生成3-10个订单
  console.log(`为用户 ${user.phone} 生成 ${orderCount} 个订单...`);

  for (let i = 0; i < orderCount; i++) {
    const orderType = Math.random() > 0.3 ? 'charging' : 'recharge'; // 70%充电订单，30%充值订单
    const amount = orderType === 'charging' 
      ? getRandomAmount(10, 50)  // 充电订单10-50元
      : getRandomAmount(50, 200); // 充值订单50-200元
    
    const status = getRandomStatus();
    const paymentMethod = getRandomPaymentMethod();
    const createdAt = getRandomDate();

    let sessionId = null;
    let description = '';

    if (orderType === 'charging') {
      // 创建对应的充电会话
      const session = await createChargingSession(user._id);
      sessionId = session._id;
      description = `充电桩充电服务 - ${session.chargerId}`;
    } else {
      description = `账户余额充值 - ${amount}元`;
    }

    const order = new Order({
      orderId: Order.generateOrderId(),
      userId: user._id,
      type: orderType,
      amount,
      status,
      paymentMethod,
      sessionId,
      description,
      thirdPartyOrderId: paymentMethod === 'alipay' ? `ALI${Date.now()}${Math.random().toString(36).substring(2, 6)}` : undefined,
      metadata: {
        generatedByScript: true,
        generatedAt: new Date()
      },
      createdAt,
      updatedAt: createdAt
    });

    await order.save();
    console.log(`  - 创建订单: ${order.orderId} (${orderType}, ¥${amount})`);
  }
};

// 创建测试用户
const createTestUsers = async () => {
  const testUsers = [
    {
      phone: '13812345678',
      nickName: '张三',
      balance: 100.00,
      verificationLevel: 'basic'
    },
    {
      phone: '13987654321',
      nickName: '李四',
      balance: 50.00,
      verificationLevel: 'face_verified'
    },
    {
      phone: '13611111111',
      nickName: '王五',
      balance: 200.00,
      verificationLevel: 'basic'
    },
    {
      phone: '13522222222',
      nickName: '赵六',
      balance: 80.00,
      verificationLevel: 'basic'
    }
  ];

  const createdUsers = [];
  for (const userData of testUsers) {
    // 检查用户是否已存在
    const existingUser = await User.findOne({ phone: userData.phone });
    if (!existingUser) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`✅ 创建用户: ${userData.nickName} (${userData.phone})`);
    } else {
      createdUsers.push(existingUser);
      console.log(`📱 用户已存在: ${userData.nickName} (${userData.phone})`);
    }
  }
  
  return createdUsers;
};

// 主函数
const generateTestOrders = async () => {
  try {
    await connectDB();

    // 获取所有用户
    let users = await User.find({});
    console.log(`📊 找到 ${users.length} 个用户`);

    if (users.length === 0) {
      console.log('❌ 没有找到用户，正在创建测试用户...');
      users = await createTestUsers();
      console.log(`✅ 创建了 ${users.length} 个测试用户`);
    }

    console.log(`📊 开始为 ${users.length} 个用户生成测试订单数据...`);

    // 清理之前生成的测试数据（可选）
    const existingTestOrders = await Order.countDocuments({ 'metadata.generatedByScript': true });
    if (existingTestOrders > 0) {
      console.log(`🧹 发现 ${existingTestOrders} 个已存在的测试订单，正在清理...`);
      await Order.deleteMany({ 'metadata.generatedByScript': true });
      console.log('✅ 清理完成');
    }

    // 为每个用户生成订单
    for (const user of users) {
      await generateOrdersForUser(user);
    }

    // 统计生成的数据
    const totalOrders = await Order.countDocuments({ 'metadata.generatedByScript': true });
    const totalSessions = await ChargingSession.countDocuments({});
    
    console.log(`✅ 测试数据生成完成！`);
    console.log(`📊 生成统计:`);
    console.log(`   - 用户数量: ${users.length}`);
    console.log(`   - 订单数量: ${totalOrders}`);
    console.log(`   - 充电会话: ${totalSessions}`);

    // 按类型统计订单
    const chargingOrders = await Order.countDocuments({ 
      'metadata.generatedByScript': true, 
      type: 'charging' 
    });
    const rechargeOrders = await Order.countDocuments({ 
      'metadata.generatedByScript': true, 
      type: 'recharge' 
    });

    console.log(`   - 充电订单: ${chargingOrders}`);
    console.log(`   - 充值订单: ${rechargeOrders}`);

    // 按状态统计订单
    const paidOrders = await Order.countDocuments({ 
      'metadata.generatedByScript': true, 
      status: 'paid' 
    });
    const pendingOrders = await Order.countDocuments({ 
      'metadata.generatedByScript': true, 
      status: 'pending' 
    });
    const cancelledOrders = await Order.countDocuments({ 
      'metadata.generatedByScript': true, 
      status: 'cancelled' 
    });

    console.log(`   - 已支付: ${paidOrders}`);
    console.log(`   - 待支付: ${pendingOrders}`);
    console.log(`   - 已取消: ${cancelledOrders}`);

    console.log('\n🎉 现在可以在前端查看订单数据了！');

  } catch (error) {
    console.error('❌ 生成测试数据失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 数据库连接已关闭');
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  generateTestOrders();
}

export default generateTestOrders; 