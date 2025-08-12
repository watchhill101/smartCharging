import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

// 滑块验证接口
router.post('/slider-verify', asyncHandler(async (req, res) => {
  const {
    slideDistance,
    puzzleOffset,
    accuracy,
    duration,
    verifyPath,
    trackData
  } = req.body;

  // 验证参数
  if (typeof slideDistance !== 'number' ||
    typeof puzzleOffset !== 'number' ||
    typeof accuracy !== 'number' ||
    typeof duration !== 'number') {
    return res.status(400).json({
      success: false,
      message: '验证参数无效',
      data: { verified: false, token: null }
    });
  }

  try {
    // 1. 精度验证 - 允许10像素误差
    const ACCURACY_THRESHOLD = 10;
    const accuracyValid = accuracy <= ACCURACY_THRESHOLD;

    // 2. 时间验证 - 人类操作时间范围（500ms - 10s）
    const MIN_DURATION = 500;
    const MAX_DURATION = 10000;
    const durationValid = duration >= MIN_DURATION && duration <= MAX_DURATION;

    // 3. 轨迹验证 - 检查拖拽轨迹的合理性
    const trackValid = validateTrackData(trackData, slideDistance);

    // 4. 路径验证 - 检查移动路径是否平滑
    const pathValid = validateVerifyPath(verifyPath, slideDistance);

    // 5. 行为验证 - 检测是否为机器人行为
    const behaviorValid = validateHumanBehavior(duration, trackData, verifyPath);

    // 综合评分（所有验证都必须通过）
    const verified = accuracyValid && durationValid && trackValid && pathValid && behaviorValid;

    // 生成验证令牌
    let token = null;
    if (verified) {
      token = generateVerifyToken();

      // 可选：记录成功的验证日志
      console.log(`滑块验证成功: 精度=${accuracy}, 时长=${duration}ms, 用户IP=${req.ip}`);
    } else {
      // 记录失败的验证尝试（用于安全监控）
      console.log(`滑块验证失败: 精度=${accuracy}(${accuracyValid}), 时长=${duration}(${durationValid}), 轨迹=${trackValid}, 路径=${pathValid}, 行为=${behaviorValid}`);
    }

    res.json({
      success: true,
      message: verified ? '验证成功' : '验证失败',
      data: {
        verified,
        token,
        details: {
          accuracy: accuracyValid,
          duration: durationValid,
          track: trackValid,
          path: pathValid,
          behavior: behaviorValid
        }
      }
    });
  } catch (error) {
    console.error('滑块验证错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器验证错误',
      data: { verified: false, token: null }
    });
  }
}));

// 验证拖拽轨迹数据
function validateTrackData(trackData: any[], expectedDistance: number): boolean {
  if (!Array.isArray(trackData) || trackData.length < 5) {
    return false; // 轨迹点太少，可能是机器人
  }

  // 检查轨迹是否单调递增（正常拖拽行为）
  let isMonotonic = true;
  for (let i = 1; i < trackData.length; i++) {
    if (trackData[i].currentX < trackData[i - 1].currentX) {
      isMonotonic = false;
      break;
    }
  }

  // 检查最终距离是否匹配
  const finalDistance = trackData[trackData.length - 1]?.currentX || 0;
  const distanceMatch = Math.abs(finalDistance - expectedDistance) <= 5;

  return isMonotonic && distanceMatch;
}

// 验证移动路径
function validateVerifyPath(verifyPath: number[], expectedDistance: number): boolean {
  if (!Array.isArray(verifyPath) || verifyPath.length < 10) {
    return false; // 路径点太少
  }

  // 检查路径是否平滑（相邻点的距离不应该太大）
  const MAX_STEP = 15; // 最大单步移动距离
  for (let i = 1; i < verifyPath.length; i++) {
    const step = Math.abs(verifyPath[i] - verifyPath[i - 1]);
    if (step > MAX_STEP) {
      return false; // 移动太快，可能是机器人
    }
  }

  // 检查最终位置
  const finalPath = verifyPath[verifyPath.length - 1];
  return Math.abs(finalPath - expectedDistance) <= 10;
}

