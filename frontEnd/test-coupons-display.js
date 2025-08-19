// 测试优惠券数据显示的脚本
// 在浏览器控制台中运行

function testCouponsDisplay() {
  console.log('🧪 开始测试优惠券数据显示...')
  
  try {
    // 1. 检查状态变量
    console.log('\n1️⃣ 检查状态变量:')
    
    // 获取React组件的状态（如果可能的话）
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('React DevTools 可用')
    } else {
      console.log('React DevTools 不可用')
    }
    
    // 2. 检查DOM元素
    console.log('\n2️⃣ 检查DOM元素:')
    
    // 检查标签页计数
    const tabElements = document.querySelectorAll('.tab')
    console.log('标签页数量:', tabElements.length)
    tabElements.forEach((tab, index) => {
      console.log(`标签页 ${index}:`, tab.textContent)
    })
    
    // 检查优惠券列表
    const couponItems = document.querySelectorAll('.coupon-item')
    console.log('优惠券项目数量:', couponItems.length)
    
    // 检查空状态
    const emptyState = document.querySelector('.empty-state')
    console.log('空状态元素:', !!emptyState)
    
    // 检查加载状态
    const loadingState = document.querySelector('.loading-state')
    console.log('加载状态元素:', !!loadingState)
    
    // 3. 检查localStorage
    console.log('\n3️⃣ 检查存储:')
    const token = localStorage.getItem('user_token') || sessionStorage.getItem('user_token')
    console.log('认证Token:', !!token)
    
    // 4. 测试API调用
    console.log('\n4️⃣ 测试API调用:')
    
    // 测试调试端点
    fetch('/api/coupons/debug')
      .then(response => response.json())
      .then(data => {
        console.log('调试端点响应:', data)
        
        if (data.success && data.data.sampleCoupons) {
          console.log('优惠券数据存在，数量:', data.data.sampleCoupons.length)
          console.log('第一张优惠券:', data.data.sampleCoupons[0])
        }
      })
      .catch(error => console.error('API调用失败:', error))
    
    // 5. 检查控制台日志
    console.log('\n5️⃣ 检查控制台日志:')
    console.log('请查看上面的日志，确认:')
    console.log('- 优惠券数据是否成功获取')
    console.log('- 状态计数是否正确')
    console.log('- 数据过滤是否正常')
    
  } catch (error) {
    console.error('❌ 测试过程出错:', error)
  }
}

// 运行测试
testCouponsDisplay()

// 也可以单独检查
function checkCouponData() {
  fetch('/api/coupons/debug')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('✅ API调用成功')
        console.log('总数:', data.data.totalCount)
        console.log('状态统计:', data.data.statusCounts)
        console.log('样本数据:', data.data.sampleCoupons.length, '张')
      } else {
        console.log('❌ API调用失败:', data.message)
      }
    })
    .catch(error => console.error('请求失败:', error))
}

function checkDOMState() {
  const coupons = document.querySelectorAll('.coupon-item')
  const empty = document.querySelector('.empty-state')
  const loading = document.querySelector('.loading-state')
  
  console.log('DOM状态:')
  console.log('- 优惠券项目:', coupons.length)
  console.log('- 空状态:', !!empty)
  console.log('- 加载状态:', !!loading)
} 