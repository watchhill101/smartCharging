import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import ChargingStationService, { StationImportData } from '../services/ChargingStationService';

export interface ImportOptions {
  batchSize?: number;
  skipErrors?: boolean;
  validateOnly?: boolean;
  updateExisting?: boolean;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    data: any;
    error: string;
  }>;
  summary: {
    created: number;
    updated: number;
    skipped: number;
  };
}

export class StationDataImporter {
  private stationService: ChargingStationService;

  constructor() {
    this.stationService = new ChargingStationService();
  }

  /**
   * 从CSV文件导入充电站数据
   */
  async importFromCSV(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const {
      batchSize = 100,
      skipErrors = true,
      validateOnly = false,
      updateExisting = false
    } = options;

    console.log('📁 开始从CSV文件导入数据:', filePath);

    const result: ImportResult = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
      summary: {
        created: 0,
        updated: 0,
        skipped: 0
      }
    };

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const records: any[] = [];
      
      // 读取CSV文件
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            records.push(data);
          })
          .on('end', () => {
            resolve();
          })
          .on('error', (error) => {
            reject(error);
          });
      });

      result.total = records.length;
      console.log(`📊 读取到 ${records.length} 条记录`);

      // 分批处理数据
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        console.log(`🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);

        for (let j = 0; j < batch.length; j++) {
          const rowIndex = i + j + 1; // CSV行号（从1开始）
          const record = batch[j];

          try {
            // 验证和转换数据
            const stationData = this.validateAndTransformRecord(record, rowIndex);

            if (validateOnly) {
              // 仅验证模式
              result.success++;
              continue;
            }

            // 检查是否已存在
            const existingStation = await this.stationService.getStationById(stationData.stationId);

            if (existingStation) {
              if (updateExisting) {
                // 更新现有充电站
                await this.stationService.updateStation(stationData.stationId, stationData);
                result.summary.updated++;
                result.success++;
              } else {
                // 跳过已存在的充电站
                result.summary.skipped++;
                result.success++;
              }
            } else {
              // 创建新充电站
              await this.stationService.createStation(stationData);
              result.summary.created++;
              result.success++;
            }

          } catch (error: any) {
            console.error(`❌ 处理第 ${rowIndex} 行数据失败:`, error.message);
            
            result.failed++;
            result.errors.push({
              row: rowIndex,
              data: record,
              error: error.message
            });

            if (!skipErrors) {
              throw error;
            }
          }
        }

        // 批次间短暂延迟，避免数据库压力过大
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('✅ CSV导入完成:', {
        total: result.total,
        success: result.success,
        failed: result.failed,
        created: result.summary.created,
        updated: result.summary.updated,
        skipped: result.summary.skipped
      });

      return result;

    } catch (error: any) {
      console.error('❌ CSV导入失败:', error);
      throw new Error(`CSV导入失败: ${error.message}`);
    }
  }

  /**
   * 从JSON文件导入充电站数据
   */
  async importFromJSON(filePath: string, options: ImportOptions = {}): Promise<ImportResult> {
    const {
      batchSize = 100,
      skipErrors = true,
      validateOnly = false,
      updateExisting = false
    } = options;

    console.log('📁 开始从JSON文件导入数据:', filePath);

    const result: ImportResult = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [],
      summary: {
        created: 0,
        updated: 0,
        skipped: 0
      }
    };

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 读取JSON文件
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      // 确保数据是数组格式
      const records = Array.isArray(jsonData) ? jsonData : [jsonData];
      result.total = records.length;

      console.log(`📊 读取到 ${records.length} 条记录`);

      // 分批处理数据
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        console.log(`🔄 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);

        for (let j = 0; j < batch.length; j++) {
          const recordIndex = i + j + 1;
          const record = batch[j];

          try {
            // 验证数据格式
            const stationData = this.validateStationData(record);

            if (validateOnly) {
              result.success++;
              continue;
            }

            // 检查是否已存在
            const existingStation = await this.stationService.getStationById(stationData.stationId);

            if (existingStation) {
              if (updateExisting) {
                await this.stationService.updateStation(stationData.stationId, stationData);
                result.summary.updated++;
                result.success++;
              } else {
                result.summary.skipped++;
                result.success++;
              }
            } else {
              await this.stationService.createStation(stationData);
              result.summary.created++;
              result.success++;
            }

          } catch (error: any) {
            console.error(`❌ 处理第 ${recordIndex} 条数据失败:`, error.message);
            
            result.failed++;
            result.errors.push({
              row: recordIndex,
              data: record,
              error: error.message
            });

            if (!skipErrors) {
              throw error;
            }
          }
        }

        // 批次间延迟
        if (i + batchSize < records.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('✅ JSON导入完成:', {
        total: result.total,
        success: result.success,
        failed: result.failed,
        created: result.summary.created,
        updated: result.summary.updated,
        skipped: result.summary.skipped
      });

      return result;

    } catch (error: any) {
      console.error('❌ JSON导入失败:', error);
      throw new Error(`JSON导入失败: ${error.message}`);
    }
  }

  /**
   * 生成示例数据文件
   */
  async generateSampleData(outputPath: string, count: number = 10): Promise<void> {
    console.log('📝 生成示例数据文件:', outputPath);

    const sampleStations: StationImportData[] = [];

    for (let i = 1; i <= count; i++) {
      const stationData: StationImportData = {
        stationId: `STATION_${i.toString().padStart(4, '0')}`,
        name: `示例充电站${i}`,
        address: `北京市朝阳区示例路${i}号`,
        longitude: 116.397470 + (Math.random() - 0.5) * 0.1,
        latitude: 39.908823 + (Math.random() - 0.5) * 0.1,
        city: '北京市',
        district: '朝阳区',
        province: '北京市',
        operator: {
          name: ['国家电网', '特来电', '星星充电', '小鹏超充'][Math.floor(Math.random() * 4)],
          phone: '400-1234-567',
          email: 'service@example.com'
        },
        piles: this.generateSamplePiles(Math.floor(Math.random() * 8) + 2), // 2-10个充电桩
        openTime: {
          start: '00:00',
          end: '24:00',
          is24Hours: true
        },
        services: this.getRandomServices(),
        contact: {
          phone: '010-1234-5678',
          emergencyPhone: '400-emergency'
        },
        images: [
          'https://example.com/station1.jpg',
          'https://example.com/station2.jpg'
        ],
        description: `这是示例充电站${i}的描述信息，提供优质的充电服务。`
      };

      sampleStations.push(stationData);
    }

    // 写入文件
    const ext = path.extname(outputPath).toLowerCase();
    
    if (ext === '.json') {
      fs.writeFileSync(outputPath, JSON.stringify(sampleStations, null, 2), 'utf-8');
    } else if (ext === '.csv') {
      // 转换为CSV格式（简化版）
      const csvHeader = 'stationId,name,address,longitude,latitude,city,district,province,operatorName,operatorPhone\n';
      const csvRows = sampleStations.map(station => 
        `${station.stationId},${station.name},${station.address},${station.longitude},${station.latitude},${station.city},${station.district},${station.province},${station.operator.name},${station.operator.phone}`
      ).join('\n');
      
      fs.writeFileSync(outputPath, csvHeader + csvRows, 'utf-8');
    } else {
      throw new Error('不支持的文件格式，请使用 .json 或 .csv');
    }

    console.log(`✅ 示例数据文件生成完成: ${outputPath}`);
  }

  /**
   * 验证和转换CSV记录
   */
  private validateAndTransformRecord(record: any, rowIndex: number): StationImportData {
    const requiredFields = ['stationId', 'name', 'address', 'longitude', 'latitude', 'city', 'operatorName'];
    
    // 检查必需字段
    for (const field of requiredFields) {
      if (!record[field] || record[field].toString().trim() === '') {
        throw new Error(`第 ${rowIndex} 行缺少必需字段: ${field}`);
      }
    }

    // 验证坐标
    const longitude = parseFloat(record.longitude);
    const latitude = parseFloat(record.latitude);
    
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第 ${rowIndex} 行经度无效: ${record.longitude}`);
    }
    
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第 ${rowIndex} 行纬度无效: ${record.latitude}`);
    }

    // 构建充电桩数据（从CSV简化格式）
    const piles = this.parsePilesFromCSV(record);

    return {
      stationId: record.stationId.trim(),
      name: record.name.trim(),
      address: record.address.trim(),
      longitude,
      latitude,
      city: record.city.trim(),
      district: record.district?.trim() || '',
      province: record.province?.trim() || record.city.trim(),
      operator: {
        name: record.operatorName.trim(),
        phone: record.operatorPhone?.trim() || '400-000-0000',
        email: record.operatorEmail?.trim()
      },
      piles,
      openTime: {
        start: record.openStart?.trim() || '00:00',
        end: record.openEnd?.trim() || '24:00',
        is24Hours: record.is24Hours === 'true' || record.is24Hours === '1'
      },
      services: record.services ? record.services.split(',').map((s: string) => s.trim()) : [],
      contact: {
        phone: record.contactPhone?.trim(),
        emergencyPhone: record.emergencyPhone?.trim()
      },
      images: record.images ? record.images.split(',').map((s: string) => s.trim()) : [],
      description: record.description?.trim()
    };
  }

  /**
   * 从CSV记录解析充电桩数据
   */
  private parsePilesFromCSV(record: any): StationImportData['piles'] {
    // 如果CSV中有详细的充电桩信息
    if (record.pileData) {
      try {
        return JSON.parse(record.pileData);
      } catch (error) {
        console.warn('解析充电桩数据失败，使用默认数据');
      }
    }

    // 否则生成默认充电桩
    const pileCount = parseInt(record.pileCount) || 2;
    return this.generateSamplePiles(pileCount);
  }

  /**
   * 验证充电站数据格式
   */
  private validateStationData(data: any): StationImportData {
    const requiredFields = ['stationId', 'name', 'address', 'longitude', 'latitude', 'city', 'operator', 'piles'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`缺少必需字段: ${field}`);
      }
    }

    // 验证坐标
    if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180) {
      throw new Error(`经度无效: ${data.longitude}`);
    }
    
    if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90) {
      throw new Error(`纬度无效: ${data.latitude}`);
    }

    // 验证运营商信息
    if (!data.operator.name || !data.operator.phone) {
      throw new Error('运营商信息不完整');
    }

    // 验证充电桩信息
    if (!Array.isArray(data.piles) || data.piles.length === 0) {
      throw new Error('充电桩信息无效');
    }

    for (let i = 0; i < data.piles.length; i++) {
      const pile = data.piles[i];
      if (!pile.pileId || !pile.type || !pile.power || !pile.price) {
        throw new Error(`第 ${i + 1} 个充电桩信息不完整`);
      }
    }

    return data as StationImportData;
  }

  /**
   * 生成示例充电桩数据
   */
  private generateSamplePiles(count: number): StationImportData['piles'] {
    const piles: StationImportData['piles'] = [];
    const pileTypes = ['AC', 'DC', 'AC_DC'] as const;
    const connectorTypes = [
      ['GB/T'],
      ['CCS'],
      ['GB/T', 'CCS'],
      ['CHAdeMO'],
      ['Tesla']
    ];

    for (let i = 1; i <= count; i++) {
      const type = pileTypes[Math.floor(Math.random() * pileTypes.length)];
      const power = type === 'DC' ? 
        [60, 120, 180, 240][Math.floor(Math.random() * 4)] : 
        [7, 11, 22][Math.floor(Math.random() * 3)];

      piles.push({
        pileId: `PILE_${i.toString().padStart(3, '0')}`,
        pileNumber: i.toString(),
        type,
        power,
        voltage: type === 'DC' ? 500 : 220,
        current: Math.round(power * 1000 / (type === 'DC' ? 500 : 220)),
        connectorType: connectorTypes[Math.floor(Math.random() * connectorTypes.length)],
        price: {
          servicePrice: Math.round((Math.random() * 0.5 + 0.3) * 100) / 100, // 0.3-0.8元/kWh
          electricityPrice: Math.round((Math.random() * 0.3 + 0.5) * 100) / 100, // 0.5-0.8元/kWh
          parkingPrice: Math.random() > 0.5 ? Math.round((Math.random() * 3 + 2) * 100) / 100 : undefined // 2-5元/小时
        }
      });
    }

    return piles;
  }

  /**
   * 获取随机服务列表
   */
  private getRandomServices(): string[] {
    const allServices = ['parking', 'restaurant', 'restroom', 'wifi', 'shop', 'repair', 'car_wash'];
    const serviceCount = Math.floor(Math.random() * 4) + 2; // 2-5个服务
    
    const shuffled = allServices.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, serviceCount);
  }

  /**
   * 导出充电站数据
   */
  async exportStations(
    outputPath: string, 
    filters: any = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<void> {
    console.log('📤 导出充电站数据:', outputPath);

    try {
      // 获取所有符合条件的充电站
      const result = await this.stationService.searchStations('', undefined, 50000, filters, { limit: 10000 });
      const stations = result.stations;

      if (format === 'json') {
        fs.writeFileSync(outputPath, JSON.stringify(stations, null, 2), 'utf-8');
      } else if (format === 'csv') {
        // 转换为CSV格式
        const csvHeader = 'stationId,name,address,longitude,latitude,city,district,province,operatorName,totalPiles,availablePiles,rating\n';
        const csvRows = stations.map(station => 
          `${station.stationId},${station.name},"${station.address}",${station.location.coordinates[0]},${station.location.coordinates[1]},${station.city},${station.district},${station.province},${station.operator.name},${station.totalPiles},${station.availablePiles},${station.rating.average}`
        ).join('\n');
        
        fs.writeFileSync(outputPath, csvHeader + csvRows, 'utf-8');
      }

      console.log(`✅ 导出完成，共 ${stations.length} 条数据: ${outputPath}`);

    } catch (error: any) {
      console.error('❌ 导出失败:', error);
      throw new Error(`导出失败: ${error.message}`);
    }
  }
}

export default StationDataImporter;