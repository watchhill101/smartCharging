import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import './index.scss';

interface VerificationHistoryProps {
  userId?: string;
  onClose?: () => void;
  showHeader?: boolean;
}

const VerificationHistory: React.FC<VerificationHistoryProps> = ({
  onClose,
  showHeader = true
}) => {
  // 模拟验证历史数据
  const mockHistory = [
    {
      id: '1',
      date: '2024-01-15 10:30:25',
      type: '人脸验证',
      status: '成功',
      confidence: 0.95
    },
    {
      id: '2',
      date: '2024-01-14 15:22:18',
      type: '人脸验证',
      status: '成功',
      confidence: 0.92
    },
    {
      id: '3',
      date: '2024-01-13 09:15:33',
      type: '人脸验证',
      status: '失败',
      confidence: 0.65
    }
  ];

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <View className='verification-history'>
      {showHeader && (
        <View className='history-header'>
          <Text className='history-title'>验证记录</Text>
          <Button className='close-btn' onClick={handleClose}>
            ✕
          </Button>
        </View>
      )}

      <View className='history-content'>
        {mockHistory.length > 0 ? (
          mockHistory.map((record) => (
            <View key={record.id} className='history-item'>
              <View className='item-info'>
                <Text className='item-type'>{record.type}</Text>
                <Text className='item-date'>{record.date}</Text>
              </View>
              <View className='item-result'>
                <Text className={`item-status ${record.status === '成功' ? 'success' : 'failed'}`}>
                  {record.status}
                </Text>
                <Text className='item-confidence'>
                  置信度: {(record.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View className='empty-history'>
            <Text>暂无验证记录</Text>
          </View>
        )}
      </View>

      {!showHeader && (
        <View className='history-actions'>
          <Button className='back-btn' onClick={handleClose}>
            返回
          </Button>
        </View>
      )}
    </View>
  );
};

export default VerificationHistory; 