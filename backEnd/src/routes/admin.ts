/**
 * 管理员路由
 */

import express from 'express';
import { logger } from '../utils/logger';
import { getDatabasePerformanceReport } from '../config/databaseOptimization';
import mongoose from 'mongoose';

const router = express.Router();

/**
 * 获取数据库性能报告
 * GET /api/admin/database/performance
 */
router.get('/database/performance', async (req, res) => {
  try {
    // 获取基本性能报告
    const performanceReport = getDatabasePerformanceReport();

    // 获取数据库统计信息
    const db = mongoose.connection.db;
    const dbStats = await db.stats();

    // 获取集合统计信息
    const collections = await db.listCollections().toArray();
    const collectionStats = [];

    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        collectionStats.push({
          name: collection.name,
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          indexCount: stats.nindexes,
          indexSize: stats.totalIndexSize
        });
      } catch (error) {
        logger.warn(`Failed to get stats for collection ${collection.name}:`, error);
      }
    }

    // 获取索引使用情况
    const indexStats = [];
    for (const collection of collections) {
      try {
        const indexes = await db.collection(collection.name).indexStats().toArray();
        indexStats.push({
          collection: collection.name,
          indexes: indexes.map(index => ({
            name: index.name,
            accesses: index.accesses
          }))
        });
      } catch (error) {
        logger.warn(`Failed to get index stats for collection ${collection.name}:`, error);
      }
    }

    // 获取连接信息
    const connectionInfo = {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      readyStateText: getReadyStateText(mongoose.connection.readyState)
    };

    // 获取服务器状态
    const serverStatus = await db.admin().serverStatus();
    const serverInfo = {
      version: serverStatus.version,
      uptime: serverStatus.uptime,
      connections: serverStatus.connections,
      network: serverStatus.network,
      opcounters: serverStatus.opcounters,
      mem: serverStatus.mem,
      metrics: {
        document: serverStatus.metrics?.document,
        queryExecutor: serverStatus.metrics?.queryExecutor
      }
    };

    const report = {
      timestamp: new Date().toISOString(),
      performance: performanceReport,
      database: {
        stats: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          indexSize: dbStats.indexSize,
          storageSize: dbStats.storageSize,
          objects: dbStats.objects,
          avgObjSize: dbStats.avgObjSize,
          indexes: dbStats.indexes
        },
        collections: collectionStats,
        indexes: indexStats,
        connection: connectionInfo,
        server: serverInfo
      }
    };

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Failed to get database performance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database performance report',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取慢查询日志
 * GET /api/admin/database/slow-queries
 */
