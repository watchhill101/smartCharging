#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复的文件模式
const patterns = [
  {
    // 替换 Taro.showToast 为 showToast (需要先导入)
    search: /Taro\.showToast\(/g,
    replace: 'showToast(',
    needsImport: "import { showToast } from '../../utils/toast'"
  },
  {
    // 替换 Taro.setStorageSync 为 TaroSafe.setStorageSync (需要先导入)
    search: /Taro\.setStorageSync\(/g,
    replace: 'TaroSafe.setStorageSync(',
    needsImport: "import { TaroSafe } from '../../utils/taroSafe'"
  },
  {
    // 替换 Taro.getStorageSync 为 TaroSafe.getStorageSync
    search: /Taro\.getStorageSync\(/g,
    replace: 'TaroSafe.getStorageSync('
  },
  {
    // 替换 Taro.removeStorageSync 为 TaroSafe.removeStorageSync
    search: /Taro\.removeStorageSync\(/g,
    replace: 'TaroSafe.removeStorageSync('
  }
];

// 递归查找所有 .tsx 和 .ts 文件
function findFiles(dir, extensions = ['.tsx', '.ts']) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 跳过 node_modules 和其他不需要的目录
        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
          walk(fullPath);
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// 修复单个文件
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let needsToastImport = false;
    let needsTaroSafeImport = false;
    
    // 应用所有模式
    for (const pattern of patterns) {
      if (pattern.search.test(content)) {
        content = content.replace(pattern.search, pattern.replace);
        modified = true;
        
        if (pattern.needsImport) {
          if (pattern.needsImport.includes('showToast')) {
            needsToastImport = true;
          } else if (pattern.needsImport.includes('TaroSafe')) {
            needsTaroSafeImport = true;
          }
        }
      }
    }
    
    // 添加必要的导入
    if (modified) {
      const lines = content.split('\n');
      let importInserted = false;
      
      // 查找最后一个 import 语句的位置
      let lastImportIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      
      // 检查是否已经有相关导入
      const hasToastImport = content.includes("from '../../utils/toast'") || 
                            content.includes("from '../utils/toast'");
      const hasTaroSafeImport = content.includes("from '../../utils/taroSafe'") || 
                               content.includes("from '../utils/taroSafe'");
      
      // 添加导入语句
      const importsToAdd = [];
      
      if (needsToastImport && !hasToastImport) {
        // 根据文件路径确定相对路径
        const relativePath = filePath.includes('/components/') ? '../../utils/toast' : '../utils/toast';
        importsToAdd.push(`import { showToast } from '${relativePath}'`);
      }
      
      if (needsTaroSafeImport && !hasTaroSafeImport) {
        // 根据文件路径确定相对路径
        const relativePath = filePath.includes('/components/') ? '../../utils/taroSafe' : '../utils/taroSafe';
        importsToAdd.push(`import { TaroSafe } from '${relativePath}'`);
      }
      
      if (importsToAdd.length > 0 && lastImportIndex >= 0) {
        // 在最后一个 import 语句后插入新的导入
        lines.splice(lastImportIndex + 1, 0, ...importsToAdd);
        content = lines.join('\n');
      }
      
      // 写回文件
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 修复文件: ${filePath}`);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 修复文件失败 ${filePath}:`, error.message);
    return false;
  }
}

// 主函数
function main() {
  const srcDir = path.join(__dirname, '../src');
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ 源码目录不存在:', srcDir);
    process.exit(1);
  }
  
  console.log('🔧 开始修复 Taro API 调用...');
  
  const files = findFiles(srcDir);
  let fixedCount = 0;
  
  for (const file of files) {
    // 跳过工具文件本身
    if (file.includes('/utils/taro') || file.includes('/utils/toast') || 
        file.includes('/utils/storage') || file.includes('/utils/navigation')) {
      continue;
    }
    
    if (fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ 修复完成! 共修复 ${fixedCount} 个文件`);
  
  if (fixedCount > 0) {
    console.log('\n📝 建议执行以下操作:');
    console.log('1. 重启开发服务器');
    console.log('2. 清理缓存: rm -rf node_modules/.cache dist');
    console.log('3. 重新构建: npm run build:h5');
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { fixFile, findFiles };