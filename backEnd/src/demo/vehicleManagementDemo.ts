import mongoose from 'mongoose';
import { VehicleManagementService } from '../services/VehicleManagementService';
import User from '../models/User';

/**
 * 车辆信息管理功能演示
 * 
 * 演示功能：
 * 1. 创建测试用户
 * 2. 添加车辆信息
 * 3. 获取车辆列表
 * 4. 更新车辆信息
 * 5. 设置默认车辆
 * 6. 更新充电偏好
 * 7. 删除车辆
 * 8. 获取支持的品牌和型号
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

async function createTestUser(): Promise<string> {
  console.log('\n📝 创建测试用户...');
  
  // 删除可能存在的测试用户
  await User.deleteOne({ phone: '13800138999' });
  
  const testUser = new User({
    phone: '13800138999',
    nickName: '车辆管理演示用户',
    email: 'vehicle-demo@example.com',
    balance: 200.00
  });
  
  const savedUser = await testUser.save();
  console.log(`✅ 测试用户创建成功，ID: ${savedUser._id}`);
  
  return savedUser._id.toString();
}

async function demonstrateAddVehicles(userId: string): Promise<string[]> {
  console.log('\n🚗 添加车辆信息...');
  
  const vehicleIds: string[] = [];
  
  try {
    // 添加第一辆车 - 特斯拉 Model 3
    console.log('\n1. 添加特斯拉 Model 3:');
    const tesla = {
      brand: '特斯拉',
      model: 'Model 3',
      year: 2023,
      color: '珍珠白',
      licensePlate: '京A88888',
      batteryCapacity: 75,
      range: 556,
      chargingPortType: 'CCS' as const,
      isDefault: true,
      chargingPreferences: {
        targetSoc: 90,
        preferredChargingType: 'fast' as const,
        temperatureControl: true,
        notifications: {
          chargingStart: true,
          chargingComplete: true,
          chargingError: true
        }
      }
    };
    
    const teslaResult = await VehicleManagementService.addVehicle(userId, tesla);
    if (teslaResult.success) {
      console.log('✅ 特斯拉 Model 3 添加成功');
      console.log(`   车牌号: ${teslaResult.vehicle?.licensePlate}`);
      console.log(`   电池容量: ${teslaResult.vehicle?.batteryCapacity}kWh`);
      console.log(`   续航里程: ${teslaResult.vehicle?.range}km`);
      console.log(`   是否默认: ${teslaResult.vehicle?.isDefault ? '是' : '否'}`);
      vehicleIds.push(teslaResult.vehicle?.id || '');
    } else {
      console.log(`❌ 添加失败: ${teslaResult.message}`);
    }

    // 添加第二辆车 - 比亚迪汉EV
    console.log('\n2. 添加比亚迪汉EV:');
    const byd = {
      brand: '比亚迪',
      model: '汉EV',
      year: 2023,
      color: '汉宫红',
      licensePlate: '沪B66666',
      batteryCapacity: 85.4,
      range: 605,
      chargingPortType: 'GB/T' as const,
      chargingPreferences: {
        targetSoc: 80,
        preferredChargingType: 'auto' as const,
        temperatureControl: true,
        chargingSchedule: {
          enabled: true,
          startTime: '23:00',
          endTime: '07:00',
          daysOfWeek: [1, 2, 3, 4, 5] // 工作日
        }
      }
    };
    
    const bydResult = await VehicleManagementService.addVehicle(userId, byd);
    if (bydResult.success) {
      console.log('✅ 比亚迪汉EV 添加成功');
      console.log(`   车牌号: ${bydResult.vehicle?.licensePlate}`);
      console.log(`   电池容量: ${bydResult.vehicle?.batteryCapacity}kWh`);
      console.log(`   续航里程: ${bydResult.vehicle?.range}km`);
      console.log(`   充电计划: ${bydResult.vehicle?.chargingPreferences?.chargingSchedule?.enabled ? '已启用' : '未启用'}`);
      vehicleIds.push(bydResult.vehicle?.id || '');
    } else {
      console.log(`❌ 添加失败: ${bydResult.message}`);
    }

    // 添加第三辆车 - 蔚来ES6
    console.log('\n3. 添加蔚来ES6:');
    const nio = {
      brand: '蔚来',
      model: 'ES6',
      year: 2022,
      color: '星空蓝',
      licensePlate: '粤B99999',
      batteryCapacity: 100,
      range: 610,
      chargingPortType: 'CCS' as const
    };
    
    const nioResult = await VehicleManagementService.addVehicle(userId, nio);
    if (nioResult.success) {
      console.log('✅ 蔚来ES6 添加成功');
      console.log(`   车牌号: ${nioResult.vehicle?.licensePlate}`);
      console.log(`   电池容量: ${nioResult.vehicle?.batteryCapacity}kWh`);
      console.log(`   续航里程: ${nioResult.vehicle?.range}km`);
      vehicleIds.push(nioResult.vehicle?.id || '');
    } else {
      console.log(`❌ 添加失败: ${nioResult.message}`);
    }

    // 尝试添加重复车牌号的车辆
    console.log('\n4. 尝试添加重复车牌号的车辆:');
    const duplicate = {
      brand: '理想',
      model: 'L9',
      licensePlate: '京A88888' // 重复车牌号
    };
    
    const duplicateResult = await VehicleManagementService.addVehicle(userId, duplicate);
    if (!duplicateResult.success) {
      console.log(`✅ 正确拒绝重复车牌号: ${duplicateResult.message}`);
    }

  } catch (error) {
    console.error('❌ 添加车辆失败:', error);
  }
  
  return vehicleIds;
}

async function demonstrateGetVehicles(userId: string) {
  console.log('\n📋 获取车辆列表...');
  
  try {
    const result = await VehicleManagementService.getUserVehicles(userId);
    
    console.log('✅ 车辆列表获取成功:');
    console.log(`   总车辆数: ${result.totalCount}`);
    console.log(`   默认车辆: ${result.defaultVehicle?.brand} ${result.defaultVehicle?.model} (${result.defaultVehicle?.licensePlate})`);
    
    console.log('\n   车辆详情:');
    result.vehicles.forEach((vehicle, index) => {
      console.log(`   ${index + 1}. ${vehicle.brand} ${vehicle.model}`);
      console.log(`      车牌号: ${vehicle.licensePlate}`);
      console.log(`      年份: ${vehicle.year || '未知'}`);
      console.log(`      颜色: ${vehicle.color || '未知'}`);
      console.log(`      电池容量: ${vehicle.batteryCapacity}kWh`);
      console.log(`      续航里程: ${vehicle.range}km`);
      console.log(`      充电接口: ${vehicle.chargingPortType}`);
      console.log(`      是否默认: ${vehicle.isDefault ? '是' : '否'}`);
      if (vehicle.chargingPreferences) {
        console.log(`      目标SOC: ${vehicle.chargingPreferences.targetSoc}%`);
        console.log(`      充电类型偏好: ${getChargingTypeText(vehicle.chargingPreferences.preferredChargingType)}`);
        if (vehicle.chargingPreferences.chargingSchedule?.enabled) {
          console.log(`      充电计划: ${vehicle.chargingPreferences.chargingSchedule.startTime}-${vehicle.chargingPreferences.chargingSchedule.endTime}`);
        }
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ 获取车辆列表失败:', error);
  }
}

async function demonstrateUpdateVehicle(userId: string, vehicleId: string) {
  console.log('\n✏️ 更新车辆信息...');
  
  try {
    const updateInfo = {
      color: '深空灰',
      range: 580, // 更新续航里程
      batteryCapacity: 78 // 更新电池容量
    };
    
    const result = await VehicleManagementService.updateVehicle(userId, vehicleId, updateInfo);
    
    if (result.success) {
      console.log('✅ 车辆信息更新成功');
      console.log(`   车辆: ${result.vehicle?.brand} ${result.vehicle?.model}`);
      console.log(`   新颜色: ${result.vehicle?.color}`);
      console.log(`   新续航: ${result.vehicle?.range}km`);
      console.log(`   新电池容量: ${result.vehicle?.batteryCapacity}kWh`);
    } else {
      console.log(`❌ 更新失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 更新车辆信息失败:', error);
  }
}

async function demonstrateSetDefaultVehicle(userId: string, vehicleId: string) {
  console.log('\n🎯 设置默认车辆...');
  
  try {
    const result = await VehicleManagementService.setDefaultVehicle(userId, vehicleId);
    
    if (result.success) {
      console.log('✅ 默认车辆设置成功');
      
      // 获取更新后的车辆列表
      const vehicles = await VehicleManagementService.getUserVehicles(userId);
      console.log(`   新的默认车辆: ${vehicles.defaultVehicle?.brand} ${vehicles.defaultVehicle?.model} (${vehicles.defaultVehicle?.licensePlate})`);
    } else {
      console.log(`❌ 设置失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 设置默认车辆失败:', error);
  }
}

async function demonstrateUpdateChargingPreferences(userId: string, vehicleId: string) {
  console.log('\n⚡ 更新充电偏好...');
  
  try {
    const preferences = {
      targetSoc: 85,
      maxChargingPower: 120,
      preferredChargingType: 'slow' as const,
      temperatureControl: false,
      chargingSchedule: {
        enabled: true,
        startTime: '22:30',
        endTime: '06:30',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // 每天
      },
      notifications: {
        chargingStart: false,
        chargingComplete: true,
        chargingError: true
      }
    };
    
    const result = await VehicleManagementService.updateChargingPreferences(userId, vehicleId, preferences);
    
    if (result.success) {
      console.log('✅ 充电偏好更新成功');
      console.log('   新设置:');
      console.log(`     目标SOC: ${preferences.targetSoc}%`);
      console.log(`     最大充电功率: ${preferences.maxChargingPower}kW`);
      console.log(`     充电类型偏好: ${getChargingTypeText(preferences.preferredChargingType)}`);
      console.log(`     温度控制: ${preferences.temperatureControl ? '启用' : '禁用'}`);
      console.log(`     充电计划: ${preferences.chargingSchedule.startTime}-${preferences.chargingSchedule.endTime} (每天)`);
      console.log(`     通知设置: 开始(${preferences.notifications.chargingStart ? '开' : '关'}) 完成(${preferences.notifications.chargingComplete ? '开' : '关'}) 错误(${preferences.notifications.chargingError ? '开' : '关'})`);
    } else {
      console.log(`❌ 更新失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 更新充电偏好失败:', error);
  }
}

async function demonstrateGetVehicleDetail(userId: string, vehicleId: string) {
  console.log('\n🔍 获取车辆详情...');
  
  try {
    const vehicle = await VehicleManagementService.getVehicleDetail(userId, vehicleId);
    
    if (vehicle) {
      console.log('✅ 车辆详情获取成功:');
      console.log(`   车辆: ${vehicle.brand} ${vehicle.model}`);
      console.log(`   车牌号: ${vehicle.licensePlate}`);
      console.log(`   年份: ${vehicle.year}`);
      console.log(`   颜色: ${vehicle.color}`);
      console.log(`   电池容量: ${vehicle.batteryCapacity}kWh`);
      console.log(`   续航里程: ${vehicle.range}km`);
      console.log(`   充电接口: ${vehicle.chargingPortType}`);
      console.log(`   是否默认: ${vehicle.isDefault ? '是' : '否'}`);
      
      if (vehicle.chargingPreferences) {
        console.log('\n   充电偏好:');
        console.log(`     目标SOC: ${vehicle.chargingPreferences.targetSoc}%`);
        console.log(`     最大充电功率: ${vehicle.chargingPreferences.maxChargingPower || '未设置'}kW`);
        console.log(`     充电类型偏好: ${getChargingTypeText(vehicle.chargingPreferences.preferredChargingType)}`);
        console.log(`     温度控制: ${vehicle.chargingPreferences.temperatureControl ? '启用' : '禁用'}`);
        
        if (vehicle.chargingPreferences.chargingSchedule?.enabled) {
          console.log(`     充电计划: ${vehicle.chargingPreferences.chargingSchedule.startTime}-${vehicle.chargingPreferences.chargingSchedule.endTime}`);
          console.log(`     计划日期: ${getDaysOfWeekText(vehicle.chargingPreferences.chargingSchedule.daysOfWeek)}`);
        }
      }
    } else {
      console.log('❌ 车辆不存在');
    }
  } catch (error) {
    console.error('❌ 获取车辆详情失败:', error);
  }
}

async function demonstrateDeleteVehicle(userId: string, vehicleId: string) {
  console.log('\n🗑️ 删除车辆...');
  
  try {
    // 先获取要删除的车辆信息
    const vehicle = await VehicleManagementService.getVehicleDetail(userId, vehicleId);
    
    const result = await VehicleManagementService.deleteVehicle(userId, vehicleId);
    
    if (result.success) {
      console.log('✅ 车辆删除成功');
      console.log(`   已删除: ${vehicle?.brand} ${vehicle?.model} (${vehicle?.licensePlate})`);
      
      // 获取删除后的车辆列表
      const vehicles = await VehicleManagementService.getUserVehicles(userId);
      console.log(`   剩余车辆数: ${vehicles.totalCount}`);
      if (vehicles.defaultVehicle) {
        console.log(`   当前默认车辆: ${vehicles.defaultVehicle.brand} ${vehicles.defaultVehicle.model} (${vehicles.defaultVehicle.licensePlate})`);
      }
    } else {
      console.log(`❌ 删除失败: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 删除车辆失败:', error);
  }
}

async function demonstrateGetSupportedBrands() {
  console.log('\n🏭 获取支持的车辆品牌和型号...');
  
  try {
    const brands = VehicleManagementService.getSupportedBrands();
    
    console.log('✅ 支持的车辆品牌:');
    brands.forEach((brand, index) => {
      console.log(`   ${index + 1}. ${brand.brand}`);
      console.log(`      型号: ${brand.models.join(', ')}`);
      console.log('');
    });
    
    // 演示根据品牌获取型号
    console.log('\n🔍 根据品牌获取型号:');
    const teslaModels = VehicleManagementService.getModelsByBrand('特斯拉');
    console.log(`   特斯拉型号: ${teslaModels.join(', ')}`);
    
    const bydModels = VehicleManagementService.getModelsByBrand('比亚迪');
    console.log(`   比亚迪型号: ${bydModels.join(', ')}`);
    
    const invalidModels = VehicleManagementService.getModelsByBrand('不存在的品牌');
    console.log(`   不存在品牌的型号: ${invalidModels.length === 0 ? '无' : invalidModels.join(', ')}`);
    
  } catch (error) {
    console.error('❌ 获取品牌信息失败:', error);
  }
}

async function cleanupTestData(userId: string) {
  console.log('\n🧹 清理测试数据...');
  
  try {
    await User.findByIdAndDelete(userId);
    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

function getChargingTypeText(type?: string): string {
  const typeMap: Record<string, string> = {
    'fast': '快充',
    'slow': '慢充',
    'auto': '自动'
  };
  return typeMap[type || 'auto'] || '自动';
}

function getDaysOfWeekText(days?: number[]): string {
  if (!days || days.length === 0) return '无';
  
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days.map(day => dayNames[day]).join(', ');
}

async function runVehicleManagementDemo() {
  console.log('🚀 开始车辆信息管理功能演示\n');
  
  await connectDatabase();
  
  let userId: string;
  let vehicleIds: string[] = [];
  
  try {
    // 1. 创建测试用户
    userId = await createTestUser();
    
    // 2. 添加车辆信息
    vehicleIds = await demonstrateAddVehicles(userId);
    
    // 3. 获取车辆列表
    await demonstrateGetVehicles(userId);
    
    // 4. 更新车辆信息
    if (vehicleIds.length > 0) {
      await demonstrateUpdateVehicle(userId, vehicleIds[0]);
    }
    
    // 5. 设置默认车辆
    if (vehicleIds.length > 1) {
      await demonstrateSetDefaultVehicle(userId, vehicleIds[1]);
    }
    
    // 6. 更新充电偏好
    if (vehicleIds.length > 0) {
      await demonstrateUpdateChargingPreferences(userId, vehicleIds[0]);
    }
    
    // 7. 获取车辆详情
    if (vehicleIds.length > 0) {
      await demonstrateGetVehicleDetail(userId, vehicleIds[0]);
    }
    
    // 8. 获取支持的品牌和型号
    await demonstrateGetSupportedBrands();
    
    // 9. 删除车辆
    if (vehicleIds.length > 2) {
      await demonstrateDeleteVehicle(userId, vehicleIds[2]);
    }
    
    // 10. 最终车辆列表
    await demonstrateGetVehicles(userId);
    
    console.log('\n🎉 车辆信息管理功能演示完成！');
    
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
  runVehicleManagementDemo().catch(console.error);
}

export { runVehicleManagementDemo };