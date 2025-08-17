const fs = require('fs')
const path = require('path')

// 创建 Base64 编码的 PNG 数据（1x1 像素的彩色图片用于测试）
const createTestPNG = (color) => {
  // 这是一个简单的 8x8 像素的 PNG base64 数据
  const pngBase64 = {
    gray: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY/z//z8DFQALAzUAC1QBCwMVAAsBFQALARUACwEVAAsDE1QBMzMzAwtUATMzMwMLVAEzMzMDC1QBMzMzAwtUATMzMwMLVAEzMzMDC1QBMzMzAwtDvQAAAP//AwBfYQABYdEJhAAAAABJRU5ErkJggg==',
    blue: 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY2RgYPgPBUwMVAAsTFQALExUACxMVAAsTFQALExMUAXMzMwMLExUAMzMzAwsTFQAzMzMDCxMVADMzMwMLExUAMzMzAwsTFQAzMzMDCxMVADMzAwsTP0AAAD//wMAX2EAAWHRCYQAAAAASUVORK5CYII='
  }
  return color === 'blue' ? pngBase64.blue : pngBase64.gray
}

// 创建真正的图标 SVG
const createIconSVG = (iconType, color = '#666') => {
  const icons = {
    home: `
      <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="${color}"/>
      </svg>`,
    map: `
      <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/>
      </svg>`,
    charging: `
      <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" fill="${color}"/>
        <path d="M11 20v-5.5H9L13 7v5.5h2L11 20z" fill="white"/>
      </svg>`,
    profile: `
      <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="${color}"/>
      </svg>`
  }
  return icons[iconType] || icons.home
}

const icons = [
  { name: 'home', type: 'home' },
  { name: 'map', type: 'map' },
  { name: 'charging', type: 'charging' },
  { name: 'profile', type: 'profile' }
]

const iconsDir = path.join(__dirname, '../src/assets/icons')

// 确保目录存在
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

icons.forEach(icon => {
  try {
    // 生成 SVG 文件
    const normalSvg = createIconSVG(icon.type, '#999999')
    const activeSvg = createIconSVG(icon.type, '#1890ff')
    
    fs.writeFileSync(path.join(iconsDir, `${icon.name}.svg`), normalSvg)
    fs.writeFileSync(path.join(iconsDir, `${icon.name}-active.svg`), activeSvg)
    
    // 创建简单的测试 PNG（base64 解码）
    const normalPngBuffer = Buffer.from(createTestPNG('gray'), 'base64')
    const activePngBuffer = Buffer.from(createTestPNG('blue'), 'base64')
    
    fs.writeFileSync(path.join(iconsDir, `${icon.name}.png`), normalPngBuffer)
    fs.writeFileSync(path.join(iconsDir, `${icon.name}-active.png`), activePngBuffer)
    
    console.log(`✓ 生成图标: ${icon.name}`)
  } catch (error) {
    console.error(`❌ 生成图标失败 ${icon.name}:`, error.message)
  }
})

console.log('\n✅ 图标重新生成完成!')
console.log('📁 包含 PNG 和 SVG 格式')