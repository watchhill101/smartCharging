import mongoose, { Document, Schema } from 'mongoose';

export interface IFeedback extends Document {
  userId: string;
  ticketId: string;
  type: 'bug' | 'suggestion' | 'charging' | 'payment' | 'account' | 'other';
  title: string;
  description: string;
  contact: string;
  images: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  response?: string;
  responseBy?: string;
  responseAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['bug', 'suggestion', 'charging', 'payment', 'account', 'other'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  contact: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'resolved', 'closed'],
    default: 'pending'
  },
  response: {
    type: String,
    maxlength: 1000
  },
  responseBy: {
    type: String
  },
  responseAt: {
    type: Date
  }
}, {
  timestamps: true
});

// 创建索引
FeedbackSchema.index({ userId: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1, priority: 1, createdAt: -1 });
FeedbackSchema.index({ type: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema);