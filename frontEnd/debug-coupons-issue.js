// 调试优惠券数据问题的脚本
// 在浏览器控制台中运行

async function debugCouponsIssue() {
  console.log('🔍 开始调试优惠券数据问题...')
  
  try {
    // 1. 检查认证token
    console.log('\n1️⃣ 检查认证状态:')
    const token = localStorage.getItem('user_token') || sessionStorage.getItem('user_token')
    console.log('Token存在:', !!token)
    if (token) {
      console.log('Token长度:', token.length)
      try {
        // 尝试解码JWT token
        const payload = JSON.parse(atob(token.split('.')[1]))
        console.log('Token内容:', payload)
        console.log('用户ID:', payload.userId)
      } catch (e) {
        console.log('Token解码失败:', e.message)
      }
    }
    
    // 2. 测试不同的API端点
    console.log('\n2️⃣ 测试API端点:')
    
    // 测试1: 无认证的请求
    console.log('测试无认证请求...')
    try {
      const response1 = await fetch('/api/coupons')
      const data1 = await response1.json()
      console.log('无认证响应状态:', response1.status)
      console.log('无认证响应数据:', data1)
    } catch (error) {
      console.log('无认证请求失败:', error.message)
    }
    
    // 测试2: 带认证的请求
    if (token) {
      console.log('\n测试带认证请求...')
      try {
        const response2 = await fetch('/api/coupons', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        const data2 = await response2.json()
        console.log('带认证响应状态:', response2.status)
        console.log('带认证响应数据:', data2)
      } catch (error) {
        console.log('带认证请求失败:', error.message)
      }
    }
    
    // 测试3: 测试端点
    console.log('\n测试测试端点...')
    try {
      const response3 = await fetch('/api/coupons/test')
      const data3 = await response3.json()
      console.log('测试端点响应:', data3)
    } catch (error) {
      console.log('测试端点失败:', error.message)
    }
    
    // 3. 检查网络请求
    console.log('\n3️⃣ 网络请求检查:')
    console.log('请查看Network标签页中的/api/coupons请求详情')
    console.log('特别关注:')
    console.log('- 请求头中的Authorization')
    console.log('- 响应状态码')
    console.log('- 响应内容')
    
    // 4. 环境检测
    console.log('\n4️⃣ 环境检测:')
    console.log('Taro环境:', typeof Taro !== 'undefined')
    console.log('微信环境:', typeof wx !== 'undefined')
    console.log('浏览器环境:', typeof window !== 'undefined')
    console.log('localStorage:', typeof localStorage !== 'undefined')
    console.log('sessionStorage:', typeof sessionStorage !== 'undefined')
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error)
  }
}

// 运行调试
debugCouponsIssue()

// 也可以单独测试
function testAuthRequest() {
  const token = localStorage.getItem('user_token') || sessionStorage.getItem('user_token')
  if (token) {
    fetch('/api/coupons', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      console.log('响应状态:', response.status)
      return response.json()
    })
    .then(data => console.log('响应数据:', data))
    .catch(error => console.error('请求失败:', error))
  } else {
    console.log('没有找到认证token')
  }
}

function testNoAuthRequest() {
  fetch('/api/coupons')
    .then(response => {
      console.log('响应状态:', response.status)
      return response.json()
    })
    .then(data => console.log('响应数据:', data))
    .catch(error => console.error('请求失败:', error))
} 