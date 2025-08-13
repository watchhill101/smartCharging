const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:8080/api/auth';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-face.jpg'); // 需要准备一张测试图片

// 创建测试图片（如果不存在）
const createTestImage = () => {
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.log('⚠️  请在 test/ 目录下放置一张名为 test-face.jpg 的人脸图片用于测试');
    return false;
  }
  return true;
};

// 测试人脸检测
const testFaceDetection = async () => {
  console.log('\n🔍 测试人脸检测...');

  try {
    if (!createTestImage()) return;

    const formData = new FormData();
    formData.append('image', fs.createReadStream(TEST_IMAGE_PATH));

    const response = await axios.post(`${BASE_URL}/face-detect`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    console.log('✅ 人脸检测测试成功:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ 人脸检测测试失败:');
    console.log('错误:', error.response?.data || error.message);
  }
};

// 测试人脸比较
const testFaceComparison = async () => {
  console.log('\n🔄 测试人脸比较...');

  try {
    if (!createTestImage()) return;

    const formData = new FormData();
    formData.append('image1', fs.createReadStream(TEST_IMAGE_PATH));
    formData.append('image2', fs.createReadStream(TEST_IMAGE_PATH)); // 使用同一张图片

    const response = await axios.post(`${BASE_URL}/face-compare`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    console.log('✅ 人脸比较测试成功:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ 人脸比较测试失败:');
    console.log('错误:', error.response?.data || error.message);
  }
};

// 测试人脸属性识别
const testFaceAttributes = async () => {
  console.log('\n👤 测试人脸属性识别...');

  try {
    if (!createTestImage()) return;

    const formData = new FormData();
    formData.append('image', fs.createReadStream(TEST_IMAGE_PATH));

    const response = await axios.post(`${BASE_URL}/face-attributes`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    console.log('✅ 人脸属性识别测试成功:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ 人脸属性识别测试失败:');
    console.log('错误:', error.response?.data || error.message);
  }
};

// 测试综合人脸验证
const testFaceVerification = async () => {
  console.log('\n🎯 测试综合人脸验证...');

  try {
    if (!createTestImage()) return;

    const formData = new FormData();
    formData.append('image', fs.createReadStream(TEST_IMAGE_PATH));
    formData.append('userId', 'test-user-123');
    formData.append('action', 'detect');

    const response = await axios.post(`${BASE_URL}/face-verify`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    console.log('✅ 综合人脸验证测试成功:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ 综合人脸验证测试失败:');
    console.log('错误:', error.response?.data || error.message);
  }
};

// 运行所有测试
const runAllTests = async () => {
  console.log('🚀 开始人脸验证API测试...');
  console.log('📋 确保后端服务正在运行在 http://localhost:8080');
  console.log('🔑 确保设置了 CLOUDMERSIVE_API_KEY 环境变量');

  await testFaceDetection();
  await testFaceComparison();
  await testFaceAttributes();
  await testFaceVerification();

  console.log('\n✨ 测试完成！');
};

// 如果直接运行此文件
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testFaceDetection,
  testFaceComparison,
  testFaceAttributes,
  testFaceVerification,
  runAllTests
}; 