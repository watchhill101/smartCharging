export default {
  pages: [
    'pages/login/login',
    'pages/index/index',
    'pages/index/xiangx',
    'pages/map/index',
    'pages/charging/index',
    'pages/charging/start/index',
    'pages/profile/index',
    'pages/profile/coupons',
    'pages/scan/index',
    'pages/orders/index',
    'pages/vehicles/index',
    'pages/wallet/index',
    'pages/feature-dev/index',
    'pages/charging/start/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '智能充电',
    navigationBarTextStyle: 'black'
  },
  // H5 specific configurations
  h5: {
    router: {
      mode: 'hash',
      basename: '/'
    },
    devServer: {
      port: 10086,
      host: 'localhost'
    },
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true
      }
    }
  },
  // 添加权限配置
  permission: {
    'scope.camera': {
      desc: '您的摄像头将用于扫描充电桩二维码'
    }
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
}
