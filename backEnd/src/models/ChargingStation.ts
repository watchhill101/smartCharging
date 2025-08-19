import mongoose, { Document, Schema } from 'mongoose';

export interface IChargingPile extends Document {
  pileId: string;
  pileNumber: string;
  type: 'AC' | 'DC' | 'AC_DC';
  power: number; // 功率 (kW)
  voltage: number; // 电压 (V)
  current: number; // 电流 (A)
  connectorType: string[]; // 接口类型 ['GB/T', 'CCS', 'CHAdeMO', 'Tesla']
  status: 'available' | 'occupied' | 'offline' | 'maintenance' | 'reserved';
  price: {
    servicePrice: number; // 服务费 (元/kWh)
    electricityPrice: number; // 电费 (元/kWh)
    parkingPrice?: number; // 停车费 (元/小时)
  };
  lastMaintenance?: Date;
  installDate: Date;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
}

export interface IChargingStation extends Document {
  stationId: string;
  name: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  city: string;
  district: string;
  province: string;
  postalCode?: string;
  
  // 运营信息
  operator: {
    name: string;
    phone: string;
    email?: string;
    website?: string;
  };
  
  // 充电桩信息
  piles: IChargingPile[];
  totalPiles: number;
  availablePiles: number;
  
  // 服务信息
  openTime: {
    start: string; // "00:00"
    end: string;   // "24:00"
    is24Hours: boolean;
  };
  services: string[]; // ['parking', 'restaurant', 'restroom', 'wifi', 'shop']
  
  // 价格信息
  priceRange: {
    minServicePrice: number;
    maxServicePrice: number;
    minElectricityPrice: number;
    maxElectricityPrice: number;
  };
  
  // 评价信息
  rating: {
    average: number;
    count: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  
  // 图片和描述
  images: string[];
  description?: string;
  
  // 联系信息
  contact: {
    phone?: string;
    emergencyPhone?: string;
  };
  
  // 状态信息
  status: 'active' | 'inactive' | 'maintenance' | 'construction';
  isVerified: boolean;
  
  // 统计信息
  stats: {
    totalSessions: number;
    totalEnergy: number; // kWh
    totalRevenue: number; // 元
    averageSessionDuration: number; // 分钟
    peakHours: string[]; // ["08:00-09:00", "18:00-19:00"]
  };
  
  // 时间戳
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
  
  // 实例方法
  updatePileStatus(pileId: string, status: string): Promise<void>;
  calculateDistance(latitude: number, longitude: number): number;
  getAvailablePiles(): IChargingPile[];
  updateRating(newRating: number): Promise<void>;
}

export interface IChargingStationModel extends mongoose.Model<IChargingStation> {
  // 静态方法
  findNearby(
    latitude: number, 
    longitude: number, 
    radius: number,
    filters?: any
  ): Promise<IChargingStation[]>;
  
  findByOperator(operatorName: string): Promise<IChargingStation[]>;
  
  searchByKeyword(
    keyword: string,
    location?: { latitude: number; longitude: number },
    radius?: number
  ): Promise<IChargingStation[]>;
  
  getStatistics(filters?: any): Promise<any>;
  
  syncFromExternalAPI(apiData: any[]): Promise<{ created: number; updated: number }>;
  
  updatePileStatuses(updates: Array<{ stationId: string; pileId: string; status: string }>): Promise<void>;
}

// 充电桩子文档Schema
const ChargingPileSchema = new Schema<IChargingPile>({
  pileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  pileNumber: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['AC', 'DC', 'AC_DC'],
    required: true
  },
  power: {
    type: Number,
    required: true,
    min: 0,
    max: 1000 // 最大1000kW
  },
  voltage: {
    type: Number,
    required: true,
    min: 0
  },
  current: {
    type: Number,
    required: true,
    min: 0
  },
  connectorType: [{
    type: String,
    enum: ['GB/T', 'CCS', 'CHAdeMO', 'Tesla', 'Type2', 'CCS2'],
    required: true
  }],
  status: {
    type: String,
    enum: ['available', 'occupied', 'offline', 'maintenance', 'reserved'],
    default: 'available',
    index: true
  },
  price: {
    servicePrice: {
      type: Number,
      required: true,
      min: 0
    },
    electricityPrice: {
      type: Number,
      required: true,
      min: 0
    },
    parkingPrice: {
      type: Number,
      min: 0
    }
  },
  lastMaintenance: Date,
  installDate: {
    type: Date,
    required: true
  },
  manufacturer: String,
  model: String,
  serialNumber: String,
  softwareVersion: String,
  hardwareVersion: String
}, {
  _id: true,
  timestamps: false
});

