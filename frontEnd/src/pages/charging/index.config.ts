export default {
  navigationBarTitleText: '充电管理',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
  backgroundColor: '#f5f5f5',
  enablePullDownRefresh: true,
  // H5 specific configurations
  h5: {
    enablePullToRefresh: true,
    pullToRefresh: {
      threshold: 100,
      maxDistance: 200
    }
  }
}