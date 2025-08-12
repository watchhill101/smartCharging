import mongoose, { Document, Schema } from 'mongoose';

// 充电桩接口
interface ICharger {
  chargerId: string;
  type: 'fast' | 'slow';
  power: number; // kW
  status: 'available' | 'busy' | 'offline';
  pricing: {
    electricityFee: number; // 电费
    serviceFee: number;     // 服务费
  };
}

// 营业时间接口
interface IOperatingHours {
  open: string;  // "00:00"
  close: string; // "24:00"
}

// 充电站接口
export interface IChargingStation extends Document {
  name: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [经度, 纬度]
  };
  operator: string;
  operatingHours: IOperatingHours;
  parkingFee: number;
  photos: string[];
  chargers: ICharger[];
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 充电桩Schema
const ChargerSchema = new Schema<ICharger>({
  chargerId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['fast', 'slow'],
    required: true
  },
  power: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'available'
  },
  pricing: {
    electricityFee: {
      type: Number,
      required: true,
      min: 0
    },
    serviceFee: {
      type: Number,
      required: true,
      min: 0
    }
  }
}, { _id: false });

// 营业时间Schema
const OperatingHoursSchema = new Schema<IOperatingHours>({
  open: {
    type: String,
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  close: {
    type: String,
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$|^24:00$/
  }
}, { _id: false });

// 充电站Schema
const ChargingStationSchema = new Schema<IChargingStation>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
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
        validator: function(coords: number[]) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // 经度
                 coords[1] >= -90 && coords[1] <= 90;     // 纬度
        },
        message: 'Invalid coordinates'
      }
    }
  },
  operator: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  operatingHours: {
    type: OperatingHoursSchema,
    required: true
  },
  parkingFee: {
    type: Number,
    default: 0,
    min: 0
  },
  photos: [{
    type: String,
    trim: true
  }],
  chargers: [ChargerSchema],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// 地理位置索引
ChargingStationSchema.index({ location: '2dsphere' });
ChargingStationSchema.index({ name: 'text', address: 'text' });
ChargingStationSchema.index({ operator: 1 });
ChargingStationSchema.index({ rating: -1 });
ChargingStationSchema.index({ 'chargers.type': 1 });
ChargingStationSchema.index({ 'chargers.status': 1 });

// 实例方法
ChargingStationSchema.methods.getAvailableChargers = function() {
  return this.chargers.filter((charger: ICharger) => charger.status === 'available');
};

ChargingStationSchema.methods.updateChargerStatus = function(chargerId: string, status: string) {
  const charger = this.chargers.find((c: ICharger) => c.chargerId === chargerId);
  if (charger) {
    charger.status = status as 'available' | 'busy' | 'offline';
    return this.save();
  }
  throw new Error('Charger not found');
};

ChargingStationSchema.methods.addReview = function(rating: number) {
  const totalRating = this.rating * this.reviewCount + rating;
  this.reviewCount += 1;
  this.rating = totalRating / this.reviewCount;
  return this.save();
};

// 静态方法
ChargingStationSchema.statics.findNearby = function(
  longitude: number, 
  latitude: number, 
  radius: number = 5000
) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radius
      }
    }
  });
};

export default mongoose.model<IChargingStation>('ChargingStation', ChargingStationSchema);