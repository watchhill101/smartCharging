const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080/api';

// 颜色输出函数
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建测试图片
function createTestImage() {
  const testImagePath = path.join(__dirname, 'test-auto-face.jpg');

  // 创建一个简单的测试图片（1x1像素的JPEG）
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
    0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x9F, 0xFF, 0xD9
  ]);

  fs.writeFileSync(testImagePath, jpegHeader);
  log('blue', `✓ 测试图片创建成功: ${testImagePath}`);
  return testImagePath;
}

// 测试人脸检测
async function testFaceDetection() {
  log('cyan', '\n=== 1. 测试人脸检测 ===');

  try {
    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/detect`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (response.data.success) {
      log('green', '✓ 人脸检测成功');
      log('blue', `  检测结果: ${JSON.stringify(response.data.data, null, 2)}`);
      return true;
    } else {
      log('red', `✗ 人脸检测失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `✗ 人脸检测API调用失败: ${error.message}`);
    return false;
  }
}

// 测试自动注册登录
async function testAutoRegisterLogin() {
  log('cyan', '\n=== 2. 测试自动注册登录 ===');

  try {
    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/auto-register-login`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (response.data.success) {
      log('green', '✓ 自动注册登录成功');
      log('blue', `  用户信息: ${JSON.stringify(response.data.data.user, null, 2)}`);
      log('blue', `  人脸信息: ${JSON.stringify(response.data.data.faceInfo, null, 2)}`);

      if (response.data.data.isNewUser) {
        log('magenta', '  🎉 这是一个新用户！');
      }

      return {
        success: true,
        data: response.data.data
      };
    } else {
      log('red', `✗ 自动注册登录失败: ${response.data.message}`);
      return { success: false };
    }
  } catch (error) {
    log('red', `✗ 自动注册登录API调用失败: ${error.message}`);
    return { success: false };
  }
}

// 测试已注册用户的人脸登录
async function testExistingUserFaceLogin() {
  log('cyan', '\n=== 3. 测试已注册用户人脸登录 ===');

  try {
    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/login`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (response.data.success) {
      log('green', '✓ 已注册用户人脸登录成功');
      log('blue', `  用户信息: ${JSON.stringify(response.data.data.user, null, 2)}`);
      log('blue', `  人脸匹配信息: ${JSON.stringify(response.data.data.faceInfo, null, 2)}`);
      return true;
    } else {
      log('yellow', `⚠ 已注册用户人脸登录失败: ${response.data.message}`);
      log('blue', '  这是正常的，因为可能没有匹配的人脸档案');
      return false;
    }
  } catch (error) {
    log('red', `✗ 已注册用户人脸登录API调用失败: ${error.message}`);
    return false;
  }
}

// 测试获取人脸档案
async function testGetFaceProfiles(token) {
  log('cyan', '\n=== 4. 测试获取人脸档案 ===');

  try {
    const response = await axios.get(`${BASE_URL}/face/profiles`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      log('green', '✓ 获取人脸档案成功');
      log('blue', `  档案数量: ${response.data.data.length}`);

      response.data.data.forEach((profile, index) => {
        log('blue', `  档案${index + 1}: ID=${profile.faceId}, 创建时间=${profile.createdAt}`);
      });

      return true;
    } else {
      log('red', `✗ 获取人脸档案失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `✗ 获取人脸档案API调用失败: ${error.message}`);
    return false;
  }
}

// 测试获取登录记录
async function testGetLoginRecords(token) {
  log('cyan', '\n=== 5. 测试获取登录记录 ===');

  try {
    const response = await axios.get(`${BASE_URL}/face/login-records`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      log('green', '✓ 获取登录记录成功');
      log('blue', `  记录数量: ${response.data.data.length}`);

      response.data.data.forEach((record, index) => {
        const status = record.success ? '成功' : '失败';
        log('blue', `  记录${index + 1}: ${status}, 置信度=${record.confidence}, 时间=${record.loginAt}`);
      });

      return true;
    } else {
      log('red', `✗ 获取登录记录失败: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    log('red', `✗ 获取登录记录API调用失败: ${error.message}`);
    return false;
  }
}

// 测试健康检查
async function testHealthCheck() {
  log('cyan', '\n=== 0. 后端服务健康检查 ===');

  try {
    const response = await axios.get(`${BASE_URL.replace('/api', '')}/health`);

    if (response.data.status === 'OK') {
      log('green', '✓ 后端服务正常运行');
      return true;
    } else {
      log('red', '✗ 后端服务状态异常');
      return false;
    }
  } catch (error) {
    log('red', '✗ 后端服务未启动或无法连接');
    log('yellow', '  请确保后端服务正在运行在 http://localhost:8080');
    return false;
  }
}

// 清理测试文件
function cleanup() {
  const testFiles = [
    path.join(__dirname, 'test-auto-face.jpg')
  ];

  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      log('blue', `✓ 清理测试文件: ${path.basename(file)}`);
    }
  });
}

// 主测试函数
async function runTests() {
  log('blue', '🚀 开始自动人脸检测和登录功能测试...\n');

  // 检查后端服务
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    log('red', '❌ 后端服务不可用，测试终止');
    return;
  }

  let allTestsPassed = true;
  let registrationResult = null;

  // 测试人脸检测
  const detectionOk = await testFaceDetection();
  if (!detectionOk) {
    allTestsPassed = false;
  }

  // 测试自动注册登录
  registrationResult = await testAutoRegisterLogin();
  if (!registrationResult.success) {
    allTestsPassed = false;
  }

  // 如果注册成功，进行后续测试
  if (registrationResult.success && registrationResult.data.token) {
    const token = registrationResult.data.token;

    // 测试已注册用户登录
    await testExistingUserFaceLogin();

    // 测试获取人脸档案
    const profilesOk = await testGetFaceProfiles(token);
    if (!profilesOk) {
      allTestsPassed = false;
    }

    // 测试获取登录记录
    const recordsOk = await testGetLoginRecords(token);
    if (!recordsOk) {
      allTestsPassed = false;
    }
  }

  // 清理测试文件
  cleanup();

  // 总结
  log('cyan', '\n=== 测试总结 ===');
  if (allTestsPassed && registrationResult.success) {
    log('green', '🎉 所有测试通过！自动人脸检测和登录功能正常');
    log('blue', '功能特点:');
    log('blue', '  ✓ 自动检测人脸');
    log('blue', '  ✓ 新用户自动注册');
    log('blue', '  ✓ 已有用户自动登录');
    log('blue', '  ✓ 人脸档案管理');
    log('blue', '  ✓ 登录记录跟踪');
  } else {
    log('red', '❌ 部分测试失败，请检查日志');
  }

  log('blue', '\n✨ 测试完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(error => {
    log('red', `✗ 测试执行出错: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests }; 