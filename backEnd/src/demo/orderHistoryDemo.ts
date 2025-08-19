import mongoose from 'mongoose';
import { OrderHistoryService } from '../services/OrderHistoryService';
import Order from '../models/Order';
import ChargingSession from '../models/ChargingSession';
import User from '../models/User';

/**
 * 订单历史管理功能演示
 * 
 * 演示功能：
 * 1. 创建测试数据（用户、充电会话、订单）
 * 2. 获取订单历史列表
 * 3. 搜索和筛选订单
 * 4. 获取订单详情
 * 5. 获取订单统计信息
 * 6. 导出订单数据
 */

async function connectDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smartCharging');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

async function createTestData(): Promise<{
  userId: string;
  orderIds: string[];
}> {
  console.log('\n📝 创建测试数据...');
  
  // 清理现有测试数据
  await Order.deleteMany({ orderId: { $regex: /^DEMO/ } });
  await ChargingSession.deleteMany({ sessionId: { $regex: /^DEMO/ } });
  await User.deleteOne({ phone: '13800138888' });
  
  // 创建测试用户
  const testUser = new User({
    phone: '13800138888',
    nickName: '演示用户',
    email: 'demo@example.com',
    balance: 500.00
  });
  await testUser.save();
  const userId = testUser._id.toString();
  console.log(`✅ 创建测试用户: ${userId}`);

  // 创建充电站ID（模拟）
  const stationId = new mongoose.Types.ObjectId();

  // 创建测试充电会话
  const sessions = [];
  for (let i = 1; i <= 3; i++) {
    const session = new ChargingSession({
      sessionId: `DEMO_SESSION_${i}`,
      userId,
      stationId,
      chargerId: `CHARGER_00${i}`,
      status: 'completed',
      startTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // i天前
      endTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000) + (2 * 60 * 60 * 1000)), // 充电2小时
      duration: 7200, // 2小时
      energyDelivered: 30 + i * 5, // 30-40 kWh
      startPowerLevel: 20,
      endPowerLevel: 80,
      totalCost: (30 + i * 5) * 1.5, // 1.5元/kWh
      paymentStatus: 'paid'
    });
    await session.save();
    sessions.push(session);
  }
  console.log(`✅ 创建${sessions.length}个充电会话`);

  // 创建测试订单
  const orderIds: string[] = [];
  
  // 充电订单
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const order = new Order({
      orderId: `DEMO_ORD_CHARGING_${i + 1}`,
      userId,
      type: 'charging',
      amount: session.totalCost,
      status: 'paid',
      paymentMethod: i % 2 === 0 ? 'balance' : 'alipay',
      sessionId: session._id,
      description: `充电费用 - ${session.chargerId}`
    });
    await order.save();
    orderIds.push(order.orderId);
  }

  // 充值订单
  for (let i = 1; i <= 2; i++) {
    const order = new Order({
      orderId: `DEMO_ORD_RECHARGE_${i}`,
      userId,
      type: 'recharge',
      amount: i * 100, // 100, 200
      status: i === 1 ? 'paid' : 'pending',
      paymentMethod: 'alipay',
      description: `账户充值 ${i * 100}元`
    });
    await order.save();
    orderIds.push(order.orderId);
  }

  // 创建一个取消的订单
  const cancelledOrder = new Order({
    orderId: 'DEMO_ORD_CANCELLED',
    userId,
    type: 'charging',
    amount: 25.50,
    status: 'cancelled',
    paymentMethod: 'balance',
    description: '已取消的充电订单'
  });
  await cancelledOrder.save();
  orderIds.push(cancelledOrder.orderId);

  console.log(`✅ 创建${orderIds.length}个测试订单`);
  return { userId, orderIds };
}