// 充电站主Schema
const ChargingStationSchema = new Schema<IChargingStation>({
  stationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  address: {
    type: String,
    required: true,
    index: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coordinates: number[]) {
          return coordinates.length === 2 &&
                 coordinates[0] >= -180 && coordinates[0] <= 180 &&
                 coordinates[1] >= -90 && coordinates[1] <= 90;
        },
        message: '坐标格式错误，应为 [longitude, latitude]'
      }
    }
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  district: {
    type: String,
    required: true,
    index: true
  },
  province: {
    type: String,
    required: true,
    index: true
  },
  postalCode: String,
  
  operator: {
    name: {
      type: String,
      required: true,
      index: true
    },
    phone: {
      type: String,
      required: true
    },
    email: String,
    website: String
  },
  
  piles: [ChargingPileSchema],
  
  totalPiles: {
    type: Number,
    required: true,
    min: 0
  },
  availablePiles: {
    type: Number,
    required: true,
    min: 0
  },
  
  openTime: {
    start: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    end: {
      type: String,
      required: true,
      match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^24:00$/
    },
    is24Hours: {
      type: Boolean,
      default: false
    }
  },
  
  services: [{
    type: String,
    enum: ['parking', 'restaurant', 'restroom', 'wifi', 'shop', 'repair', 'car_wash', 'convenience_store']
  }],
  
  priceRange: {
    minServicePrice: {
      type: Number,
      required: true,
      min: 0
    },
    maxServicePrice: {
      type: Number,
      required: true,
      min: 0
    },
    minElectricityPrice: {
      type: Number,
      required: true,
      min: 0
    },
    maxElectricityPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    distribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },
  
  images: [String],
  description: String,
  
  contact: {
    phone: String,
    emergencyPhone: String
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'construction'],
    default: 'active',
    index: true
  },
  
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  stats: {
    totalSessions: {
      type: Number,
      default: 0
    },
    totalEnergy: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    peakHours: [String]
  },
  
  lastSyncAt: Date
}, {
  timestamps: true,
  collection: 'charging_stations'
});

// 地理位置索引
ChargingStationSchema.index({ location: '2dsphere' });

// 复合索引
ChargingStationSchema.index({ city: 1, status: 1 });
ChargingStationSchema.index({ 'operator.name': 1, status: 1 });
ChargingStationSchema.index({ 'piles.status': 1 });
ChargingStationSchema.index({ 'rating.average': -1 });
ChargingStationSchema.index({ createdAt: -1 });

// 实例方法
ChargingStationSchema.methods.updatePileStatus = async function(pileId: string, status: string): Promise<void> {
  const pile = this.piles.find((p: IChargingPile) => p.pileId === pileId);
  if (pile) {
    pile.status = status as any;
    
    // 更新可用充电桩数量
    this.availablePiles = this.piles.filter((p: IChargingPile) => p.status === 'available').length;
    
    await this.save();
  }
};

ChargingStationSchema.methods.calculateDistance = function(latitude: number, longitude: number): number {
  const [stationLng, stationLat] = this.location.coordinates;
  const R = 6371000; // 地球半径（米）
  
  const lat1Rad = (stationLat * Math.PI) / 180;
  const lat2Rad = (latitude * Math.PI) / 180;
  const deltaLatRad = ((latitude - stationLat) * Math.PI) / 180;
  const deltaLngRad = ((longitude - stationLng) * Math.PI) / 180;

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.round(R * c);
};

ChargingStationSchema.methods.getAvailablePiles = function(): IChargingPile[] {
  return this.piles.filter((pile: IChargingPile) => pile.status === 'available');
};

ChargingStationSchema.methods.updateRating = async function(newRating: number): Promise<void> {
  if (newRating < 1 || newRating > 5) {
    throw new Error('评分必须在1-5之间');
  }
  
  // 更新评分分布
  this.rating.distribution[newRating as keyof typeof this.rating.distribution]++;
  this.rating.count++;
  
  // 重新计算平均分
  const total = Object.entries(this.rating.distribution).reduce((sum, [rating, count]) => {
    return sum + (parseInt(rating) * count);
  }, 0);
  
  this.rating.average = Math.round((total / this.rating.count) * 10) / 10;
  
  await this.save();
};

// 静态方法
ChargingStationSchema.statics.findNearby = async function(
  latitude: number,
  longitude: number,
  radius: number = 5000,
  filters: any = {}
): Promise<IChargingStation[]> {
  const query: any = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius
      }
    },
    status: 'active',
    ...filters
  };
  
  return this.find(query).sort({ 'rating.average': -1 });
};

