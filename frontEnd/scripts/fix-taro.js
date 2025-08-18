#!/usr/bin/env node

/**
 * Taro 紧急修复脚本
 * 用于解决 Taro API 未正确加载的问题
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 Taro 紧急修复脚本启动...');

// 检查package.json
const packagePath = path.join(__dirname, '../package.json');
if (!fs.existsSync(packagePath)) {
  console.error('❌ 找不到 package.json 文件');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
console.log('📦 当前项目信息:');
console.log(`   项目名称: ${packageJson.name}`);
console.log(`   Taro版本: ${packageJson.dependencies['@tarojs/taro']}`);
console.log(`   CLI版本: ${packageJson.devDependencies['@tarojs/cli']}`);

// 检查Taro版本兼容性
const taroVersion = packageJson.dependencies['@tarojs/taro'];
const majorVersion = parseInt(taroVersion.split('.')[0]);

if (majorVersion >= 4) {
  console.log('✅ 检测到 Taro 4.x 版本');
  
  // 检查必要的依赖
  const requiredDeps = [
    '@tarojs/components',
    '@tarojs/react',
    '@tarojs/runtime',
    '@tarojs/plugin-framework-react'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.log('❌ 缺少必要的依赖:');
    missingDeps.forEach(dep => console.log(`   - ${dep}`));
    console.log('\n🔧 建议执行以下命令安装依赖:');
    console.log(`npm install ${missingDeps.join(' ')}`);
  } else {
    console.log('✅ 所有必要的依赖都已安装');
  }
} else {
  console.log('⚠️  检测到 Taro 3.x 版本，建议升级到 4.x');
}

// 检查配置文件
const configFiles = [
  'config/index.ts',
  'config/dev.ts',
  'config/prod.ts',
  'src/app.config.ts'
];

console.log('\n📁 检查配置文件:');
configFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} (缺失)`);
  }
});

// 检查环境变量
console.log('\n🌍 检查环境变量:');
const envVars = ['NODE_ENV', 'TARO_ENV'];
envVars.forEach(env => {
  const value = process.env[env];
  console.log(`   ${env}: ${value || '未设置'}`);
});

// 生成修复建议
console.log('\n🔧 修复建议:');

if (majorVersion >= 4) {
  console.log('1. 清理并重新安装依赖:');
  console.log('   rm -rf node_modules package-lock.json');
  console.log('   npm install');
  
  console.log('\n2. 清理构建缓存:');
  console.log('   npm run build:weapp -- --clean');
  console.log('   npm run build:h5 -- --clean');
  
  console.log('\n3. 检查TypeScript配置:');
  console.log('   确保 tsconfig.json 中包含了 Taro 类型定义');
  
  console.log('\n4. 重新构建项目:');
  console.log('   npm run dev:weapp  # 或 npm run dev:h5');
} else {
  console.log('1. 升级到 Taro 4.x:');
  console.log('   npm install @tarojs/taro@latest @tarojs/cli@latest');
  console.log('   npm install @tarojs/components@latest @tarojs/react@latest');
  
  console.log('\n2. 更新配置文件以适配新版本');
}

console.log('\n5. 如果问题仍然存在，尝试:');
console.log('   - 检查 Node.js 版本 (建议 16+)');
console.log('   - 检查 npm 版本 (建议 8+)');
console.log('   - 清除 npm 缓存: npm cache clean --force');

// 检查Node.js版本
const nodeVersion = process.version;
console.log(`\n📋 当前环境: Node.js ${nodeVersion}`);

const nodeMajorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (nodeMajorVersion < 16) {
  console.log('⚠️  建议使用 Node.js 16+ 版本');
} else {
  console.log('✅ Node.js 版本符合要求');
}

console.log('\n🎯 修复脚本执行完成！');
console.log('请根据上述建议进行修复，然后重新测试项目。'); 