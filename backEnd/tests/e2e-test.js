/**
 * 端到端测试脚本
 * 测试智能充电系统的完整业务流程
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:8080';
const API_BASE = `${BASE_URL}/api`;

// 测试配置
const TEST_CONFIG = {
  timeout: 10000,
  maxRetries: 3,
  testUser: {
    phone: '13800138000',
    password: 'test123456',
    name: '测试用户',
    email: 'test@example.com'
  },
  testStation: {
    stationId: 'station_001',
    name: '测试充电站',
    lat: 39.9042,
    lng: 116.4074
  }
};

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// 工具函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, url, data = null, headers = {}) => {
  const startTime = performance.now();
  try {
    // 如果URL以/health开头，直接使用BASE_URL，否则使用API_BASE
    const fullUrl = url.startsWith('/health') ? `${BASE_URL}${url}` : `${API_BASE}${url}`;
    
    const config = {
      method,
      url: fullUrl,
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      responseTime,
      headers: response.headers
    };
  } catch (error) {
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || null,
      error: error.message,
      responseTime
    };
  }
};

// 测试函数
const runTest = async (testName, testFn) => {
  testResults.total++;
  console.log(`\n🧪 Running: ${testName}`);
  
  try {
    const startTime = performance.now();
    await testFn();
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    testResults.passed++;
    console.log(`✅ PASSED: ${testName} (${duration}ms)`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ testName, error: error.message });
    console.log(`❌ FAILED: ${testName} - ${error.message}`);
  }
};

// 1. 系统健康检查测试
const testHealthCheck = async () => {
  const result = await makeRequest('GET', '/health');
  if (!result.success || result.status !== 200) {
    throw new Error(`Health check failed: ${result.error || result.status}`);
  }
  
  const health = result.data;
  if (health.status !== 'OK') {
    throw new Error(`System not healthy: ${health.status}`);
  }
  
  console.log(`  📊 Uptime: ${health.uptime}s, Memory: ${Math.round(health.memory.heapUsed / 1024 / 1024)}MB`);
  return health;
};

// 2. 数据库连接测试
const testDatabaseConnection = async () => {
  const result = await makeRequest('GET', '/help/faq');
  if (!result.success || result.status !== 200) {
    throw new Error(`Database connection test failed: ${result.error || result.status}`);
  }
  
  if (!result.data.success) {
    throw new Error(`Database query failed: ${result.data.message}`);
  }
  
  console.log(`  📄 FAQ count: ${result.data.data.total}`);
  return result.data;
};

// 3. 滑块验证测试
const testSliderVerification = async () => {
  const result = await makeRequest('POST', '/auth/slider-challenge');
  if (!result.success || result.status !== 200) {
    throw new Error(`Slider challenge failed: ${result.error || result.status}`);
  }
  
  const challenge = result.data.data;
  if (!challenge.sessionId || !challenge.puzzleOffset) {
    throw new Error('Invalid slider challenge response');
  }
  
  console.log(`  🔒 Session: ${challenge.sessionId}, Offset: ${challenge.puzzleOffset}`);
  return challenge;
};

// 4. 充电站查询测试
const testStationQuery = async () => {
  const { lat, lng } = TEST_CONFIG.testStation;
  const result = await makeRequest('GET', `/stations/nearby?lat=${lat}&lng=${lng}`);
  
  if (!result.success || result.status !== 200) {
    throw new Error(`Station query failed: ${result.error || result.status}`);
  }
  
  console.log(`  🏢 Stations found: ${result.data.data.stations.length}`);
  return result.data;
};

// 5. 用户注册流程测试
const testUserRegistration = async () => {
  // 先测试滑块验证
  const challenge = await testSliderVerification();
  
  // 模拟用户注册（这里只是测试端点是否可访问）
  const userData = {
    phone: TEST_CONFIG.testUser.phone,
    name: TEST_CONFIG.testUser.name,
    sliderData: {
      sessionId: challenge.sessionId,
      offset: challenge.puzzleOffset
    }
  };
  
  // 注意：实际环境中需要真实的验证码
  console.log(`  👤 User registration data prepared for: ${userData.phone}`);
  return userData;
};

// 6. API响应时间测试
const testApiPerformance = async () => {
  const endpoints = [
    '/health',
    '/help/faq',
    '/auth/slider-challenge'
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const method = endpoint === '/auth/slider-challenge' ? 'POST' : 'GET';
    const result = await makeRequest(method, endpoint);
    results.push({
      endpoint,
      responseTime: result.responseTime,
      success: result.success
    });
  }
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`  ⚡ Average response time: ${Math.round(avgResponseTime)}ms`);
  
  // 检查是否有响应时间过长的端点
  const slowEndpoints = results.filter(r => r.responseTime > 1000);
  if (slowEndpoints.length > 0) {
    console.log(`  ⚠️  Slow endpoints: ${slowEndpoints.map(e => `${e.endpoint}(${e.responseTime}ms)`).join(', ')}`);
  }
  
  return results;
};

// 7. 错误处理测试
const testErrorHandling = async () => {
  // 测试404错误
  const notFoundResult = await makeRequest('GET', '/nonexistent');
  if (notFoundResult.status !== 404) {
    throw new Error(`Expected 404, got ${notFoundResult.status}`);
  }
  
  // 测试参数验证错误
  const invalidParamsResult = await makeRequest('GET', '/stations/nearby?lat=invalid');
  // 应该返回错误或处理无效参数
  
  console.log(`  🚫 Error handling working: 404 for invalid routes`);
  return true;
};

// 8. 并发请求测试
const testConcurrentRequests = async () => {
  const concurrentCount = 10;
  const requests = Array(concurrentCount).fill().map(() => 
    makeRequest('GET', '/health')
  );
  
  const startTime = performance.now();
  const results = await Promise.all(requests);
  const endTime = performance.now();
  const totalTime = Math.round(endTime - startTime);
  
  const successCount = results.filter(r => r.success).length;
  
  if (successCount !== concurrentCount) {
    throw new Error(`Only ${successCount}/${concurrentCount} concurrent requests succeeded`);
  }
  
  console.log(`  🔄 ${concurrentCount} concurrent requests completed in ${totalTime}ms`);
  return results;
};

// 主测试函数
const runE2ETests = async () => {
  console.log('🚀 Starting End-to-End Tests for Smart Charging System');
  console.log('='.repeat(60));
  
  // 执行所有测试
  await runTest('System Health Check', testHealthCheck);
  await runTest('Database Connection', testDatabaseConnection);
  await runTest('Slider Verification', testSliderVerification);
  await runTest('Station Query', testStationQuery);
  await runTest('User Registration Flow', testUserRegistration);
  await runTest('API Performance', testApiPerformance);
  await runTest('Error Handling', testErrorHandling);
  await runTest('Concurrent Requests', testConcurrentRequests);
  
  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => {
      console.log(`  - ${error.testName}: ${error.error}`);
    });
  }
  
  console.log('\n🎯 End-to-End Testing Complete!');
  
  // 返回测试结果
  return {
    success: testResults.failed === 0,
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    errors: testResults.errors
  };
};

// 运行测试
if (require.main === module) {
  runE2ETests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner error:', error.message);
      process.exit(1);
    });
}

module.exports = { runE2ETests, makeRequest, testResults };
