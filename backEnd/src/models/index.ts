// 模型统一导入文件
// 确保所有模型在应用启动时被注册到Mongoose中

import User from './User';
import ChargingStation from './ChargingStation';
import ChargingSession from './ChargingSession';
import Order from './Order';
import Wallet from './Wallet';
import Notification from './Notification';
import Coupon from './Coupon';
import UserCoupon from './UserCoupon';
import Feedback from './Feedback';
import FAQ from './FAQ';
import FaceProfile from './FaceProfile';
import FaceLoginRecord from './FaceLoginRecord';

// 导出所有模型
export {
  User,
  ChargingStation,
  ChargingSession,
  Order,
  Wallet,
  Notification,
  Coupon,
  UserCoupon,
  Feedback,
  FAQ,
  FaceProfile,
  FaceLoginRecord
};

// 默认导出（可选）
export default {
  User,
  ChargingStation,
  ChargingSession,
  Order,
  Wallet,
  Notification,
  Coupon,
  UserCoupon,
  Feedback,
  FAQ,
  FaceProfile,
  FaceLoginRecord
};