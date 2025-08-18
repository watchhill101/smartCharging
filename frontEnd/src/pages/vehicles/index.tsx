import { View, Text, Button, ScrollView, Input, Picker, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useLoad, getStorageSync as taroGetStorageSync, showToast, chooseImage } from '@tarojs/taro';
import request from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface Vehicle {
  _id?: string;
  brand: string;
  model: string;
  licensePlate: string;
  batteryCapacity?: number;
  vehiclePhoto?: string;
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [newVehicle, setNewVehicle] = useState<Vehicle>({
    brand: '',
    model: '',
    licensePlate: '',
    batteryCapacity: 60,
    vehiclePhoto: ''
  });
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [uploadedPhoto, setUploadedPhoto] = useState<string>('');

  // 省份简称数组
  const provinces = ['京', '津', '沪', '渝', '冀', '豫', '云', '辽', '黑', '湘', '皖', '鲁', '新', '苏', '浙', '赣', '鄂', '桂', '甘', '晋', '蒙', '陕', '吉', '闽', '贵', '粤', '青', '藏', '川', '宁', '琼'];
  
  // 常见车辆品牌
  const vehicleBrands = ['雅迪', '爱玛', '台铃', '绿源', '新日', '小牛', '哈啰', '九号', '立马', '小刀', '其他'];

  useLoad(() => {
    console.log('🚗 车辆管理页面加载');
    loadUserVehicles();
  });

  const loadUserVehicles = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 开始加载车辆数据...');

      // 检查用户认证
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      
      if (token) {
        try {
          const response = await request({
            url: '/v1_0/auth/api/users/vehicles',
            method: 'GET',
            showError: false
          });

          console.log('📡 车辆API响应:', response);

          if (response && response.success) {
            const userVehicles = response.data?.vehicles || [];
            setVehicles(userVehicles);
            console.log('✅ 车辆数据加载成功:', userVehicles.length, '辆车');
            return;
          } else {
            console.log('⚠️ 车辆API返回失败状态');
            throw new Error('获取车辆数据失败');
          }
        } catch (apiError: any) {
          console.error('❌ 车辆API请求失败:', apiError);
          console.log('🔄 API失败，使用空数组');
          setVehicles([]);
        }
      } else {
        console.log('❌ 未找到用户token，显示空车辆列表');
        setVehicles([]);
      }
      
    } catch (error: any) {
      console.error('❌ 加载车辆失败:', error);
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseImage = () => {
    chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        setUploadedPhoto(tempFilePath);
        setNewVehicle({...newVehicle, vehiclePhoto: tempFilePath});
        showToast({
          title: '照片已选择',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        showToast({
          title: '选择图片失败',
          icon: 'error',
          duration: 2000
        });
      }
    });
  };

  const validateForm = () => {
    if (!newVehicle.brand.trim()) {
      showToast({
        title: '请选择车辆品牌',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

    if (!newVehicle.model.trim()) {
      showToast({
        title: '请输入车辆型号',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

    if (!newVehicle.licensePlate.trim()) {
      showToast({
        title: '请输入车牌号',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

    // 验证车牌号格式（简单验证）
    const platePattern = /^[A-Z0-9]{5,6}$/i;
    if (!platePattern.test(newVehicle.licensePlate)) {
      showToast({
        title: '车牌号格式不正确',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

    if (!newVehicle.batteryCapacity || newVehicle.batteryCapacity <= 0) {
      showToast({
        title: '请输入有效的电池容量',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

    return true;
  };

  const handleAddVehicle = async () => {
    if (!validateForm()) return;

    const fullLicensePlate = provinces[provinceIndex] + newVehicle.licensePlate;

    try {
      setIsLoading(true);
      
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      if (!token) {
        showToast({
          title: '请先登录',
          icon: 'error',
          duration: 2000
        });
        return;
      }

      const vehicleData = {
        brand: newVehicle.brand.trim(),
        model: newVehicle.model.trim(),
        licensePlate: fullLicensePlate,
        batteryCapacity: Number(newVehicle.batteryCapacity)
      };

      const response = await request({
        url: '/v1_0/auth/api/users/vehicles',
        method: 'POST',
        data: vehicleData,
        showError: false
      });

      if (response && response.success) {
        showToast({
          title: '车辆添加成功',
          icon: 'success',
          duration: 2000
        });
        setShowAddForm(false);
        resetForm();
        // 重新加载车辆列表
        await loadUserVehicles();
      } else {
        showToast({
          title: response?.message || '添加车辆失败',
          icon: 'error',
          duration: 2000
        });
      }
    } catch (error: any) {
      console.error('❌ 添加车辆失败:', error);
      showToast({
        title: '添加车辆失败',
        icon: 'error',
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewVehicle({
      brand: '',
      model: '',
      licensePlate: '',
      batteryCapacity: 60,
      vehiclePhoto: ''
    });
    setProvinceIndex(0);
    setUploadedPhoto('');
    setEditingVehicle(null);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setNewVehicle({
      brand: vehicle.brand,
      model: vehicle.model,
      licensePlate: vehicle.licensePlate.slice(1), // 去掉省份简称
      batteryCapacity: vehicle.batteryCapacity || 60,
      vehiclePhoto: vehicle.vehiclePhoto || ''
    });
    
    // 设置省份索引
    const provinceChar = vehicle.licensePlate.charAt(0);
    const foundIndex = provinces.indexOf(provinceChar);
    setProvinceIndex(foundIndex !== -1 ? foundIndex : 0);
    
    setUploadedPhoto(vehicle.vehiclePhoto || '');
    setShowAddForm(true);
  };

  const handleUpdateVehicle = async () => {
    if (!validateForm() || !editingVehicle) return;

    try {
      setIsLoading(true);
      
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      if (!token) {
        showToast({
          title: '请先登录',
          icon: 'error',
          duration: 2000
        });
        return;
      }

      const vehicleData = {
        brand: newVehicle.brand.trim(),
        model: newVehicle.model.trim(),
        batteryCapacity: Number(newVehicle.batteryCapacity)
      };

      const response = await request({
        url: `/v1_0/auth/api/users/vehicles/${encodeURIComponent(editingVehicle.licensePlate)}`,
        method: 'PUT',
        data: vehicleData,
        showError: false
      });

      if (response && response.success) {
        showToast({
          title: '车辆更新成功',
          icon: 'success',
          duration: 2000
        });
        setShowAddForm(false);
        resetForm();
        // 重新加载车辆列表
        await loadUserVehicles();
      } else {
        showToast({
          title: response?.message || '更新车辆失败',
          icon: 'error',
          duration: 2000
        });
      }
    } catch (error: any) {
      console.error('❌ 更新车辆失败:', error);
      showToast({
        title: '更新车辆失败',
        icon: 'error',
        duration: 2000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVehicle = async (licensePlate: string) => {
    try {
      const token = taroGetStorageSync(STORAGE_KEYS.USER_TOKEN);
      if (!token) {
        showToast({
          title: '请先登录',
          icon: 'error',
          duration: 2000
        });
        return;
      }

      // 显示确认对话框
      const result = await new Promise((resolve) => {
        try {
          Taro.showModal({
            title: '确认删除',
            content: '确定要删除这辆车吗？',
            success: (res) => {
              resolve(res.confirm);
            },
            fail: () => {
              resolve(false);
            }
          });
        } catch (error) {
          console.error('显示确认对话框失败:', error);
          // fallback到原生confirm
          resolve(confirm('确定要删除这辆车吗？'));
        }
      });

      if (!result) return;

      const response = await request({
        url: `/v1_0/auth/api/users/vehicles/${encodeURIComponent(licensePlate)}`,
        method: 'DELETE',
        showError: false
      });

      if (response && response.success) {
        showToast({
          title: '车辆删除成功',
          icon: 'success',
          duration: 2000
        });
        await loadUserVehicles();
      } else {
        showToast({
          title: response?.message || '删除车辆失败',
          icon: 'error',
          duration: 2000
        });
      }
    } catch (error: any) {
      console.error('❌ 删除车辆失败:', error);
      showToast({
        title: '删除车辆失败',
        icon: 'error',
        duration: 2000
      });
    }
  };

  const navigateBack = () => {
    try {
      Taro.switchTab({
        url: '/pages/profile/index'
      });
    } catch (error) {
      console.error('返回个人中心失败:', error);
      try {
        Taro.navigateBack();
      } catch (backError) {
        console.error('返回失败:', backError);
      }
    }
  };

  return (
    <View className='vehicles-page'>
      {/* 头部导航 */}
      <View className='vehicles-header'>
        <View className='header-nav'>
          <Button className='back-button' onClick={navigateBack}>
            ← 返回
          </Button>
          <Text className='page-title'>我的车辆</Text>
          <View className='header-placeholder'></View>
        </View>
      </View>

      <ScrollView className='vehicles-content' scrollY>
        {isLoading && (
          <View className='loading-container'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        )}

        {!isLoading && vehicles.length === 0 && !showAddForm && (
          <View className='empty-container'>
            <View className='empty-illustration'>
              <View className='scooter-icon'>🛵</View>
              <View className='clouds'>
                <View className='cloud cloud-1'>☁️</View>
                <View className='cloud cloud-2'>☁️</View>
              </View>
              <View className='trees'>
                <View className='tree'>🌲</View>
                <View className='tree'>🌳</View>
              </View>
            </View>
            <Text className='empty-title'>暂无车辆，请先添加车辆</Text>
            <Button className='add-vehicle-btn' onClick={() => setShowAddForm(true)}>
              ⊕ 添加车辆
            </Button>
          </View>
        )}

        {vehicles.length > 0 && !showAddForm && (
          <View className='vehicles-list'>
            <View className='vehicles-header-info'>
              <Text className='vehicles-count'>共 {vehicles.length} 辆车</Text>
              <Button 
                className='add-more-btn' 
                size='mini'
                onClick={() => setShowAddForm(true)}
              >
                + 添加车辆
              </Button>
            </View>

            {vehicles.map((vehicle, index) => (
              <View key={vehicle._id || index} className='vehicle-item'>
                <View className='vehicle-icon'>🛵</View>
                <View className='vehicle-info'>
                  <Text className='vehicle-name'>{vehicle.brand} {vehicle.model}</Text>
                  <Text className='vehicle-plate'>{vehicle.licensePlate}</Text>
                  <Text className='vehicle-battery'>电池容量: {vehicle.batteryCapacity || 60}Ah</Text>
                </View>
                <View className='vehicle-actions'>
                  <Button 
                    className='edit-btn'
                    size='mini'
                    onClick={() => handleEditVehicle(vehicle)}
                  >
                    编辑
                  </Button>
                  <Button 
                    className='delete-btn'
                    size='mini'
                    onClick={() => handleDeleteVehicle(vehicle.licensePlate)}
                  >
                    删除
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}

        {showAddForm && (
          <View className='add-form'>
            <Text className='form-title'>{editingVehicle ? '编辑车辆' : '添加车辆'}</Text>
            
            {/* 车辆品牌 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>车辆品牌：</Text>
              </View>
              <Picker
                mode='selector'
                range={vehicleBrands}
                value={vehicleBrands.indexOf(newVehicle.brand) !== -1 ? vehicleBrands.indexOf(newVehicle.brand) : 0}
                onChange={(e) => {
                  const selectedBrand = vehicleBrands[Number(e.detail.value)];
                  setNewVehicle({...newVehicle, brand: selectedBrand});
                }}
              >
                <View className='brand-picker'>
                  <Text className={`brand-text ${!newVehicle.brand ? 'placeholder' : ''}`}>
                    {newVehicle.brand || '请选择车辆品牌'}
                  </Text>
                  <Text className='picker-arrow'>▼</Text>
                </View>
              </Picker>
            </View>

            {/* 车辆型号 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>车辆型号：</Text>
              </View>
              <Input
                className='model-input'
                placeholder='请输入车辆型号，如：G5'
                value={newVehicle.model}
                onInput={(e) => setNewVehicle({...newVehicle, model: e.detail.value})}
                maxlength={20}
              />
            </View>

            {/* 车辆号码 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>车辆号码：</Text>
              </View>
              <View className='license-plate-input'>
                <Picker
                  mode='selector'
                  range={provinces}
                  value={provinceIndex}
                  onChange={(e) => setProvinceIndex(Number(e.detail.value))}
                  disabled={!!editingVehicle}
                >
                  <View className={`province-picker ${editingVehicle ? 'disabled' : ''}`}>
                    <Text className='province-text'>{provinces[provinceIndex]}</Text>
                    <Text className='picker-arrow'>▼</Text>
                  </View>
                </Picker>
                <Input
                  className='plate-input'
                  placeholder='请输入车辆车牌'
                  value={newVehicle.licensePlate}
                  onInput={(e) => setNewVehicle({...newVehicle, licensePlate: e.detail.value.toUpperCase()})}
                  maxlength={6}
                  disabled={!!editingVehicle}
                />
              </View>
              {editingVehicle && (
                <Text className='edit-note'>编辑模式下不能修改车牌号</Text>
              )}
            </View>

            {/* 电池容量 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>电池容量：</Text>
              </View>
              <Input
                className='battery-input'
                type='number'
                placeholder='请输入电池容量（Ah）'
                value={newVehicle.batteryCapacity?.toString() || '60'}
                onInput={(e) => setNewVehicle({...newVehicle, batteryCapacity: Number(e.detail.value) || 60})}
                maxlength={3}
              />
            </View>

            {/* 车辆照片 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>车辆照片：</Text>
              </View>
              <View className='photo-upload'>
                {uploadedPhoto ? (
                  <View className='photo-preview'>
                    <Image 
                      src={uploadedPhoto} 
                      className='preview-image'
                      mode='aspectFit'
                    />
                    <Button 
                      className='change-photo-btn'
                      size='mini'
                      onClick={handleChooseImage}
                    >
                      重新选择
                    </Button>
                  </View>
                ) : (
                  <View className='upload-area' onClick={handleChooseImage}>
                    <View className='upload-icon'>📷</View>
                    <Text className='upload-text'>点击上传照片</Text>
                  </View>
                )}
              </View>
            </View>

            {/* 注意事项 */}
            <View className='notice'>
              <Text className='notice-text'>注：请如实填写以上信息，若信息不实，将影响您的使用</Text>
            </View>

            {/* 底部按钮 */}
            <View className='form-buttons'>
              <Button 
                className='cancel-btn'
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
              >
                取消
              </Button>
              <Button 
                className='confirm-submit-btn'
                onClick={editingVehicle ? handleUpdateVehicle : handleAddVehicle}
                loading={isLoading}
              >
                {editingVehicle ? '确认更新' : '确认提交'}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
} 