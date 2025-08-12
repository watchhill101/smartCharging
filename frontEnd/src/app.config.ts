export default defineAppConfig({
  pages: [
    'pages/index/index',
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
        text: '首页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png'
      },
      {
        pagePath: 'pages/map/index',
        text: '地图',
        iconPath: 'assets/icons/map.png',
        selectedIconPath: 'assets/icons/map-active.png'
      },
      {
        pagePath: 'pages/charging/index',
        text: '充电',
        iconPath: 'assets/icons/charging.png',
        selectedIconPath: 'assets/icons/charging-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/profile.png',
        selectedIconPath: 'assets/icons/profile-active.png'
      }
    ]
  }
})
