const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testAPI() {
  console.log('🧪 开始测试API端点...\n');

  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查端点...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ 健康检查:', healthResponse.data);
    console.log();

    // 2. 测试人脸API健康检查
    console.log('2. 测试人脸API健康检查端点...');
    try {
      const faceHealthResponse = await axios.get(`${BASE_URL}/api/auth/face-api-health`);
      console.log('✅ 人脸API健康检查:', faceHealthResponse.data);
    } catch (error) {
      console.log('❌ 人脸API健康检查失败:', error.response?.data || error.message);
    }
    console.log();

    // 3. 测试用户注册
    console.log('3. 测试用户注册...');
    const registerData = {
      phone: '13800138888',
      password: '123456',
      nickName: '测试用户'
    };

    try {
      const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
      console.log('✅ 用户注册成功:', registerResponse.data);

      const token = registerResponse.data.data.token;
      const userId = registerResponse.data.data.user.id;

      // 4. 测试验证历史记录端点
      console.log('4. 测试验证历史记录端点...');
      try {
        const historyResponse = await axios.get(`${BASE_URL}/api/users/verification-history`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ 验证历史记录:', historyResponse.data);
      } catch (error) {
        console.log('❌ 验证历史记录失败:', error.response?.data || error.message);
      }

      // 5. 创建一些测试验证记录
      console.log('5. 创建测试验证记录...');
      try {
        // 这里我们需要直接操作数据库，因为需要MongoDB连接
        console.log('ℹ️  需要数据库连接来创建测试记录');
      } catch (error) {
        console.log('❌ 创建测试记录失败:', error.message);
      }

    } catch (registerError) {
      if (registerError.response?.status === 409) {
        console.log('ℹ️  用户已存在，尝试登录...');

        // 尝试登录
        try {
          const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: registerData.phone,
            password: registerData.password
          });
          console.log('✅ 登录成功:', loginResponse.data);

          const token = loginResponse.data.data.token;

          // 测试验证历史记录
          const historyResponse = await axios.get(`${BASE_URL}/api/users/verification-history`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('✅ 验证历史记录:', historyResponse.data);

        } catch (loginError) {
          console.log('❌ 登录失败:', loginError.response?.data || loginError.message);
        }
      } else {
        console.log('❌ 注册失败:', registerError.response?.data || registerError.message);
      }
    }

  } catch (error) {
    console.log('❌ API测试失败:', error.message);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log('✅ 服务器正在运行\n');
    return true;
  } catch (error) {
    console.log('❌ 服务器未运行，请先启动后端服务器');
    console.log('运行命令: cd backEnd && npm start\n');
    return false;
  }
}

async function main() {
  console.log('🚀 Smart Charging API 测试工具\n');

  const serverRunning = await checkServer();
  if (serverRunning) {
    await testAPI();
  }

  console.log('\n🏁 测试完成');
}

main().catch(console.error); 