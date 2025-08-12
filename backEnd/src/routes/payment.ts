import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 创建支付订单
router.post('/orders', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '创建支付订单接口 - 待实现'
  });
});

// 钱包充值
router.post('/wallet/recharge', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '钱包充值接口 - 待实现'
  });
});

// 获取钱包余额
router.get('/wallet/balance', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '获取钱包余额接口 - 待实现'
  });
});

export default router;