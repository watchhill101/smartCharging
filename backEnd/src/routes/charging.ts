import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 启动充电
router.post('/start', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '启动充电接口 - 待实现'
  });
});

// 获取充电状态
router.get('/sessions/:sessionId/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '获取充电状态接口 - 待实现'
  });
});

// 停止充电
router.post('/sessions/:sessionId/stop', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: '停止充电接口 - 待实现'
  });
});

export default router;