ChargingStationSchema.statics.findByOperator = async function(operatorName: string): Promise<IChargingStation[]> {
  return this.find({
    'operator.name': new RegExp(operatorName, 'i'),
    status: 'active'
  }).sort({ name: 1 });
};

ChargingStationSchema.statics.searchByKeyword = async function(
  keyword: string,
  location?: { latitude: number; longitude: number },
  radius: number = 10000
): Promise<IChargingStation[]> {
  const searchQuery: any = {
    $or: [
      { name: new RegExp(keyword, 'i') },
      { address: new RegExp(keyword, 'i') },
      { 'operator.name': new RegExp(keyword, 'i') },
      { city: new RegExp(keyword, 'i') },
      { district: new RegExp(keyword, 'i') }
    ],
    status: 'active'
  };
  
  if (location) {
    searchQuery.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude]
        },
        $maxDistance: radius
      }
    };
  }
  
  return this.find(searchQuery).sort({ 'rating.average': -1 });
};

ChargingStationSchema.statics.getStatistics = async function(filters: any = {}): Promise<any> {
  const pipeline = [
    { $match: { status: 'active', ...filters } },
    {
      $group: {
        _id: null,
        totalStations: { $sum: 1 },
        totalPiles: { $sum: '$totalPiles' },
        totalAvailablePiles: { $sum: '$availablePiles' },
        averageRating: { $avg: '$rating.average' },
        totalSessions: { $sum: '$stats.totalSessions' },
        totalEnergy: { $sum: '$stats.totalEnergy' },
        totalRevenue: { $sum: '$stats.totalRevenue' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    totalStations: 0,
    totalPiles: 0,
    totalAvailablePiles: 0,
    averageRating: 0,
    totalSessions: 0,
    totalEnergy: 0,
    totalRevenue: 0
  };
};

ChargingStationSchema.statics.syncFromExternalAPI = async function(apiData: any[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  
  for (const stationData of apiData) {
    const existingStation = await this.findOne({ stationId: stationData.stationId });
    
    if (existingStation) {
      // 更新现有充电站
      Object.assign(existingStation, stationData);
      existingStation.lastSyncAt = new Date();
      await existingStation.save();
      updated++;
    } else {
      // 创建新充电站
      const newStation = new this({
        ...stationData,
        lastSyncAt: new Date()
      });
      await newStation.save();
      created++;
    }
  }
  
  return { created, updated };
};

ChargingStationSchema.statics.updatePileStatuses = async function(
  updates: Array<{ stationId: string; pileId: string; status: string }>
): Promise<void> {
  const bulkOps = updates.map(update => ({
    updateOne: {
      filter: { 
        stationId: update.stationId,
        'piles.pileId': update.pileId
      },
      update: {
        $set: { 'piles.$.status': update.status }
      }
    }
  }));
  
  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
    
    // 重新计算每个充电站的可用充电桩数量
    const stationIds = [...new Set(updates.map(u => u.stationId))];
    for (const stationId of stationIds) {
      const station = await this.findOne({ stationId });
      if (station) {
        station.availablePiles = station.piles.filter(p => p.status === 'available').length;
        await station.save();
      }
    }
  }
};

// 中间件：保存前验证
ChargingStationSchema.pre('save', function(next) {
  // 验证充电桩数量
  if (this.piles.length !== this.totalPiles) {
    this.totalPiles = this.piles.length;
  }
  
  // 计算可用充电桩数量
  this.availablePiles = this.piles.filter(pile => pile.status === 'available').length;
  
  // 计算价格范围
  if (this.piles.length > 0) {
    const servicePrices = this.piles.map(p => p.price.servicePrice);
    const electricityPrices = this.piles.map(p => p.price.electricityPrice);
    
    this.priceRange = {
      minServicePrice: Math.min(...servicePrices),
      maxServicePrice: Math.max(...servicePrices),
      minElectricityPrice: Math.min(...electricityPrices),
      maxElectricityPrice: Math.max(...electricityPrices)
    };
  }
  
  next();
});

// 虚拟字段
ChargingStationSchema.virtual('occupancyRate').get(function() {
  if (this.totalPiles === 0) return 0;
  return Math.round(((this.totalPiles - this.availablePiles) / this.totalPiles) * 100);
});

ChargingStationSchema.virtual('isOpen').get(function() {
  if (this.openTime.is24Hours) return true;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  return currentTime >= this.openTime.start && currentTime <= this.openTime.end;
});

// 确保虚拟字段在JSON序列化时包含
ChargingStationSchema.set('toJSON', { virtuals: true });
ChargingStationSchema.set('toObject', { virtuals: true });

const ChargingStation = mongoose.model<IChargingStation, IChargingStationModel>('ChargingStation', ChargingStationSchema);

export default ChargingStation;