const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 创建一个简单的JPEG图像
function createSimpleImage() {
  // 创建一个更大的测试文件（重复数据以增加大小）
  const baseData = 'test image data for face detection - ';
  const repeatedData = baseData.repeat(10); // 重复10次
  const jpegData = Buffer.from(repeatedData);
  fs.writeFileSync('simple-test.jpg', jpegData);
  console.log('📷 创建测试图片，大小:', jpegData.length, 'bytes');
  return 'simple-test.jpg';
}

async function testSingleAPI() {
  try {
    console.log('🧪 测试单个人脸检测API...');

    const imagePath = createSimpleImage();
    const formData = new FormData();
    formData.append('image', fs.createReadStream(imagePath));

    console.log('📤 发送请求到 /api/face/auto-register-login');

    const response = await axios.post('http://localhost:8080/api/face/auto-register-login', formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    console.log('✅ 响应状态:', response.status);
    console.log('📄 响应数据:', JSON.stringify(response.data, null, 2));

    // 清理文件
    fs.unlinkSync(imagePath);

  } catch (error) {
    console.error('❌ 错误:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应头:', error.response.headers);
    }
  }
}

testSingleAPI(); 