async function demonstrateGetOrderHistory(userId: string) {
  console.log('\n📋 获取订单历史列表...');
  
  try {
    const result = await OrderHistoryService.getOrderHistory({
      userId,
      page: 1,
      limit: 10
    });

    console.log('✅ 订单历史获取成功:');
    console.log(`   总订单数: ${result.pagination.total}`);
    console.log(`   当前页: ${result.pagination.page}/${result.pagination.totalPages}`);
    console.log(`   统计信息:`);
    console.log(`     - 总订单: ${result.statistics.totalOrders}`);
    console.log(`     - 总金额: ¥${result.statistics.totalAmount.toFixed(2)}`);
    console.log(`     - 已支付订单: ${result.statistics.paidOrders}`);
    console.log(`     - 充电订单: ${result.statistics.chargingOrders}`);
    console.log(`     - 充值订单: ${result.statistics.rechargeOrders}`);

    console.log('\n   订单列表:');
    result.orders.forEach((order, index) => {
      console.log(`   ${index + 1}. ${order.orderId}`);
      console.log(`      类型: ${order.type === 'charging' ? '充电' : '充值'}`);
      console.log(`      金额: ¥${order.amount.toFixed(2)}`);
      console.log(`      状态: ${getStatusText(order.status)}`);
      console.log(`      支付方式: ${getPaymentMethodText(order.paymentMethod)}`);
      console.log(`      时间: ${order.createdAt.toLocaleString()}`);
      if (order.session) {
        console.log(`      充电信息: ${order.session.chargerId} - ${order.session.energyDelivered}kWh`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ 获取订单历史失败:', error);
  }
}

async function demonstrateFilterOrders(userId: string) {
  console.log('\n🔍 演示订单筛选功能...');
  
  try {
    // 按类型筛选
    console.log('\n1. 筛选充电订单:');
    const chargingOrders = await OrderHistoryService.getOrderHistory({
      userId,
      type: 'charging',
      page: 1,
      limit: 10
    });
    console.log(`   找到${chargingOrders.orders.length}个充电订单`);

    // 按状态筛选
    console.log('\n2. 筛选已支付订单:');
    const paidOrders = await OrderHistoryService.getOrderHistory({
      userId,
      status: 'paid',
      page: 1,
      limit: 10
    });
    console.log(`   找到${paidOrders.orders.length}个已支付订单`);

    // 按支付方式筛选
    console.log('\n3. 筛选余额支付订单:');
    const balanceOrders = await OrderHistoryService.getOrderHistory({
      userId,
      paymentMethod: 'balance',
      page: 1,
      limit: 10
    });
    console.log(`   找到${balanceOrders.orders.length}个余额支付订单`);

    // 按日期范围筛选
    console.log('\n4. 筛选最近3天的订单:');
    const recentOrders = await OrderHistoryService.getOrderHistory({
      userId,
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      page: 1,
      limit: 10
    });
    console.log(`   找到${recentOrders.orders.length}个最近3天的订单`);
  } catch (error) {
    console.error('❌ 订单筛选失败:', error);
  }
}

async function demonstrateSearchOrders(userId: string) {
  console.log('\n🔎 演示订单搜索功能...');
  
  try {
    // 搜索订单号
    console.log('\n1. 搜索订单号包含"CHARGING"的订单:');
    const searchResult = await OrderHistoryService.searchOrders(userId, 'CHARGING', 1, 10);
    console.log(`   找到${searchResult.orders.length}个匹配订单`);
    searchResult.orders.forEach(order => {
      console.log(`   - ${order.orderId}: ¥${order.amount.toFixed(2)}`);
    });

    // 搜索描述
    console.log('\n2. 搜索描述包含"充电"的订单:');
    const descSearchResult = await OrderHistoryService.searchOrders(userId, '充电', 1, 10);
    console.log(`   找到${descSearchResult.orders.length}个匹配订单`);
  } catch (error) {
    console.error('❌ 订单搜索失败:', error);
  }
}

async function demonstrateGetOrderDetail(userId: string, orderId: string) {
  console.log('\n📄 获取订单详情...');
  
  try {
    const orderDetail = await OrderHistoryService.getOrderDetail(userId, orderId);
    
    if (orderDetail) {
      console.log('✅ 订单详情获取成功:');
      const order = orderDetail.order;
      console.log(`   订单号: ${order.orderId}`);
      console.log(`   类型: ${order.type === 'charging' ? '充电' : '充值'}`);
      console.log(`   金额: ¥${order.amount.toFixed(2)}`);
      console.log(`   状态: ${getStatusText(order.status)}`);
      console.log(`   支付方式: ${getPaymentMethodText(order.paymentMethod)}`);
      console.log(`   描述: ${order.description || '无'}`);
      console.log(`   创建时间: ${order.createdAt.toLocaleString()}`);
      
      if (order.session) {
        console.log('\n   充电会话信息:');
        console.log(`     会话ID: ${order.session.sessionId}`);
        console.log(`     充电桩: ${order.session.chargerId}`);
        console.log(`     开始时间: ${order.session.startTime.toLocaleString()}`);
        console.log(`     结束时间: ${order.session.endTime?.toLocaleString() || '进行中'}`);
        console.log(`     充电时长: ${Math.floor(order.session.duration / 60)}分钟`);
        console.log(`     充电量: ${order.session.energyDelivered}kWh`);
        console.log(`     电量变化: ${order.session.startPowerLevel}% → ${order.session.endPowerLevel}%`);
      }

      if (orderDetail.relatedOrders && orderDetail.relatedOrders.length > 0) {
        console.log('\n   相关订单:');
        orderDetail.relatedOrders.forEach(relatedOrder => {
          console.log(`     - ${relatedOrder.orderId}: ¥${relatedOrder.amount.toFixed(2)}`);
        });
      }
    } else {
      console.log('❌ 订单不存在');
    }
  } catch (error) {
    console.error('❌ 获取订单详情失败:', error);
  }
}

async function demonstrateGetStatistics(userId: string) {
  console.log('\n📊 获取订单统计信息...');
  
  try {
    const statistics = await OrderHistoryService.getOrderStatistics(userId);
    
    console.log('✅ 统计信息获取成功:');
    console.log(`   总订单数: ${statistics.totalOrders}`);
    console.log(`   总金额: ¥${statistics.totalAmount.toFixed(2)}`);
    console.log(`   已支付订单: ${statistics.paidOrders}`);
    console.log(`   已支付金额: ¥${statistics.paidAmount.toFixed(2)}`);
    console.log(`   充电订单: ${statistics.chargingOrders}`);
    console.log(`   充值订单: ${statistics.rechargeOrders}`);

    if (statistics.monthlyStats.length > 0) {
      console.log('\n   月度统计:');
      statistics.monthlyStats.forEach(monthStat => {
        console.log(`     ${monthStat.month}: ${monthStat.orders}单, ¥${monthStat.amount.toFixed(2)}`);
      });
    }

    if (statistics.statusDistribution.length > 0) {
      console.log('\n   状态分布:');
      statistics.statusDistribution.forEach(statusStat => {
        console.log(`     ${getStatusText(statusStat.status)}: ${statusStat.count}单 (${statusStat.percentage}%)`);
      });
    }

    if (statistics.paymentMethodDistribution.length > 0) {
      console.log('\n   支付方式分布:');
      statistics.paymentMethodDistribution.forEach(paymentStat => {
        console.log(`     ${getPaymentMethodText(paymentStat.method)}: ${paymentStat.count}单 (${paymentStat.percentage}%)`);
      });
    }
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
  }
}

async function demonstrateExportOrders(userId: string) {
  console.log('\n📤 演示订单导出功能...');
  
  try {
    // 导出CSV格式
    console.log('\n1. 导出CSV格式:');
    const csvResult = await OrderHistoryService.exportOrders({
      userId,
      format: 'csv'
    });
    
    if (csvResult.success) {
      console.log('✅ CSV导出成功');
      console.log(`   下载链接: ${csvResult.downloadUrl}`);
      console.log(`   文件名: ${csvResult.fileName}`);
    } else {
      console.log(`❌ CSV导出失败: ${csvResult.message}`);
    }

    // 导出Excel格式
    console.log('\n2. 导出Excel格式:');
    const excelResult = await OrderHistoryService.exportOrders({
      userId,
      format: 'excel'
    });
    
    if (excelResult.success) {
      console.log('✅ Excel导出成功');
      console.log(`   下载链接: ${excelResult.downloadUrl}`);
      console.log(`   文件名: ${excelResult.fileName}`);
    } else {
      console.log(`❌ Excel导出失败: ${excelResult.message}`);
    }

    // 导出指定类型的订单
    console.log('\n3. 导出充电订单(PDF格式):');
    const pdfResult = await OrderHistoryService.exportOrders({
      userId,
      type: 'charging',
      format: 'pdf'
    });
    
    if (pdfResult.success) {
      console.log('✅ PDF导出成功');
      console.log(`   下载链接: ${pdfResult.downloadUrl}`);
      console.log(`   文件名: ${pdfResult.fileName}`);
    } else {
      console.log(`❌ PDF导出失败: ${pdfResult.message}`);
    }
  } catch (error) {
    console.error('❌ 订单导出失败:', error);
  }
}

async function cleanupTestData(userId: string) {
  console.log('\n🧹 清理测试数据...');
  
  try {
    await Order.deleteMany({ orderId: { $regex: /^DEMO/ } });
    await ChargingSession.deleteMany({ sessionId: { $regex: /^DEMO/ } });
    await User.findByIdAndDelete(userId);
    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待支付',
    'paid': '已支付',
    'cancelled': '已取消',
    'refunded': '已退款'
  };
  return statusMap[status] || status;
}

function getPaymentMethodText(method: string): string {
  const methodMap: Record<string, string> = {
    'balance': '余额支付',
    'alipay': '支付宝'
  };
  return methodMap[method] || method;
}

async function runOrderHistoryDemo() {
  console.log('🚀 开始订单历史管理功能演示\n');
  
  await connectDatabase();
  
  let userId: string;
  let orderIds: string[];
  
  try {
    // 1. 创建测试数据
    const testData = await createTestData();
    userId = testData.userId;
    orderIds = testData.orderIds;
    
    // 2. 获取订单历史列表
    await demonstrateGetOrderHistory(userId);
    
    // 3. 演示筛选功能
    await demonstrateFilterOrders(userId);
    
    // 4. 演示搜索功能
    await demonstrateSearchOrders(userId);
    
    // 5. 获取订单详情
    await demonstrateGetOrderDetail(userId, orderIds[0]);
    
    // 6. 获取统计信息
    await demonstrateGetStatistics(userId);
    
    // 7. 演示导出功能
    await demonstrateExportOrders(userId);
    
    console.log('\n🎉 订单历史管理功能演示完成！');
    
  } catch (error) {
    console.error('❌ 演示过程中发生错误:', error);
  } finally {
    // 清理测试数据
    if (userId!) {
      await cleanupTestData(userId);
    }
    
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('📝 数据库连接已关闭');
  }
}

// 如果直接运行此文件，则执行演示
if (require.main === module) {
  runOrderHistoryDemo().catch(console.error);
}

export { runOrderHistoryDemo };