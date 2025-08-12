import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 获取用户信息
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '获取用户信息接口 - 待实现'
  });
});

// 更新用户信息
router.put('/profile', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '更新用户信息接口 - 待实现'
  });
});

// 车辆管理
router.post('/vehicles', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '添加车辆接口 - 待实现'
  });
});

export default router;