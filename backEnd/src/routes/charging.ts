import express from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import ChargingSession from '../models/ChargingSession';
import ChargingStation from '../models/ChargingStation';
import { generateOrderNo } from '../config/alipay';

const router = express.Router();

// 验证请求参数的中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求参数错误',
      errors: errors.array()
    });
  }
  next();
};

// 启动充电
router.post('/start', authenticate, [
  body('stationId').notEmpty().withMessage('充电桩ID不能为空'),
  body('chargerId').notEmpty().withMessage('充电器ID不能为空'),
  body('startPowerLevel').optional().isFloat({ min: 0, max: 100 }).withMessage('起始电量必须在0-100之间')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    const { stationId, chargerId, startPowerLevel } = req.body;

    // 检查用户是否已有活跃的充电会话
    const activeSession = await ChargingSession.findOne({ 
      userId, 
      status: 'active' 
    });

    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: '您已有一个活跃的充电会话，请先停止当前充电'
      });
    }

    // 检查充电桩是否存在
    const station = await ChargingStation.findById(stationId);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: '充电桩不存在'
      });
    }

    // 检查充电器是否被占用
    const existingSession = await ChargingSession.findOne({ 
      chargerId, 
      status: 'active' 
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: '该充电器正在被使用'
      });
    }

    // 创建充电会话
    const sessionId = generateOrderNo('SESSION', userId);
    const chargingSession = new ChargingSession({
      sessionId,
      userId,
      stationId,
      chargerId,
      status: 'active',
      startTime: new Date(),
      startPowerLevel: startPowerLevel || 0,
      duration: 0,
      energyDelivered: 0,
      totalCost: 0,
      paymentStatus: 'pending'
    });

    await chargingSession.save();

    res.json({
      success: true,
      message: '充电已启动',
      data: {
        sessionId: chargingSession.sessionId,
        status: 'active',
        startTime: chargingSession.startTime,
        stationName: station.name
      }
    });
  } catch (error) {
    console.error('启动充电失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}));

// 获取充电状态
router.get('/sessions/:sessionId/status', authenticate, [
  param('sessionId').notEmpty().withMessage('会话ID不能为空')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;

    const session = await ChargingSession.findOne({ 
      sessionId, 
      userId 
    }).populate('stationId', 'name address electricityFee serviceFee');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: '充电会话不存在'
      });
    }

    // 如果是活跃会话，计算当前时长
    let currentDuration = session.duration;
    if (session.status === 'active') {
      currentDuration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
    }

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        currentDuration: currentDuration,
        energyDelivered: session.energyDelivered,
        totalCost: session.totalCost,
        paymentStatus: session.paymentStatus,
        station: session.stationId,
        chargerId: session.chargerId,
        startPowerLevel: session.startPowerLevel,
        endPowerLevel: session.endPowerLevel
      }
    });
  } catch (error) {
    console.error('获取充电状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}));

// 停止充电
router.post('/sessions/:sessionId/stop', authenticate, [
  param('sessionId').notEmpty().withMessage('会话ID不能为空'),
  body('endPowerLevel').optional().isFloat({ min: 0, max: 100 }).withMessage('结束电量必须在0-100之间'),
  body('energyDelivered').optional().isFloat({ min: 0 }).withMessage('充电量必须大于等于0')
], handleValidationErrors, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;
    const { endPowerLevel, energyDelivered } = req.body;

    // 查找充电会话
    const session = await ChargingSession.findOne({ 
      sessionId, 
      userId,
      status: 'active' 
    }).populate('stationId');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: '未找到活跃的充电会话'
      });
    }

    // 计算充电时长
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    // 设置充电量（可以从设备获取，这里模拟）
    const actualEnergyDelivered = energyDelivered || 
      Math.max(0, Math.round((duration / 3600) * (Math.random() * 5 + 2) * 100) / 100); // 模拟2-7kWh/小时

    // 获取充电站的费率信息
    const station = session.stationId as any;
    const electricityFee = station.electricityFee || 0.6; // 默认电费 0.6元/kWh
    const serviceFee = station.serviceFee || 0.4; // 默认服务费 0.4元/kWh

    // 计算总费用
    const totalCost = Math.round(actualEnergyDelivered * (electricityFee + serviceFee) * 100) / 100;

    // 更新充电会话
    session.endTime = endTime;
    session.duration = duration;
    session.energyDelivered = actualEnergyDelivered;
    session.endPowerLevel = endPowerLevel;
    session.totalCost = totalCost;
    session.status = 'completed';

    await session.save();

    // 自动进行余额扣费（如果钱包有余额）
    try {
      const { default: Wallet } = await import('../models/Wallet');
      const wallet = await Wallet.findOne({ userId });
      
      if (wallet && (wallet as any).getAvailableBalance() >= totalCost) {
        // 自动扣费
        const transaction = (wallet as any).addTransaction({
          type: 'consume',
          amount: totalCost,
          description: `充电自动扣费 - ${actualEnergyDelivered}kWh (${Math.floor(duration/60)}分钟)`,
          orderId: sessionId,
          paymentMethod: 'balance',
          status: 'completed'
        });

        await wallet.save();

        // 更新支付状态
        session.paymentStatus = 'paid';
        await session.save();

        console.log(`充电自动扣费成功: 用户${userId}, 金额¥${totalCost}, 交易ID: ${transaction.id}`);
      }
    } catch (error) {
      console.error('自动扣费失败:', error);
      // 扣费失败不影响充电结束，用户可以后续手动支付
    }

    res.json({
      success: true,
      message: '充电已结束',
      data: {
        sessionId: session.sessionId,
        duration: duration,
        energyDelivered: actualEnergyDelivered,
        totalCost: totalCost,
        paymentStatus: session.paymentStatus,
        startTime: session.startTime,
        endTime: session.endTime,
        costBreakdown: {
          electricityFee: electricityFee,
          serviceFee: serviceFee,
          totalRate: electricityFee + serviceFee
        }
      }
    });
  } catch (error) {
    console.error('停止充电失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}));

// 获取用户充电历史
router.get('/history', /* authenticate, */ asyncHandler(async (req, res) => {
  try {
    // const userId = req.user?.id; // 临时注释掉用于测试
    const userId = 'test-user-id'; // 使用测试用户ID
    const { page = 1, limit = 20, status } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    // 构建查询条件
    const query: any = { userId };
    if (status) {
      query.status = status;
    }

    // 获取充电历史
    const sessions = await ChargingSession.find(query)
      .populate('stationId', 'name address')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await ChargingSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('获取充电历史失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}));

// 获取充电统计
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    // 构建查询条件
    const query: any = { userId };
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }

    // 获取统计数据
    const stats = await ChargingSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalEnergy: { $sum: '$energyDelivered' },
          totalCost: { $sum: '$totalCost' },
          totalDuration: { $sum: '$duration' },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          paidSessions: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
          },
          averageEnergy: { $avg: '$energyDelivered' },
          averageCost: { $avg: '$totalCost' },
          averageDuration: { $avg: '$duration' }
        }
      }
    ]);

    const result = stats[0] || {
      totalSessions: 0,
      totalEnergy: 0,
      totalCost: 0,
      totalDuration: 0,
      completedSessions: 0,
      paidSessions: 0,
      averageEnergy: 0,
      averageCost: 0,
      averageDuration: 0
    };

    res.json({
      success: true,
      data: {
        stats: {
          ...result,
          totalEnergy: Math.round(result.totalEnergy * 100) / 100,
          totalCost: Math.round(result.totalCost * 100) / 100,
          averageEnergy: Math.round((result.averageEnergy || 0) * 100) / 100,
          averageCost: Math.round((result.averageCost || 0) * 100) / 100,
          averageDuration: Math.round(result.averageDuration || 0),
          totalHours: Math.round((result.totalDuration || 0) / 3600 * 100) / 100
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        }
      }
    });
  } catch (error) {
    console.error('获取充电统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}));

export default router;