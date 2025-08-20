/**
 * 前端组件结构测试
 * 测试组件文件结构和代码质量
 */

const fs = require('fs');
const path = require('path');

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// 测试函数
const runTest = async (testName, testFn) => {
  testResults.total++;
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    await testFn();
    testResults.passed++;
    console.log(`✅ PASSED: ${testName}`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ testName, error: error.message });
    console.log(`❌ FAILED: ${testName} - ${error.message}`);
  }
};

// 1. 检查核心组件结构
const testCoreComponents = async () => {
  const componentsDir = path.join(__dirname, '..', 'src', 'components');
  
  const expectedComponents = [
    'MapView',
    'StationList', 
    'StationDetail',
    'ChargingControl',
    'ChargingStatus',
    'QRScanner',
    'SliderVerify',
    'FaceLogin',
    'NotificationCenter',
    'Icon',
    'LazyLoad'
  ];
  
  const foundComponents = [];
  const missingComponents = [];
  
  for (const component of expectedComponents) {
    const componentPath = path.join(componentsDir, component);
    const indexPath = path.join(componentPath, 'index.tsx');
    const stylePath = path.join(componentPath, 'index.scss');
    
    if (fs.existsSync(indexPath)) {
      foundComponents.push({
        name: component,
        hasIndex: true,
        hasStyles: fs.existsSync(stylePath),
        path: componentPath
      });
    } else {
      missingComponents.push(component);
    }
  }
  
  console.log(`  📦 Components found: ${foundComponents.length}/${expectedComponents.length}`);
  
  foundComponents.forEach(comp => {
    console.log(`    ✅ ${comp.name} (${comp.hasStyles ? 'with styles' : 'no styles'})`);
  });
  
  if (missingComponents.length > 0) {
    console.log(`  ❌ Missing components: ${missingComponents.join(', ')}`);
  }
  
  if (foundComponents.length === 0) {
    throw new Error('No components found');
  }
  
  return { found: foundComponents, missing: missingComponents };
};

// 2. 检查页面结构
const testPageStructure = async () => {
  const pagesDir = path.join(__dirname, '..', 'src', 'pages');
  
  const expectedPages = [
    'index',
    'login',
    'map',
    'profile',
    'charging',
    'help',
    'scan',
    'notifications'
  ];
  
  const foundPages = [];
  const missingPages = [];
  
  for (const page of expectedPages) {
    const pagePath = path.join(pagesDir, page);
    const indexPath = path.join(pagePath, 'index.tsx');
    const configPath = path.join(pagePath, 'index.config.ts');
    const stylePath = path.join(pagePath, 'index.scss');
    
    if (fs.existsSync(indexPath)) {
      foundPages.push({
        name: page,
        hasIndex: true,
        hasConfig: fs.existsSync(configPath),
        hasStyles: fs.existsSync(stylePath),
        path: pagePath
      });
    } else {
      missingPages.push(page);
    }
  }
  
  console.log(`  📄 Pages found: ${foundPages.length}/${expectedPages.length}`);
  
  foundPages.forEach(page => {
    const features = [];
    if (page.hasConfig) features.push('config');
    if (page.hasStyles) features.push('styles');
    console.log(`    ✅ ${page.name} (${features.length > 0 ? features.join(', ') : 'basic'})`);
  });
  
  if (missingPages.length > 0) {
    console.log(`  ❌ Missing pages: ${missingPages.join(', ')}`);
  }
  
  return { found: foundPages, missing: missingPages };
};

// 3. 检查服务文件
const testServiceFiles = async () => {
  const servicesDir = path.join(__dirname, '..', 'src', 'services');
  
  const expectedServices = [
    'AmapService.ts',
    'WebSocketService.ts',
    'WebSocketClient.ts'
  ];
  
  const foundServices = [];
  const missingServices = [];
  
  for (const service of expectedServices) {
    const servicePath = path.join(servicesDir, service);
    
    if (fs.existsSync(servicePath)) {
      foundServices.push(service);
    } else {
      missingServices.push(service);
    }
  }
  
  console.log(`  🔧 Services found: ${foundServices.length}/${expectedServices.length}`);
  
  foundServices.forEach(service => {
    console.log(`    ✅ ${service}`);
  });
  
  if (missingServices.length > 0) {
    console.log(`  ❌ Missing services: ${missingServices.join(', ')}`);
  }
  
  return { found: foundServices, missing: missingServices };
};

// 4. 检查工具文件
const testUtilityFiles = async () => {
  const utilsDir = path.join(__dirname, '..', 'src', 'utils');
  
  const expectedUtils = [
    'constants.ts',
    'request.ts',
    'storage.ts',
    'validate.ts',
    'formatters.ts'
  ];
  
  const foundUtils = [];
  const missingUtils = [];
  
  for (const util of expectedUtils) {
    const utilPath = path.join(utilsDir, util);
    
    if (fs.existsSync(utilPath)) {
      foundUtils.push(util);
    } else {
      missingUtils.push(util);
    }
  }
  
  console.log(`  🛠️  Utilities found: ${foundUtils.length}/${expectedUtils.length}`);
  
  foundUtils.forEach(util => {
    console.log(`    ✅ ${util}`);
  });
  
  if (missingUtils.length > 0) {
    console.log(`  ❌ Missing utilities: ${missingUtils.join(', ')}`);
  }
  
  return { found: foundUtils, missing: missingUtils };
};

