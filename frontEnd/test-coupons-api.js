// 测试优惠券API的脚本
// 在浏览器控制台中运行

async function testCouponsAPI() {
  console.log('🧪 开始测试优惠券API...')
  
  try {
    // 测试1: 不带认证的请求
    console.log('📡 测试1: 不带认证的请求')
    const response1 = await fetch('/api/coupons')
    const data1 = await response1.json()
    console.log('响应1:', data1)
    
    // 测试2: 带认证的请求（如果有token）
    console.log('📡 测试2: 带认证的请求')
    const token = localStorage.getItem('user_token')
    console.log('Token:', token)
    
    if (token) {
      const response2 = await fetch('/api/coupons', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data2 = await response2.json()
      console.log('响应2:', data2)
    } else {
      console.log('⚠️ 没有找到认证token')
    }
    
    // 测试3: 测试端点
    console.log('📡 测试3: 测试端点')
    const response3 = await fetch('/api/coupons/test')
    const data3 = await response3.json()
    console.log('响应3:', data3)
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 运行测试
testCouponsAPI()

// 也可以单独测试
function testWithoutAuth() {
  fetch('/api/coupons')
    .then(response => response.json())
    .then(data => console.log('无认证响应:', data))
    .catch(error => console.error('无认证请求失败:', error))
}

function testWithAuth() {
  const token = localStorage.getItem('user_token')
  if (token) {
    fetch('/api/coupons', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => console.log('有认证响应:', data))
    .catch(error => console.error('有认证请求失败:', error))
  } else {
    console.log('没有token')
  }
} 