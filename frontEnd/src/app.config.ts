export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/index/xiangx',
    'pages/map/index',
    'pages/charging/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '智能充电',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#666',
    selectedColor: '#1890ff',
    backgroundColor: '#fff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/map/index',
        text: '地图'
      },
      {
        pagePath: 'pages/charging/index',
        text: '充电'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的'
      }
    ]
  },
  // 添加权限配置
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示'
    }
  },
  // 添加功能配置
  requiredBackgroundModes: ['location'],
  // 添加插件配置
  plugins: {}
})
