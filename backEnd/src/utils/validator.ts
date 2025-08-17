// 输入验证工具
import Joi from 'joi';

// 用户相关验证
export const userValidation = {
  updateProfile: Joi.object({
    nickName: Joi.string().trim().min(1).max(50).optional(),
    avatarUrl: Joi.string().uri().optional()
  }),

  addVehicle: Joi.object({
    brand: Joi.string().trim().min(1).max(50).required(),
    model: Joi.string().trim().min(1).max(50).required(),
    licensePlate: Joi.string().pattern(/^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4}[A-Z0-9挂学警港澳]{1}$/).required(),
    batteryCapacity: Joi.number().min(1).max(1000).optional()
  })
};

// 支付相关验证
export const paymentValidation = {
  recharge: Joi.object({
    amount: Joi.number().min(1).max(10000).required()
  }),

  chargingPay: Joi.object({
    sessionId: Joi.string().required(),
    paymentMethod: Joi.string().valid('balance', 'alipay').default('balance')
  })
};

// 充电站相关验证
export const stationValidation = {
  nearby: Joi.object({
    longitude: Joi.number().min(-180).max(180).required(),
    latitude: Joi.number().min(-90).max(90).required(),
    radius: Joi.number().min(100).max(50000).default(5000)
  }),

  search: Joi.object({
    keyword: Joi.string().trim().min(1).max(100).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    radius: Joi.number().min(100).max(50000).default(10000),
    chargerType: Joi.string().valid('fast', 'slow').optional(),
    availability: Joi.boolean().optional()
  })
};

// 分页验证
export const paginationValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// 验证中间件生成器
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: '输入参数验证失败',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.body = value;
    next();
  };
};

// 查询参数验证中间件生成器
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: '查询参数验证失败',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    req.query = value;
    next();
  };
};
