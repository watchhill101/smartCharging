import mongoose, { Document, Schema } from 'mongoose';

export interface IFAQ extends Document {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  priority: number;
  isActive: boolean;
  viewCount: number;
  helpfulCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>({
  question: {
    type: String,
    required: true,
    maxlength: 200
  },
  answer: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: ['charging', 'payment', 'account', 'technical', 'other']
  },
  tags: [{
    type: String,
    maxlength: 20
  }],
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// 创建索引
FAQSchema.index({ category: 1, priority: -1 });
FAQSchema.index({ tags: 1 });
FAQSchema.index({ isActive: 1, priority: -1 });

// 文本搜索索引
FAQSchema.index({
  question: 'text',
  answer: 'text',
  tags: 'text'
});

export const FAQ = mongoose.model<IFAQ>('FAQ', FAQSchema);