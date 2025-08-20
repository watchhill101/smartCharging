import mongoose from 'mongoose';
import Coupon, { CouponType, CouponStatus } from '../models/Coupon';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 测试用户ID
const TEST_USER_ID = 'demo_user_001';

// 测试优惠券数据
const testCoupons = [
  {
    userId: TEST_USER_ID,
    type: CouponType.DISCOUNT,
    title: '新用户专享8.5折券',
    description: '新用户首次充电享受8.5折优惠，最高可省20元',
    value: 0.85,
    maxDiscount: 20,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
    status: CouponStatus.UNUSED,
    conditions: ['仅限新用户', '首次充电使用'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.AMOUNT,
    title: '满50减10元券',
    description: '单次充电满50元即可使用，立减10元',
    value: 10,
    minAmount: 50,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15天后过期
    status: CouponStatus.UNUSED,
    conditions: ['单次充电满50元', '不可与其他优惠同用'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.FREE_CHARGE,
    title: '免费充电1小时券',
    description: '可免费充电1小时，适用于所有充电桩',
    value: 1,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
    status: CouponStatus.UNUSED,
    conditions: ['限时1小时', '不可转让'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.POINTS,
    title: '积分兑换券',
    description: '使用100积分兑换5元充电券',
    value: 5,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后过期
    status: CouponStatus.UNUSED,
    conditions: ['需100积分兑换', '不可退款'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.DISCOUNT,
    title: '周末充电9折券',
    description: '周末充电享受9折优惠，让充电更省钱',
    value: 0.9,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45天后过期
    status: CouponStatus.UNUSED,
    conditions: ['仅限周末使用', '不可与其他优惠同用'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.AMOUNT,
    title: '满100减25元券',
    description: '大额充电优惠，满100元立减25元',
    value: 25,
    minAmount: 100,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20天后过期
    status: CouponStatus.UNUSED,
    conditions: ['单次充电满100元', '限时优惠'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.DISCOUNT,
    title: '快充桩专用7折券',
    description: '快充桩专用优惠券，享受7折优惠',
    value: 0.7,
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25天后过期
    status: CouponStatus.UNUSED,
    conditions: ['仅限快充桩使用', '不可用于慢充'],
    applicableStations: [],
    applicableChargers: ['fast'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.AMOUNT,
    title: '已使用满30减5元券',
    description: '已使用的优惠券示例',
    value: 5,
    minAmount: 30,
    validFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10天前生效
    validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20天后过期
    status: CouponStatus.USED,
    usedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前使用
    usedInOrder: 'order_001',
    conditions: ['单次充电满30元'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  },
  {
    userId: TEST_USER_ID,
    type: CouponType.DISCOUNT,
    title: '已过期8折券',
    description: '已过期的优惠券示例',
    value: 0.8,
    validFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前生效
    validUntil: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5天前过期
    status: CouponStatus.EXPIRED,
    conditions: ['通用优惠券'],
    applicableStations: [],
    applicableChargers: ['fast', 'slow'],
    isActive: true
  }
];

async function generateTestCoupons() {
  try {
    // 连接数据库
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartCharging';
    await mongoose.connect(mongoUri);
    console.log('✅ 数据库连接成功');

    // 清空现有测试数据
    await Coupon.deleteMany({ userId: TEST_USER_ID });
    console.log('🗑️ 已清空现有测试优惠券数据');

    // 插入测试数据
    const coupons = await Coupon.insertMany(testCoupons);
    console.log(`✅ 成功创建 ${coupons.length} 张测试优惠券`);

    // 显示创建的优惠券
    console.log('\n📋 创建的优惠券列表:');
    coupons.forEach((coupon, index) => {
      console.log(`${index + 1}. ${coupon.title} (${coupon.status}) - 有效期至: ${coupon.validUntil.toLocaleDateString()}`);
    });

    // 统计各状态数量
    const counts = await Promise.all([
      Coupon.countDocuments({ userId: TEST_USER_ID, status: CouponStatus.UNUSED }),
      Coupon.countDocuments({ userId: TEST_USER_ID, status: CouponStatus.USED }),
      Coupon.countDocuments({ userId: TEST_USER_ID, status: CouponStatus.EXPIRED })
    ]);

    console.log('\n📊 优惠券状态统计:');
    console.log(`- 待使用: ${counts[0]} 张`);
    console.log(`- 已使用: ${counts[1]} 张`);
    console.log(`- 已过期: ${counts[2]} 张`);

    console.log('\n🎉 测试优惠券数据生成完成！');

  } catch (error) {
    console.error('❌ 生成测试优惠券失败:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
    process.exit(0);
  }
}

// 运行脚本
if (require.main === module) {
  generateTestCoupons();
}
