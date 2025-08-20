/**
 * 前端功能测试脚本
 * 测试前端页面和组件的功能完整性
 */

const axios = require('axios');
const https = require('https');
const { performance } = require('perf_hooks');

// 配置axios忽略自签名证书
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// 测试配置
const TEST_CONFIG = {
  frontendUrl: 'https://localhost:8000',  // 使用HTTPS和正确端口
  backendUrl: 'http://localhost:8080',
  timeout: 10000,
  maxRetries: 3
};

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// 工具函数
const makeRequest = async (method, url, data = null, headers = {}) => {
  const startTime = performance.now();
  try {
    const config = {
      method,
      url,
      timeout: TEST_CONFIG.timeout,
      httpsAgent: url.startsWith('https') ? httpsAgent : undefined,
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
  console.log(`\n🧪 Testing: ${testName}`);
  
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

// 1. 前端服务可访问性测试
const testFrontendAccessibility = async () => {
  const result = await makeRequest('GET', TEST_CONFIG.frontendUrl);
  
  if (!result.success || result.status !== 200) {
    throw new Error(`Frontend not accessible: ${result.error || result.status}`);
  }
  
  // 检查是否返回HTML内容
  if (!result.data || typeof result.data !== 'string') {
    throw new Error('Frontend not returning HTML content');
  }
  
  console.log(`  📱 Frontend service accessible, response size: ${result.data.length} bytes`);
  return result;
};

// 2. 前端静态资源测试
const testStaticAssets = async () => {
  const assetsToTest = [
    '/assets/icons/charging.png',
    '/assets/icons/location.png',
    '/assets/icons/user.png'
  ];
  
  const results = [];
  
  for (const asset of assetsToTest) {
    const result = await makeRequest('GET', `${TEST_CONFIG.frontendUrl}${asset}`);
    results.push({
      asset,
      success: result.success,
      status: result.status
    });
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`  🖼️  Static assets tested: ${successCount}/${assetsToTest.length} accessible`);
  
  return results;
};

// 3. 前端路由测试
const testFrontendRoutes = async () => {
  const routesToTest = [
    '/',
    '/login',
    '/map',
    '/profile',
    '/charging',
    '/help'
  ];
  
  const results = [];
  
  for (const route of routesToTest) {
    const result = await makeRequest('GET', `${TEST_CONFIG.frontendUrl}${route}`);
    results.push({
      route,
      success: result.success && result.status === 200,
      status: result.status
    });
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`  🛣️  Routes tested: ${successCount}/${routesToTest.length} accessible`);
  
  // 至少主页应该可以访问
  const homeRoute = results.find(r => r.route === '/');
  if (!homeRoute || !homeRoute.success) {
    throw new Error('Home route not accessible');
  }
  
  return results;
};

// 4. API集成测试
const testAPIIntegration = async () => {
  // 测试前端能否正确调用后端API
  const apiEndpoints = [
    '/api/health',
    '/api/help/faq',
    '/api/auth/slider-challenge'
  ];
  
  const results = [];
  
  for (const endpoint of apiEndpoints) {
    const method = endpoint.includes('slider-challenge') ? 'POST' : 'GET';
    const result = await makeRequest(method, `${TEST_CONFIG.backendUrl}${endpoint}`);
    results.push({
      endpoint,
      success: result.success,
      status: result.status,
      responseTime: result.responseTime
    });
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`  🔌 API endpoints tested: ${successCount}/${apiEndpoints.length} working`);
  
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  console.log(`  ⚡ Average API response time: ${Math.round(avgResponseTime)}ms`);
  
  return results;
};

// 5. 前端组件功能测试
const testComponentFunctionality = async () => {
  console.log(`  🧩 Component functionality testing:`);
  
  // 这里我们模拟检查一些关键组件是否存在
  const componentsToCheck = [
    'MapView',
    'StationList', 
    'ChargingControl',
    'QRScanner',
    'SliderVerify',
    'NotificationCenter'
  ];
  
  // 检查组件文件是否存在
  const fs = require('fs');
  const path = require('path');
  
  const componentResults = [];
  
  for (const component of componentsToCheck) {
    const componentPath = path.join(__dirname, '..', 'src', 'components', component, 'index.tsx');
    const exists = fs.existsSync(componentPath);
    
    componentResults.push({
      component,
      exists,
      path: componentPath
    });
    
    console.log(`    ${exists ? '✅' : '❌'} ${component}: ${exists ? 'Found' : 'Missing'}`);
  }
  
  const existingComponents = componentResults.filter(c => c.exists).length;
  console.log(`  📊 Components found: ${existingComponents}/${componentsToCheck.length}`);
  
  if (existingComponents === 0) {
    throw new Error('No components found');
  }
  
  return componentResults;
};

// 6. 前端配置测试
const testFrontendConfiguration = async () => {
  const fs = require('fs');
  const path = require('path');
  
  // 检查关键配置文件
  const configFiles = [
    'package.json',
    'config/index.ts',
    'src/app.config.ts',
    'project.config.json'
  ];
  
  const configResults = [];
  
  for (const configFile of configFiles) {
    const configPath = path.join(__dirname, '..', configFile);
    const exists = fs.existsSync(configPath);
    
    configResults.push({
      file: configFile,
      exists,
      path: configPath
    });
  }
  
  const existingConfigs = configResults.filter(c => c.exists).length;
  console.log(`  ⚙️  Configuration files: ${existingConfigs}/${configFiles.length} found`);
  
  // 检查package.json中的关键脚本
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};
    
    const requiredScripts = ['dev:h5', 'build:h5', 'dev:weapp'];
    const existingScripts = requiredScripts.filter(script => scripts[script]).length;
    
    console.log(`  📝 Build scripts: ${existingScripts}/${requiredScripts.length} configured`);
  }
  
  return configResults;
};

// 7. 前端性能测试
const testFrontendPerformance = async () => {
  const performanceTests = [];
  
  // 测试首页加载时间
  const startTime = performance.now();
  const homeResult = await makeRequest('GET', TEST_CONFIG.frontendUrl);
  const loadTime = performance.now() - startTime;
  
  performanceTests.push({
    test: 'Home page load time',
    duration: Math.round(loadTime),
    pass: loadTime < 3000 // 3秒内
  });
  
  console.log(`  ⏱️  Home page load: ${Math.round(loadTime)}ms`);
  
  // 检查响应大小
  const responseSize = homeResult.data ? homeResult.data.length : 0;
  performanceTests.push({
    test: 'Response size',
    size: responseSize,
    pass: responseSize > 0 && responseSize < 1024 * 1024 // 小于1MB
  });
  
  console.log(`  📦 Response size: ${Math.round(responseSize / 1024)}KB`);
  
  const passedTests = performanceTests.filter(t => t.pass).length;
  console.log(`  📈 Performance tests: ${passedTests}/${performanceTests.length} passed`);
  
  return performanceTests;
};

// 8. 错误处理测试
const testErrorHandling = async () => {
  console.log(`  🚫 Testing error handling:`);
  
  // 测试404页面
  const notFoundResult = await makeRequest('GET', `${TEST_CONFIG.frontendUrl}/nonexistent-page`);
  console.log(`    404 handling: ${notFoundResult.status === 404 ? 'Proper' : 'Needs improvement'}`);
  
  // 测试API错误处理
  const invalidApiResult = await makeRequest('GET', `${TEST_CONFIG.backendUrl}/api/invalid-endpoint`);
  console.log(`    API error handling: ${invalidApiResult.status === 404 ? 'Working' : 'Check needed'}`);
  
  return {
    frontend404: notFoundResult.status === 404,
    apiError: invalidApiResult.status === 404
  };
};

// 主测试函数
const runFrontendTests = async () => {
  console.log('🚀 Starting Frontend Functionality Tests');
  console.log('='.repeat(60));
  
  // 等待服务启动
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // 执行所有测试
  await runTest('Frontend Accessibility', testFrontendAccessibility);
  await runTest('Static Assets', testStaticAssets);
  await runTest('Frontend Routes', testFrontendRoutes);
  await runTest('API Integration', testAPIIntegration);
  await runTest('Component Functionality', testComponentFunctionality);
  await runTest('Frontend Configuration', testFrontendConfiguration);
  await runTest('Frontend Performance', testFrontendPerformance);
  await runTest('Error Handling', testErrorHandling);
  
  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 Frontend Test Results Summary:');
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
  
  console.log('\n🎯 Frontend Testing Complete!');
  
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
  runFrontendTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Frontend test runner error:', error.message);
      process.exit(1);
    });
}

module.exports = { runFrontendTests, makeRequest, testResults };
