/**
 * 数据库查询优化工具类
 */

import mongoose, { Document, Model, FilterQuery, UpdateQuery, QueryOptions } from 'mongoose';
import { logger } from './logger';
import { queryOptimizationConfig } from '../config/databaseOptimization';

/**
 * 分页查询结果接口
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 分页查询选项
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | Record<string, 1 | 0>;
  populate?: string | Record<string, any>;
}

/**
 * 聚合查询选项
 */
export interface AggregationOptions {
  allowDiskUse?: boolean;
  maxTimeMS?: number;
  batchSize?: number;
  readPreference?: string;
}

/**
 * 批量操作选项
 */
export interface BulkOperationOptions {
  ordered?: boolean;
  writeConcern?: {
    w?: number | string;
    j?: boolean;
    wtimeout?: number;
  };
  batchSize?: number;
}

/**
 * 查询优化器类
 */
export class QueryOptimizer {
  /**
   * 优化的分页查询
   */
  static async paginatedFind<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T> = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T>> {
    const startTime = Date.now();
    
    try {
      const {
        page = 1,
        limit = queryOptimizationConfig.pagination.defaultLimit,
        sort = queryOptimizationConfig.pagination.defaultSort,
        select,
        populate
      } = options;

      // 限制最大分页大小
      const actualLimit = Math.min(limit, queryOptimizationConfig.pagination.maxLimit);
      const skip = (page - 1) * actualLimit;

      // 构建查询
      let query = model.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(actualLimit)
        .maxTimeMS(queryOptimizationConfig.timeout.find);

      // 添加字段选择
      if (select) {
        query = query.select(select);
      }

      // 添加关联查询
      if (populate) {
        query = query.populate(populate);
      }

      // 并行执行查询和计数
      const [data, total] = await Promise.all([
        query.exec(),
        model.countDocuments(filter).maxTimeMS(queryOptimizationConfig.timeout.find)
      ]);

      const totalPages = Math.ceil(total / actualLimit);
      const duration = Date.now() - startTime;

      // 记录慢查询
      if (duration > 1000) {
        logger.warn('Slow paginated query detected:', {
          model: model.modelName,
          filter: JSON.stringify(filter),
          duration: `${duration}ms`,
          total,
          page,
          limit: actualLimit
        });
      }

      return {
        data,
        pagination: {
          page,
          limit: actualLimit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Paginated query failed:', {
        model: model.modelName,
        filter: JSON.stringify(filter),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化的聚合查询
   */
  static async optimizedAggregate<T extends Document>(
    model: Model<T>,
    pipeline: any[],
    options: AggregationOptions = {}
  ): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const {
        allowDiskUse = queryOptimizationConfig.aggregation.allowDiskUse,
        maxTimeMS = queryOptimizationConfig.aggregation.maxTimeMS,
        batchSize = queryOptimizationConfig.aggregation.batchSize,
        readPreference = queryOptimizationConfig.readPreference.analytics
      } = options;

      // 优化管道：添加索引提示和限制
      const optimizedPipeline = this.optimizeAggregationPipeline(pipeline);

      const result = await model.aggregate(optimizedPipeline)
        .allowDiskUse(allowDiskUse)
        .maxTimeMS(maxTimeMS)
        .option('batchSize', batchSize)
        .read(readPreference as any)
        .exec();

      const duration = Date.now() - startTime;

      // 记录慢查询
      if (duration > queryOptimizationConfig.aggregation.maxTimeMS / 2) {
        logger.warn('Slow aggregation query detected:', {
          model: model.modelName,
          pipeline: JSON.stringify(optimizedPipeline),
          duration: `${duration}ms`,
          resultCount: result.length
        });
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Aggregation query failed:', {
        model: model.modelName,
        pipeline: JSON.stringify(pipeline),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化的批量插入
   */
  static async optimizedBulkInsert<T extends Document>(
    model: Model<T>,
    documents: any[],
    options: BulkOperationOptions = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const {
        ordered = false,
        writeConcern = queryOptimizationConfig.writeConcern.bulk,
        batchSize = 1000
      } = options;

      // 分批处理大量数据
      if (documents.length > batchSize) {
        const results = [];
        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize);
          const batchResult = await model.insertMany(batch, {
            ordered,
            writeConcern,
            maxTimeMS: queryOptimizationConfig.timeout.insert
          });
          results.push(...batchResult);
        }
        
        const duration = Date.now() - startTime;
        logger.info('Bulk insert completed:', {
          model: model.modelName,
          totalDocuments: documents.length,
          batches: Math.ceil(documents.length / batchSize),
          duration: `${duration}ms`
        });
        
        return results;
      }

      const result = await model.insertMany(documents, {
        ordered,
        writeConcern,
        maxTimeMS: queryOptimizationConfig.timeout.insert
      });

      const duration = Date.now() - startTime;
      logger.debug('Bulk insert completed:', {
        model: model.modelName,
        documentCount: documents.length,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Bulk insert failed:', {
        model: model.modelName,
        documentCount: documents.length,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化的批量更新
   */
  static async optimizedBulkUpdate<T extends Document>(
    model: Model<T>,
    operations: Array<{
      filter: FilterQuery<T>;
      update: UpdateQuery<T>;
      options?: QueryOptions;
    }>,
    options: BulkOperationOptions = {}
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const {
        ordered = false,
        writeConcern = queryOptimizationConfig.writeConcern.bulk,
        batchSize = 1000
      } = options;

      const bulkOps = operations.map(op => ({
        updateMany: {
          filter: op.filter,
          update: op.update,
          ...op.options
        }
      }));

      // 分批处理大量操作
      if (bulkOps.length > batchSize) {
        const results = [];
        for (let i = 0; i < bulkOps.length; i += batchSize) {
          const batch = bulkOps.slice(i, i + batchSize);
          const batchResult = await model.bulkWrite(batch, {
            ordered,
            writeConcern
          });
          results.push(batchResult);
        }
        
        const duration = Date.now() - startTime;
        logger.info('Bulk update completed:', {
          model: model.modelName,
          totalOperations: operations.length,
          batches: Math.ceil(bulkOps.length / batchSize),
          duration: `${duration}ms`
        });
        
        return results;
      }

      const result = await model.bulkWrite(bulkOps, {
        ordered,
        writeConcern
      });

      const duration = Date.now() - startTime;
      logger.debug('Bulk update completed:', {
        model: model.modelName,
        operationCount: operations.length,
        modifiedCount: result.modifiedCount,
        duration: `${duration}ms`
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Bulk update failed:', {
        model: model.modelName,
        operationCount: operations.length,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化的地理位置查询
   */
  static async nearbyQuery<T extends Document>(
    model: Model<T>,
    coordinates: [number, number],
    maxDistance: number,
    filter: FilterQuery<T> = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T & { distance?: number }>> {
    const startTime = Date.now();
    
    try {
      const {
        page = 1,
        limit = queryOptimizationConfig.pagination.defaultLimit,
        select,
        populate
      } = options;

      const actualLimit = Math.min(limit, queryOptimizationConfig.pagination.maxLimit);
      const skip = (page - 1) * actualLimit;

      // 构建地理位置查询
      const geoQuery = {
        ...filter,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: maxDistance
          }
        }
      };

      let query = model.find(geoQuery)
        .skip(skip)
        .limit(actualLimit)
        .maxTimeMS(queryOptimizationConfig.timeout.find);

      if (select) {
        query = query.select(select);
      }

      if (populate) {
        query = query.populate(populate);
      }

      const [data, total] = await Promise.all([
        query.exec(),
        model.countDocuments(geoQuery).maxTimeMS(queryOptimizationConfig.timeout.find)
      ]);

      const totalPages = Math.ceil(total / actualLimit);
      const duration = Date.now() - startTime;

      // 记录慢查询
      if (duration > 2000) {
        logger.warn('Slow geo query detected:', {
          model: model.modelName,
          coordinates,
          maxDistance,
          duration: `${duration}ms`,
          total
        });
      }

      return {
        data,
        pagination: {
          page,
          limit: actualLimit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Geo query failed:', {
        model: model.modelName,
        coordinates,
        maxDistance,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化的文本搜索
   */
  static async textSearch<T extends Document>(
    model: Model<T>,
    searchText: string,
    filter: FilterQuery<T> = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<T & { score?: number }>> {
    const startTime = Date.now();
    
    try {
      const {
        page = 1,
        limit = queryOptimizationConfig.pagination.defaultLimit,
        select,
        populate
      } = options;

      const actualLimit = Math.min(limit, queryOptimizationConfig.pagination.maxLimit);
      const skip = (page - 1) * actualLimit;

      // 构建文本搜索查询
      const textQuery = {
        ...filter,
        $text: { $search: searchText }
      };

      let query = model.find(textQuery, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(actualLimit)
        .maxTimeMS(queryOptimizationConfig.timeout.find);

      if (select) {
        query = query.select(select);
      }

      if (populate) {
        query = query.populate(populate);
      }

      const [data, total] = await Promise.all([
        query.exec(),
        model.countDocuments(textQuery).maxTimeMS(queryOptimizationConfig.timeout.find)
      ]);

      const totalPages = Math.ceil(total / actualLimit);
      const duration = Date.now() - startTime;

      // 记录慢查询
      if (duration > 1500) {
        logger.warn('Slow text search detected:', {
          model: model.modelName,
          searchText,
          duration: `${duration}ms`,
          total
        });
      }

      return {
        data,
        pagination: {
          page,
          limit: actualLimit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Text search failed:', {
        model: model.modelName,
        searchText,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 优化聚合管道
   */
  private static optimizeAggregationPipeline(pipeline: any[]): any[] {
    const optimized = [...pipeline];

    // 将 $match 阶段尽可能前移
    const matchStages = optimized.filter(stage => stage.$match);
    const otherStages = optimized.filter(stage => !stage.$match);
    
    // 将 $match 放在前面，但保持原有的 $match 顺序
    const reordered = [...matchStages, ...otherStages];

    // 添加 $limit 以减少处理的文档数量（如果没有的话）
    const hasLimit = reordered.some(stage => stage.$limit);
    if (!hasLimit && reordered.length > 2) {
      // 在 $match 之后添加一个合理的 $limit
      const limitStage = { $limit: 10000 };
      const matchIndex = reordered.findIndex(stage => stage.$match);
      if (matchIndex >= 0) {
        reordered.splice(matchIndex + 1, 0, limitStage);
      }
    }

    return reordered;
  }

  /**
   * 创建复合索引建议
   */
  static analyzeQueryPattern<T extends Document>(
    model: Model<T>,
    queries: Array<{ filter: FilterQuery<T>; sort?: any }>
  ): string[] {
    const suggestions = [];
    const fieldUsage = new Map<string, number>();
    const sortFields = new Set<string>();

    // 分析查询模式
    queries.forEach(query => {
      // 统计过滤字段使用频率
      Object.keys(query.filter).forEach(field => {
        fieldUsage.set(field, (fieldUsage.get(field) || 0) + 1);
      });

      // 统计排序字段
      if (query.sort) {
        Object.keys(query.sort).forEach(field => {
          sortFields.add(field);
        });
      }
    });

    // 生成索引建议
    const frequentFields = Array.from(fieldUsage.entries())
      .filter(([_, count]) => count > queries.length * 0.3)
      .sort(([_, a], [__, b]) => b - a)
      .map(([field]) => field);

    if (frequentFields.length > 1) {
      suggestions.push(`Consider creating compound index on: ${frequentFields.slice(0, 3).join(', ')}`);
    }

    if (sortFields.size > 0) {
      suggestions.push(`Consider adding sort fields to indexes: ${Array.from(sortFields).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * 查询性能分析
   */
  static async explainQuery<T extends Document>(
    model: Model<T>,
    filter: FilterQuery<T>,
    options: any = {}
  ): Promise<any> {
    try {
      const explanation = await model.find(filter, null, options).explain('executionStats');
      
      const stats = explanation.executionStats;
      const analysis = {
        indexUsed: stats.indexName || 'COLLSCAN',
        documentsExamined: stats.totalDocsExamined,
        documentsReturned: stats.totalDocsReturned,
        executionTime: stats.executionTimeMillis,
        efficiency: stats.totalDocsReturned / Math.max(stats.totalDocsExamined, 1),
        isEfficient: stats.totalDocsExamined <= stats.totalDocsReturned * 2,
        suggestions: []
      };

      // 生成优化建议
      if (analysis.efficiency < 0.1) {
        analysis.suggestions.push('Query efficiency is low, consider adding appropriate indexes');
      }

      if (stats.indexName === null) {
        analysis.suggestions.push('Query is using collection scan, consider adding index');
      }

      if (stats.executionTimeMillis > 1000) {
        analysis.suggestions.push('Query execution time is high, consider optimization');
      }

      return analysis;

    } catch (error) {
      logger.error('Query explanation failed:', {
        model: model.modelName,
        filter: JSON.stringify(filter),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export default QueryOptimizer;