router.get('/database/slow-queries', async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;
    
    const db = mongoose.connection.db;
    
    // 获取慢查询日志
    const slowQueries = await db.collection('system.profile')
      .find({})
      .sort({ ts: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .toArray();

    // 格式化慢查询数据
    const formattedQueries = slowQueries.map(query => ({
      timestamp: query.ts,
      duration: query.millis,
      namespace: query.ns,
      command: query.command,
      planSummary: query.planSummary,
      executionStats: query.executionStats,
      user: query.user,
      client: query.client
    }));

    // 获取慢查询统计
    const stats = await db.collection('system.profile').aggregate([
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          avgDuration: { $avg: '$millis' },
          maxDuration: { $max: '$millis' },
          minDuration: { $min: '$millis' }
        }
      }
    ]).toArray();

    res.json({
      success: true,
      data: {
        queries: formattedQueries,
        statistics: stats[0] || {
          totalQueries: 0,
          avgDuration: 0,
          maxDuration: 0,
          minDuration: 0
        },
        pagination: {
          limit: Number(limit),
          skip: Number(skip),
          total: slowQueries.length
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get slow queries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get slow queries',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 获取数据库健康检查
 * GET /api/admin/database/health
 */
router.get('/database/health', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // 检查数据库连接
    const connectionHealth = {
      status: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
      readyState: mongoose.connection.readyState,
      readyStateText: getReadyStateText(mongoose.connection.readyState)
    };

    // 检查数据库响应时间
    const startTime = Date.now();
    await db.admin().ping();
    const responseTime = Date.now() - startTime;

    // 检查磁盘空间
    const dbStats = await db.stats();
    const diskUsage = {
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexSize: dbStats.indexSize,
      freeStorageSize: dbStats.freeStorageSize || 0,
      usagePercentage: dbStats.storageSize > 0 ? 
        ((dbStats.dataSize + dbStats.indexSize) / dbStats.storageSize * 100).toFixed(2) : 0
    };

    // 检查连接数
    const serverStatus = await db.admin().serverStatus();
    const connections = {
      current: serverStatus.connections.current,
      available: serverStatus.connections.available,
      totalCreated: serverStatus.connections.totalCreated,
      usagePercentage: serverStatus.connections.available > 0 ?
        (serverStatus.connections.current / (serverStatus.connections.current + serverStatus.connections.available) * 100).toFixed(2) : 0
    };

    // 检查复制集状态（如果适用）
    let replicationHealth = null;
    try {
      const replSetStatus = await db.admin().replSetGetStatus();
      replicationHealth = {
        status: replSetStatus.ok === 1 ? 'healthy' : 'unhealthy',
        members: replSetStatus.members?.length || 0,
        primary: replSetStatus.members?.find((m: any) => m.stateStr === 'PRIMARY')?.name || 'unknown'
      };
    } catch (error) {
      // 不是复制集或没有权限
      replicationHealth = {
        status: 'not_applicable',
        message: 'Not a replica set or insufficient permissions'
      };
    }

    // 综合健康状态
    const overallHealth = {
      status: connectionHealth.status === 'healthy' && responseTime < 1000 ? 'healthy' : 'warning',
      score: calculateHealthScore({
        connection: connectionHealth.status === 'healthy',
        responseTime: responseTime < 1000,
        diskUsage: Number(diskUsage.usagePercentage) < 80,
        connections: Number(connections.usagePercentage) < 80
      })
    };

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        overall: overallHealth,
        connection: connectionHealth,
        performance: {
          responseTime: `${responseTime}ms`,
          status: responseTime < 1000 ? 'good' : responseTime < 3000 ? 'warning' : 'poor'
        },
        storage: diskUsage,
        connections,
        replication: replicationHealth
      }
    });

  } catch (error) {
    logger.error('Failed to get database health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database health',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 优化数据库索引
 * POST /api/admin/database/optimize-indexes
 */
router.post('/database/optimize-indexes', async (req, res) => {
  try {
    const { collections } = req.body;
    const db = mongoose.connection.db;
    const results = [];

    // 获取所有集合或指定集合
    const targetCollections = collections || 
      (await db.listCollections().toArray()).map(c => c.name);

    for (const collectionName of targetCollections) {
      try {
        const collection = db.collection(collectionName);
        
        // 获取当前索引
        const currentIndexes = await collection.indexes();
        
        // 获取索引使用统计
        const indexStats = await collection.indexStats().toArray();
        
        // 分析未使用的索引
        const unusedIndexes = indexStats.filter(stat => 
          stat.accesses.ops === 0 && stat.name !== '_id_'
        );

        results.push({
          collection: collectionName,
          totalIndexes: currentIndexes.length,
          unusedIndexes: unusedIndexes.length,
          indexStats: indexStats.map(stat => ({
            name: stat.name,
            accesses: stat.accesses.ops,
            since: stat.accesses.since
          })),
          recommendations: generateIndexRecommendations(currentIndexes, indexStats)
        });

      } catch (error) {
        logger.warn(`Failed to analyze indexes for collection ${collectionName}:`, error);
        results.push({
          collection: collectionName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        collections: results
      }
    });

  } catch (error) {
    logger.error('Failed to optimize indexes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize indexes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * 辅助函数：获取连接状态文本
 */
function getReadyStateText(readyState: number): string {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[readyState as keyof typeof states] || 'unknown';
}

/**
 * 辅助函数：计算健康分数
 */
function calculateHealthScore(checks: Record<string, boolean>): number {
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return Math.round((passedChecks / totalChecks) * 100);
}

/**
 * 辅助函数：生成索引建议
 */
function generateIndexRecommendations(indexes: any[], indexStats: any[]): string[] {
  const recommendations = [];
  
  // 检查未使用的索引
  const unusedIndexes = indexStats.filter(stat => 
    stat.accesses.ops === 0 && stat.name !== '_id_'
  );
  
  if (unusedIndexes.length > 0) {
    recommendations.push(`Consider removing ${unusedIndexes.length} unused indexes to save storage space`);
  }
  
  // 检查重复索引
  const indexKeys = indexes.map(idx => JSON.stringify(idx.key));
  const duplicates = indexKeys.filter((key, index) => indexKeys.indexOf(key) !== index);
  
  if (duplicates.length > 0) {
    recommendations.push('Found potential duplicate indexes that could be consolidated');
  }
  
  // 检查复合索引优化机会
  const singleFieldIndexes = indexes.filter(idx => 
    Object.keys(idx.key).length === 1 && idx.name !== '_id_'
  );
  
  if (singleFieldIndexes.length > 3) {
    recommendations.push('Consider creating compound indexes for frequently queried field combinations');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Index configuration appears to be well optimized');
  }
  
  return recommendations;
}

export default router;