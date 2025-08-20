import { View, Text, Button, ScrollView, Input, Picker } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro, { useLoad, getStorageSync as taroGetStorageSync, showToast } from '@tarojs/taro';
import request from '../../utils/request';
import { STORAGE_KEYS } from '../../utils/constants';
import './index.scss';

interface Vehicle {
  _id?: string;
  brand: string;
  model: string;
  licensePlate: string;
  batteryCapacity?: number;
  vehicleUsage?: string;
  vinCode?: string;
  isNewEnergy?: boolean;
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
    vehicleUsage: '',
    vinCode: '',
    isNewEnergy: false
  });
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [plateDigits, setPlateDigits] = useState<string[]>(['', '', '', '', '', '']);

  // 省份简称数组
  const provinces = ['京', '津', '沪', '渝', '冀', '豫', '云', '辽', '黑', '湘', '皖', '鲁', '新', '苏', '浙', '赣', '鄂', '桂', '甘', '晋', '蒙', '陕', '吉', '闽', '贵', '粤', '青', '藏', '川', '宁', '琼'];
  
  // 常见车辆品牌
  const vehicleBrands = ['雅迪', '爱玛', '台铃', '绿源', '新日', '小牛', '哈啰', '九号', '立马', '小刀', '其他'];

  // 车辆用途选项
  const vehicleUsageOptions = [
    { key: 'ride_hailing', label: '网约车', icon: '🚗' },
    { key: 'private', label: '私家车', icon: '🚙' },
    { key: 'taxi', label: '出租车', icon: '🚕' },
    { key: 'logistics', label: '物流车/商用车', icon: '🚐' }
  ];

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



  const handlePlateDigitChange = (index: number, value: string) => {
    const newDigits = [...plateDigits];
    newDigits[index] = value.toUpperCase();
    setPlateDigits(newDigits);
    
    // 自动跳转到下一个输入框
    if (value && index < 5) {
      // 这里可以添加自动聚焦下一个输入框的逻辑
    }
  };

  const validateForm = () => {
    if (!newVehicle.vehicleUsage) {
      showToast({
        title: '请选择车辆用途',
        icon: 'error',
        duration: 2000
      });
      return false;
    }

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

    // 验证车牌号是否完整
    const isPlateComplete = plateDigits.every(digit => digit.trim() !== '');
    if (!isPlateComplete) {
      showToast({
        title: '请输入完整的车牌号',
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

    const fullLicensePlate = provinces[provinceIndex] + plateDigits.join('');

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
        batteryCapacity: Number(newVehicle.batteryCapacity),
        vehicleUsage: newVehicle.vehicleUsage,
        vinCode: newVehicle.vinCode,
        isNewEnergy: newVehicle.isNewEnergy
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
      vehicleUsage: '',
      vinCode: '',
      isNewEnergy: false
    });
    setProvinceIndex(0);
    setPlateDigits(['', '', '', '', '', '']);
    setEditingVehicle(null);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setNewVehicle({
      brand: vehicle.brand,
      model: vehicle.model,
      licensePlate: vehicle.licensePlate.slice(1), // 去掉省份简称
      batteryCapacity: vehicle.batteryCapacity || 60,
      vehicleUsage: vehicle.vehicleUsage || '',
      vinCode: vehicle.vinCode || '',
      isNewEnergy: vehicle.isNewEnergy || false
    });
    
    // 设置省份索引
    const provinceChar = vehicle.licensePlate.charAt(0);
    const foundIndex = provinces.indexOf(provinceChar);
    setProvinceIndex(foundIndex !== -1 ? foundIndex : 0);
    
    // 设置车牌号数字
    const plateNumbers = vehicle.licensePlate.slice(1);
    const digits = plateNumbers.split('').slice(0, 6);
    while (digits.length < 6) digits.push('');
    setPlateDigits(digits);
    
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
        batteryCapacity: Number(newVehicle.batteryCapacity),
        vehicleUsage: newVehicle.vehicleUsage,
        vinCode: newVehicle.vinCode,
        isNewEnergy: newVehicle.isNewEnergy
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
        <Button className='back-button' onClick={navigateBack}>
          &lt;
        </Button>
        <View className='header-content'>
          <Text className='page-title'>绑定车辆</Text>
          <View className='header-controls'>
            <Text className='control-icon'>⋯</Text>
            <Text className='control-icon'>−</Text>
            <Text className='control-icon'>◎</Text>
          </View>
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
              <View className='car-icon'>🚗</View>
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
                <View className='vehicle-icon'>🚗</View>
                <View className='vehicle-info'>
                  <Text className='vehicle-name'>{vehicle.brand} {vehicle.model}</Text>
                  <Text className='vehicle-plate'>{vehicle.licensePlate}</Text>
                  <Text className='vehicle-usage'>{vehicle.vehicleUsage || '未设置用途'}</Text>
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
            <Text className='form-title'>{editingVehicle ? '编辑车辆' : '绑定车辆'}</Text>
            
            {/* 车牌号码输入 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>请填写车牌号码 *</Text>
              </View>
              <Text className='section-hint'>绑定车牌,可享部分场站减免停车费</Text>
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
                
                <View className='plate-digits-container'>
                  {plateDigits.map((digit, index) => (
                    <Input
                      key={index}
                      className={`plate-digit ${index === 1 ? 'separator-left' : ''} ${index === 2 ? 'separator-right' : ''}`}
                      value={digit}
                      onInput={(e) => handlePlateDigitChange(index, e.detail.value)}
                      maxlength={1}
                      disabled={!!editingVehicle}
                    />
                  ))}
                </View>

                <View className='new-energy-option'>
                  <View 
                    className={`new-energy-toggle ${newVehicle.isNewEnergy ? 'active' : ''}`}
                    onClick={() => !editingVehicle && setNewVehicle({...newVehicle, isNewEnergy: !newVehicle.isNewEnergy})}
                  >
                    <Text className='new-energy-text'>新能源</Text>
                  </View>
                </View>
              </View>
              {editingVehicle && (
                <Text className='edit-note'>编辑模式下不能修改车牌号</Text>
              )}
            </View>

            {/* 车辆用途选择 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>请选择车辆用途 *</Text>
              </View>
              <Text className='section-hint'>为您提供更精准的服务</Text>
              <View className='usage-options-grid'>
                {vehicleUsageOptions.map((option) => (
                  <View 
                    key={option.key}
                    className={`usage-option ${newVehicle.vehicleUsage === option.key ? 'selected' : ''}`}
                    onClick={() => setNewVehicle({...newVehicle, vehicleUsage: option.key})}
                  >
                    <Text className='usage-icon'>{option.icon}</Text>
                    <Text className='usage-label'>{option.label}</Text>
                  </View>
                ))}
              </View>
            </View>

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

            {/* VIN码输入 */}
            <View className='form-section'>
              <View className='section-title'>
                <View className='title-indicator'></View>
                <Text className='section-label'>车辆VIN码 (选填)</Text>
              </View>
              <View className='vin-input-container'>
                <Input
                  className='vin-input'
                  placeholder='请输入VIN码'
                  value={newVehicle.vinCode}
                  onInput={(e) => setNewVehicle({...newVehicle, vinCode: e.detail.value})}
                  maxlength={17}
                />
                <View className='manual-vin-option'>
                  <Text className='manual-vin-text'>手动输入VIN</Text>
                  <Text className='help-icon'>?</Text>
                </View>
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
                className='next-step-btn'
                onClick={editingVehicle ? handleUpdateVehicle : handleAddVehicle}
                loading={isLoading}
              >
                {editingVehicle ? '确认更新' : '下一步'}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
} 