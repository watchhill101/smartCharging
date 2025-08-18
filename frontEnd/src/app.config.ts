export default {
  pages: [
    'pages/login/login',
    'pages/index/index',
    'pages/index/xiangx',
    'pages/map/index',
    'pages/charging/index',
    'pages/profile/index',
    'pages/aiserver/index',  // 新增 Ai客服 页面
    'pages/scan/index'
  ],
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "智能充电",
    navigationBarTextStyle: "black",
  },
  // H5 specific configurations
  h5: {
    router: {
      mode: "hash",
      basename: "/",
    },
    devServer: {
      port: 10086,
      host: "localhost",
    },
    publicPath: "/",
    staticDirectory: "static",
    postcss: {
      autoprefixer: {
        enable: true,
      },
    },
  },
  // 添加权限配置
  permission: {
    "scope.camera": {
      desc: "您的摄像头将用于扫描充电桩二维码",
    },
  },
  tabBar: {
    color: "#666",
    selectedColor: "#1890ff",
    backgroundColor: "#fff",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "./assets/icons/home.svg",
        selectedIconPath: "./assets/icons/home-active.svg",
      },
      {
        pagePath: "pages/map/index",
        text: "地图",
        iconPath: "./assets/icons/map.svg",
        selectedIconPath: "./assets/icons/map-active.svg",
      },
      {
        pagePath: "pages/scan/index",
        text: "扫码",
        iconPath: "./assets/icons/scan.svg",
        selectedIconPath: "./assets/icons/scan-active.svg",
      },
      {
        pagePath: "pages/charging/index",
        text: "充电",
        iconPath: "./assets/icons/charging.svg",
        selectedIconPath: "./assets/icons/charging-active.svg",
      },
      {
        pagePath: "pages/profile/index",
        text: "我的",
        iconPath: "./assets/icons/profile.svg",
        selectedIconPath: "./assets/icons/profile-active.svg",
      },
    ],
  },
};
