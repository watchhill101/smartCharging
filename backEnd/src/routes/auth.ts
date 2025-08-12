import { Router } from 'express';

const router = Router();

// 滑块验证
router.post('/slider-verify', (req, res) => {
  res.json({
    success: true,
    message: '滑块验证接口 - 待实现'
  });
});

// 人脸验证
router.post('/face-verify', (req, res) => {
  res.json({
    success: true,
    message: '人脸验证接口 - 待实现'
  });
});

// 用户登录
router.post('/login', (req, res) => {
  res.json({
    success: true,
    message: '用户登录接口 - 待实现'
  });
});

export default router;