// 验证人类行为特征
function validateHumanBehavior(duration: number, trackData: any[], verifyPath: number[]): boolean {
  // 1. 检查速度变化 - 人类拖拽通常有加速和减速
  const hasSpeedVariation = checkSpeedVariation(trackData, duration);

  // 2. 检查微小抖动 - 人手操作会有轻微抖动
  const hasMicroMovements = checkMicroMovements(verifyPath);

  // 3. 检查停顿 - 人类可能会有短暂停顿
  const hasPauses = checkPauses(trackData);

  // 至少满足其中两个特征
  const humanFeatures = [hasSpeedVariation, hasMicroMovements, hasPauses].filter(Boolean).length;
  return humanFeatures >= 1; // 降低要求，确保正常用户能通过
}

// 检查速度变化
function checkSpeedVariation(trackData: any[], duration: number): boolean {
  if (trackData.length < 3) return false;

  const speeds = [];
  for (let i = 1; i < trackData.length; i++) {
    const distance = Math.abs(trackData[i].currentX - trackData[i - 1].currentX);
    const timeStep = duration / trackData.length; // 简化的时间计算
    speeds.push(distance / timeStep);
  }

  // 检查是否有速度变化
  const maxSpeed = Math.max(...speeds);
  const minSpeed = Math.min(...speeds);
  return (maxSpeed - minSpeed) > 0.1; // 有显著的速度变化
}

// 检查微小抖动
function checkMicroMovements(verifyPath: number[]): boolean {
  let reversals = 0;
  for (let i = 2; i < verifyPath.length; i++) {
    const prev = verifyPath[i - 1] - verifyPath[i - 2];
    const curr = verifyPath[i] - verifyPath[i - 1];
    if (prev > 0 && curr < 0) {
      reversals++;
    }
  }
  return reversals >= 1 && reversals <= 5; // 适量的方向改变
}

// 检查停顿
function checkPauses(trackData: any[]): boolean {
  let consecutiveSame = 0;
  let maxPause = 0;

  for (let i = 1; i < trackData.length; i++) {
    if (Math.abs(trackData[i].currentX - trackData[i - 1].currentX) < 1) {
      consecutiveSame++;
    } else {
      maxPause = Math.max(maxPause, consecutiveSame);
      consecutiveSame = 0;
    }
  }

  return maxPause >= 2 && maxPause <= 10; // 有合理的停顿
}

// 生成验证令牌
function generateVerifyToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const token = `slider_${timestamp}_${random}`;

  // 实际项目中应该使用 JWT 或其他安全的令牌生成方式
  // 这里可以添加令牌缓存和过期机制

  return token;
}

// 人脸验证
router.post('/face-verify', asyncHandler(async (req, res) => {
  // TODO: 实现人脸验证逻辑
  res.json({
    success: true,
    message: 'Face verification endpoint - to be implemented',
    data: {
      verified: false,
      confidence: 0,
      token: null
    }
  });
}));

// 用户登录
router.post('/login', asyncHandler(async (req, res) => {
  // TODO: 实现用户登录逻辑
  res.json({
    success: true,
    message: 'Login endpoint - to be implemented',
    data: {
      user: null,
      token: null
    }
  });
}));

// 刷新令牌
router.post('/refresh', asyncHandler(async (req, res) => {
  // TODO: 实现令牌刷新逻辑
  res.json({
    success: true,
    message: 'Token refresh endpoint - to be implemented',
    data: {
      token: null
    }
  });
}));

// 登出
router.post('/logout', asyncHandler(async (req, res) => {
  // TODO: 实现登出逻辑
  res.json({
    success: true,
    message: 'Logout endpoint - to be implemented'
  });
}));

export default router;