// 5. 检查配置文件
const testConfigurationFiles = async () => {
  const baseDir = path.join(__dirname, '..');
  
  const configFiles = [
    { file: 'package.json', required: true },
    { file: 'tsconfig.json', required: true },
    { file: 'project.config.json', required: true },
    { file: 'config/index.ts', required: true },
    { file: 'config/dev.ts', required: true },
    { file: 'config/prod.ts', required: true },
    { file: 'src/app.config.ts', required: true },
    { file: 'src/app.tsx', required: true }
  ];
  
  const configStatus = [];
  
  for (const config of configFiles) {
    const configPath = path.join(baseDir, config.file);
    const exists = fs.existsSync(configPath);
    
    configStatus.push({
      file: config.file,
      exists,
      required: config.required,
      path: configPath
    });
  }
  
  const existingConfigs = configStatus.filter(c => c.exists).length;
  const requiredConfigs = configStatus.filter(c => c.required).length;
  const missingRequired = configStatus.filter(c => c.required && !c.exists);
  
  console.log(`  ⚙️  Configuration files: ${existingConfigs}/${configFiles.length} found`);
  console.log(`  🔧 Required configs: ${existingConfigs - missingRequired.length}/${requiredConfigs} present`);
  
  configStatus.forEach(config => {
    const status = config.exists ? '✅' : '❌';
    const label = config.required ? '(required)' : '(optional)';
    console.log(`    ${status} ${config.file} ${label}`);
  });
  
  if (missingRequired.length > 0) {
    throw new Error(`Missing required config files: ${missingRequired.map(c => c.file).join(', ')}`);
  }
  
  return configStatus;
};

// 6. 检查样式文件
const testStyleFiles = async () => {
  const srcDir = path.join(__dirname, '..', 'src');
  
  // 递归查找所有.scss文件
  const findScssFiles = (dir) => {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findScssFiles(fullPath));
      } else if (item.endsWith('.scss')) {
        files.push(fullPath);
      }
    }
    
    return files;
  };
  
  const scssFiles = findScssFiles(srcDir);
  
  console.log(`  🎨 Style files found: ${scssFiles.length}`);
  
  // 按目录分组显示
  const stylesByDir = {};
  scssFiles.forEach(file => {
    const relativePath = path.relative(srcDir, file);
    const dir = path.dirname(relativePath);
    
    if (!stylesByDir[dir]) {
      stylesByDir[dir] = [];
    }
    stylesByDir[dir].push(path.basename(file));
  });
  
  Object.keys(stylesByDir).forEach(dir => {
    console.log(`    📁 ${dir}: ${stylesByDir[dir].length} files`);
  });
  
  // 检查全局样式
  const globalStylePath = path.join(srcDir, 'app.scss');
  const hasGlobalStyles = fs.existsSync(globalStylePath);
  console.log(`  🌐 Global styles: ${hasGlobalStyles ? 'Found' : 'Missing'}`);
  
  return { scssFiles, hasGlobalStyles, stylesByDir };
};

// 7. 代码质量检查
const testCodeQuality = async () => {
  console.log(`  🔍 Code quality checks:`);
  
  // 检查是否有TypeScript类型定义
  const typesDir = path.join(__dirname, '..', 'src', 'types');
  const hasTypes = fs.existsSync(typesDir);
  console.log(`    📝 TypeScript types: ${hasTypes ? 'Found' : 'Missing'}`);
  
  // 检查是否有测试文件
  const testDirs = [
    path.join(__dirname, '..', 'src', 'components'),
    path.join(__dirname, '..', 'src', 'pages'),
    path.join(__dirname, '..', 'src', 'services')
  ];
  
  let testFileCount = 0;
  
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const findTestFiles = (directory) => {
        const items = fs.readdirSync(directory);
        let count = 0;
        
        items.forEach(item => {
          const fullPath = path.join(directory, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            count += findTestFiles(fullPath);
          } else if (item.includes('.test.') || item.includes('.spec.')) {
            count++;
          }
        });
        
        return count;
      };
      
      testFileCount += findTestFiles(dir);
    }
  });
  
  console.log(`    🧪 Test files: ${testFileCount} found`);
  
  // 检查ESLint配置
  const baseDir = path.join(__dirname, '..');
  const eslintConfigs = ['.eslintrc.js', '.eslintrc.json', 'eslint.config.js'];
  const hasEslint = eslintConfigs.some(config => fs.existsSync(path.join(baseDir, config)));
  console.log(`    📏 ESLint config: ${hasEslint ? 'Found' : 'Missing'}`);
  
  return {
    hasTypes,
    testFileCount,
    hasEslint
  };
};

// 主测试函数
const runComponentTests = async () => {
  console.log('🚀 Starting Frontend Component Structure Tests');
  console.log('='.repeat(60));
  
  // 执行所有测试
  await runTest('Core Components', testCoreComponents);
  await runTest('Page Structure', testPageStructure);
  await runTest('Service Files', testServiceFiles);
  await runTest('Utility Files', testUtilityFiles);
  await runTest('Configuration Files', testConfigurationFiles);
  await runTest('Style Files', testStyleFiles);
  await runTest('Code Quality', testCodeQuality);
  
  // 输出测试结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 Component Structure Test Results:');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => {
      console.log(`  - ${error.testName}: ${error.error}`);
    });
  } else {
    console.log('\n🎉 All component structure tests passed!');
    console.log('📱 Frontend codebase structure is well organized');
  }
  
  console.log('\n🎯 Component Structure Testing Complete!');
  
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
  runComponentTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Component test runner error:', error.message);
      process.exit(1);
    });
}

module.exports = { runComponentTests, testResults };
