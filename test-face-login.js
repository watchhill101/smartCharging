const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 配置
const BASE_URL = 'http://localhost:8080/api';
let authToken = '';
let userId = '';

// 测试用户手机号
const TEST_PHONE = '13800138000';
const TEST_VERIFY_CODE = '123456'; // 开发环境下的测试验证码

// 颜色输出函数
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 创建测试图片（模拟人脸图片）
function createTestImage() {
  const testImagePath = path.join(__dirname, 'test-face.jpg');

  // 如果测试图片不存在，创建一个简单的测试文件
  if (!fs.existsSync(testImagePath)) {
    // 创建一个简单的JPEG头部（最小可用的JPEG文件）
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
    ]);

    // 在中间填充一些数据，使其看起来像一个真实的图片
    const padding = Buffer.alloc(2048, 0x80); // 填充2KB数据
    const testImageData = Buffer.concat([
      jpegHeader.slice(0, -2), // 去掉结束标记
      padding,
      jpegHeader.slice(-2) // 添加结束标记
    ]);

    fs.writeFileSync(testImagePath, testImageData);
    log('blue', `✓ 创建测试图片: ${testImagePath}`);
  }

  return testImagePath;
}

// 1. 用户注册/登录（获取认证token）
async function loginUser() {
  try {
    log('blue', '\n=== 1. 用户登录 ===');

    // 先发送验证码
    const codeResponse = await axios.post(`${BASE_URL}/auth/send-verify-code`, {
      phone: TEST_PHONE
    });

    if (codeResponse.data.success) {
      log('green', '✓ 验证码发送成功');
      if (codeResponse.data.data.code) {
        log('yellow', `  验证码: ${codeResponse.data.data.code}`);
      }
    }

    // 使用验证码登录
    const loginResponse = await axios.post(`${BASE_URL}/auth/login-with-code`, {
      phone: TEST_PHONE,
      verifyCode: codeResponse.data.data.code || TEST_VERIFY_CODE,
      verifyToken: 'test_slider_token' // 模拟滑块验证token
    });

    if (loginResponse.data.success) {
      authToken = loginResponse.data.data.token;
      userId = loginResponse.data.data.user.id;
      log('green', '✓ 用户登录成功');
      log('yellow', `  用户ID: ${userId}`);
      log('yellow', `  Token: ${authToken.substring(0, 20)}...`);
      return true;
    } else {
      throw new Error(loginResponse.data.message);
    }
  } catch (error) {
    log('red', `✗ 用户登录失败: ${error.message}`);
    return false;
  }
}

// 2. 测试人脸检测
async function testFaceDetection() {
  try {
    log('blue', '\n=== 2. 测试人脸检测 ===');

    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/detect`, formData, {
      headers: {
        ...formData.getHeaders(),
      }
    });

    if (response.data.success) {
      log('green', '✓ 人脸检测成功');
      log('yellow', `  检测结果: ${JSON.stringify(response.data.data, null, 2)}`);
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    log('red', `✗ 人脸检测失败: ${error.message}`);
    return null;
  }
}

// 3. 注册人脸档案
async function registerFaceProfile() {
  try {
    log('blue', '\n=== 3. 注册人脸档案 ===');

    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/register`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      log('green', '✓ 人脸档案注册成功');
      log('yellow', `  人脸ID: ${response.data.data.faceId}`);
      log('yellow', `  置信度: ${response.data.data.confidence}`);
      log('yellow', `  质量: ${response.data.data.quality}`);
      return response.data.data.faceId;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    log('red', `✗ 人脸档案注册失败: ${error.message}`);
    return null;
  }
}

// 4. 测试人脸登录
async function testFaceLogin() {
  try {
    log('blue', '\n=== 4. 测试人脸登录 ===');

    const imagePath = createTestImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    const response = await axios.post(`${BASE_URL}/face/login`, formData, {
      headers: {
        ...formData.getHeaders(),
      }
    });

    if (response.data.success) {
      log('green', '✓ 人脸登录成功');
      log('yellow', `  用户ID: ${response.data.data.user.id}`);
      log('yellow', `  用户昵称: ${response.data.data.user.nickName}`);
      log('yellow', `  人脸ID: ${response.data.data.faceInfo.faceId}`);
      log('yellow', `  相似度: ${response.data.data.faceInfo.similarity}`);
      log('yellow', `  置信度: ${response.data.data.faceInfo.confidence}`);
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    log('red', `✗ 人脸登录失败: ${error.message}`);
    return null;
  }
}

// 5. 获取人脸档案列表
async function getFaceProfiles() {
  try {
    log('blue', '\n=== 5. 获取人脸档案列表 ===');

    const response = await axios.get(`${BASE_URL}/face/profiles`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      log('green', '✓ 获取人脸档案列表成功');
      log('yellow', `  档案数量: ${response.data.data.total}`);
      response.data.data.profiles.forEach((profile, index) => {
        log('yellow', `  档案${index + 1}: ${profile.faceId} (置信度: ${profile.confidence})`);
      });
      return response.data.data.profiles;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    log('red', `✗ 获取人脸档案列表失败: ${error.message}`);
    return [];
  }
}

// 6. 获取人脸登录记录
async function getFaceLoginRecords() {
  try {
    log('blue', '\n=== 6. 获取人脸登录记录 ===');

    const response = await axios.get(`${BASE_URL}/face/login-records?page=1&limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      log('green', '✓ 获取登录记录成功');
      log('yellow', `  记录数量: ${response.data.data.pagination.totalRecords}`);
      response.data.data.records.forEach((record, index) => {
        log('yellow', `  记录${index + 1}: ${record.success ? '成功' : '失败'} - ${record.faceId} (${new Date(record.loginAt).toLocaleString()})`);
      });
      return response.data.data.records;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    log('red', `✗ 获取登录记录失败: ${error.message}`);
    return [];
  }
}

// 主测试函数
async function runTests() {
  log('blue', '🚀 开始人脸登录功能测试...\n');

  // 检查后端服务
  try {
    await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    log('green', '✓ 后端服务正常运行');
  } catch (error) {
    log('red', '✗ 后端服务未启动，请先启动后端服务');
    return;
  }

  // 运行测试流程
  const loginSuccess = await loginUser();
  if (!loginSuccess) {
    log('red', '✗ 用户登录失败，终止测试');
    return;
  }

  // 测试人脸检测
  const detectionResult = await testFaceDetection();
  if (!detectionResult) {
    log('red', '✗ 人脸检测失败，但继续其他测试');
  }

  // 注册人脸档案
  const faceId = await registerFaceProfile();
  if (!faceId) {
    log('red', '✗ 人脸档案注册失败，但继续其他测试');
  }

  // 测试人脸登录
  const loginResult = await testFaceLogin();
  if (!loginResult) {
    log('red', '✗ 人脸登录失败');
  }

  // 获取人脸档案列表
  await getFaceProfiles();

  // 获取登录记录
  await getFaceLoginRecords();

  // 清理测试文件
  const testImagePath = path.join(__dirname, 'test-face.jpg');
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
    log('blue', '✓ 清理测试文件');
  }

  log('blue', '\n🎉 人脸登录功能测试完成！');
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    log('red', `✗ 测试执行出错: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests }; 