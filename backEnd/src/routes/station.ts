import { Router } from 'express';

const router = Router();

// 获取附近充电站
router.get('/nearby', (req, res) => {
  res.json({
    success: true,
    message: '获取附近充电站接口 - 待实现'
  });
});

// 获取充电站详情
router.get('/:stationId', (req, res) => {
  res.json({
    success: true,
    message: '获取充电站详情接口 - 待实现'
  });
});

// 获取充电桩状态
router.get('/:stationId/chargers', (req, res) => {
  res.json({
    success: true,
    message: '获取充电桩状态接口 - 待实现'
  });
});

export default router;