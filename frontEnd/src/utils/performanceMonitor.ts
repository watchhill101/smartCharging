import Taro from '@tarojs/taro';
import { performanceMonitorConfig } from '../../config/performance';

/**
 * 性能指标接口
 */
interface PerformanceMetrics {
  // Core Web Vitals
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  
  // 自定义指标
  pageLoadTime?: number;
  domContentLoaded?: number;
  resourceLoadTime?: number;
  jsExecutionTime?: number;
  memoryUsage?: number;
  
  // 用户体验指标
  timeToInteractive?: number;
  firstInputDelay?: number;
  totalBlockingTime?: number;
}

/**
 * 性能事件接口
 */
interface PerformanceEvent {
  type: string;
  timestamp: number;
  value: number;
  url: string;
  userAgent: string;
  metrics: PerformanceMetrics;
}

/**
 * 性能监控类
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];
  private startTime: number = Date.now();
  private isMonitoring: boolean = false;
  private reportQueue: PerformanceEvent[] = [];
  private reportTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 初始化性能监控
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    this.isMonitoring = true;
    this.startTime = Date.now();

    // 监控页面加载性能
    this.observeNavigationTiming();
    
    // 监控资源加载性能
    this.observeResourceTiming();
    
    // 监控Core Web Vitals
    this.observeWebVitals();
    
    // 监控内存使用
    this.observeMemoryUsage();
    
    // 监控长任务
    this.observeLongTasks();
    
    // 设置定时报告
    this.setupPeriodicReporting();
  }

  /**
   * 监控导航时间
   */
  private observeNavigationTiming(): void {
    if (!window.performance || !window.performance.timing) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = window.performance.timing;
        const navigation = window.performance.navigation;
        
        this.metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
        this.metrics.TTFB = timing.responseStart - timing.navigationStart;
        
        this.reportMetric('navigation', this.metrics.pageLoadTime || 0);
      }, 0);
    });
  }

  /**
   * 监控资源加载时间
   */
  private observeResourceTiming(): void {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let totalResourceTime = 0;
        let resourceCount = 0;

        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            totalResourceTime += entry.duration;
            resourceCount++;
          }
        });

        if (resourceCount > 0) {
          this.metrics.resourceLoadTime = totalResourceTime / resourceCount;
          this.reportMetric('resource', this.metrics.resourceLoadTime);
        }
      });

      observer.observe({ entryTypes: ['resource'] });
      this.observers.push(observer);
    } catch (error) {
      console.warn('Resource timing observation failed:', error);
    }
  }

  /**
   * 监控Core Web Vitals
   */
  private observeWebVitals(): void {
    // FCP (First Contentful Paint)
    this.observePerformanceEntry('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.FCP = fcpEntry.startTime;
        this.reportMetric('FCP', this.metrics.FCP);
      }
    });

    // LCP (Largest Contentful Paint)
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lcpEntry = entries[entries.length - 1];
      if (lcpEntry) {
        this.metrics.LCP = lcpEntry.startTime;
        this.reportMetric('LCP', this.metrics.LCP);
      }
    });

    // FID (First Input Delay)
    this.observePerformanceEntry('first-input', (entries) => {
      const fidEntry = entries[0];
      if (fidEntry) {
        this.metrics.FID = fidEntry.processingStart - fidEntry.startTime;
        this.reportMetric('FID', this.metrics.FID);
      }
    });

    // CLS (Cumulative Layout Shift)
    this.observePerformanceEntry('layout-shift', (entries) => {
      let clsValue = 0;
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.metrics.CLS = clsValue;
      this.reportMetric('CLS', this.metrics.CLS);
    });
  }

  /**
   * 通用性能条目观察器
   */
  private observePerformanceEntry(
    entryType: string,
    callback: (entries: PerformanceEntry[]) => void
  ): void {
    if (!window.PerformanceObserver) return;

    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ entryTypes: [entryType] });
      this.observers.push(observer);
    } catch (error) {
      console.warn(`Performance observation for ${entryType} failed:`, error);
    }
  }

  /**
   * 监控内存使用
   */
  private observeMemoryUsage(): void {
    if (!(window.performance as any)?.memory) return;

    const updateMemoryMetrics = () => {
      const memory = (window.performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
      this.reportMetric('memory', this.metrics.memoryUsage);
    };

    // 初始测量
    updateMemoryMetrics();
    
    // 定期测量
    setInterval(updateMemoryMetrics, 30000); // 每30秒测量一次
  }

  /**
   * 监控长任务
   */
  private observeLongTasks(): void {
    this.observePerformanceEntry('longtask', (entries) => {
      let totalBlockingTime = 0;
      entries.forEach((entry) => {
        // 长任务超过50ms的部分被认为是阻塞时间
        if (entry.duration > 50) {
          totalBlockingTime += entry.duration - 50;
        }
      });
      
      this.metrics.totalBlockingTime = (this.metrics.totalBlockingTime || 0) + totalBlockingTime;
      this.reportMetric('longtask', totalBlockingTime);
    });
  }

  /**
   * 设置定期报告
   */
  private setupPeriodicReporting(): void {
    this.reportTimer = setInterval(() => {
      this.flushReports();
    }, 30000); // 每30秒发送一次报告
  }

  /**
   * 报告性能指标
   */
  private reportMetric(type: string, value: number): void {
    const event: PerformanceEvent = {
      type,
      timestamp: Date.now(),
      value,
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: { ...this.metrics }
    };

    this.reportQueue.push(event);
    
    // 检查是否超过阈值
    this.checkThresholds(type, value);
  }

  /**
   * 检查性能阈值
   */
  private checkThresholds(type: string, value: number): void {
    const { thresholds } = performanceMonitorConfig;
    const threshold = thresholds[type as keyof typeof thresholds];
    
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${type}: ${value}ms (threshold: ${threshold}ms)`);
      
      // 发送警告事件
      this.reportQueue.push({
        type: 'threshold_exceeded',
        timestamp: Date.now(),
        value,
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics: { ...this.metrics }
      });
    }
  }

  /**
   * 刷新报告队列
   */
  private flushReports(): void {
    if (this.reportQueue.length === 0) return;

    const reports = [...this.reportQueue];
    this.reportQueue = [];

    // 发送到分析服务
    this.sendToAnalytics(reports);
  }

  /**
   * 发送到分析服务
   */
  private async sendToAnalytics(reports: PerformanceEvent[]): Promise<void> {
    try {
      // 这里可以发送到你的分析服务
      // 例如：Google Analytics, 自定义分析服务等
      console.log('Performance reports:', reports);
      
      // 示例：发送到自定义分析端点
      // await fetch('/api/analytics/performance', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(reports)
      // });
    } catch (error) {
      console.error('Failed to send performance reports:', error);
    }
  }

  /**
   * 手动记录自定义指标
   */
  recordCustomMetric(name: string, value: number, unit: string = 'ms'): void {
    this.reportMetric(`custom_${name}`, value);
  }

  /**
   * 开始性能测量
   */
  startMeasure(name: string): void {
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${name}_start`);
    }
  }

  /**
   * 结束性能测量
   */
  endMeasure(name: string): number {
    if (window.performance && window.performance.mark && window.performance.measure) {
      window.performance.mark(`${name}_end`);
      window.performance.measure(name, `${name}_start`, `${name}_end`);
      
      const measures = window.performance.getEntriesByName(name, 'measure');
      if (measures.length > 0) {
        const duration = measures[measures.length - 1].duration;
        this.recordCustomMetric(name, duration);
        return duration;
      }
    }
    return 0;
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取性能评分
   */
  getPerformanceScore(): number {
    const { thresholds } = performanceMonitorConfig;
    let score = 100;
    let totalWeight = 0;

    // 根据各项指标计算评分
    const weights = {
      FCP: 0.15,
      LCP: 0.25,
      FID: 0.25,
      CLS: 0.25,
      TTFB: 0.1
    };

    Object.entries(weights).forEach(([metric, weight]) => {
      const value = this.metrics[metric as keyof PerformanceMetrics];
      const threshold = thresholds[metric as keyof typeof thresholds];
      
      if (value !== undefined && threshold) {
        totalWeight += weight;
        if (value > threshold) {
          // 超过阈值，扣分
          const penalty = Math.min(50, (value - threshold) / threshold * 50);
          score -= penalty * weight;
        }
      }
    });

    return Math.max(0, Math.round(score));
  }

  /**
   * 生成性能报告
   */
  generateReport(): {
    metrics: PerformanceMetrics;
    score: number;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const score = this.getPerformanceScore();
    const recommendations: string[] = [];

    // 生成优化建议
    if (metrics.FCP && metrics.FCP > 1800) {
      recommendations.push('优化首次内容绘制时间：减少关键资源大小，使用资源预加载');
    }
    
    if (metrics.LCP && metrics.LCP > 2500) {
      recommendations.push('优化最大内容绘制时间：优化图片加载，使用CDN加速');
    }
    
    if (metrics.FID && metrics.FID > 100) {
      recommendations.push('优化首次输入延迟：减少JavaScript执行时间，使用代码分割');
    }
    
    if (metrics.CLS && metrics.CLS > 0.1) {
      recommendations.push('优化累积布局偏移：为图片和广告设置尺寸，避免动态插入内容');
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > 0.8) {
      recommendations.push('优化内存使用：清理未使用的变量，避免内存泄漏');
    }

    return {
      metrics,
      score,
      recommendations
    };
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    // 断开所有观察器
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers = [];
    
    // 清除定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    
    // 发送最后的报告
    this.flushReports();
  }

  /**
   * 重置监控
   */
  reset(): void {
    this.stopMonitoring();
    this.metrics = {};
    this.reportQueue = [];
    this.startTime = Date.now();
    this.initializeMonitoring();
  }
}

/**
 * 性能监控Hook
 */
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();

  const startMeasure = (name: string) => {
    monitor.startMeasure(name);
  };

  const endMeasure = (name: string) => {
    return monitor.endMeasure(name);
  };

  const recordMetric = (name: string, value: number, unit?: string) => {
    monitor.recordCustomMetric(name, value, unit);
  };

  const getMetrics = () => {
    return monitor.getMetrics();
  };

  const getScore = () => {
    return monitor.getPerformanceScore();
  };

  const generateReport = () => {
    return monitor.generateReport();
  };

  return {
    startMeasure,
    endMeasure,
    recordMetric,
    getMetrics,
    getScore,
    generateReport
  };
};

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();

// 默认导出
export default PerformanceMonitor;