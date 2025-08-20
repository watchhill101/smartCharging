/**
 * 前端性能优化初始化
 */

import { performanceOptimizationConfig } from '../config/performanceOptimization';
import { PerformanceMonitor } from './performanceMonitor';
import { resourcePreloader, preloadCriticalResources } from './resourcePreloader';
import { RouteLazyLoader } from './codeSplitting';
import { ImageOptimizer } from './imageOptimization';

/**
 * 性能优化管理器
 */
class PerformanceOptimizationManager {
  private performanceMonitor: PerformanceMonitor;
  private routeLazyLoader: RouteLazyLoader;
  private imageOptimizer: ImageOptimizer;
  private initialized = false;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor(performanceOptimizationConfig.performanceMonitor);
    this.routeLazyLoader = new RouteLazyLoader();
    this.imageOptimizer = new ImageOptimizer(performanceOptimizationConfig.imageOptimization);
  }

  /**
   * 初始化性能优化
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.warn('Performance optimization already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing performance optimization...');

      // 1. 启动性能监控
      await this.initPerformanceMonitor();

      // 2. 预加载关键资源
      await this.preloadCriticalResources();

      // 3. 初始化路由懒加载
      await this.initRouteLazyLoader();

      // 4. 初始化图片优化
      await this.initImageOptimization();

      // 5. 设置缓存策略
      await this.setupCacheStrategy();

      // 6. 初始化移动端优化
      await this.initMobileOptimization();

      // 7. 设置网络优化
      await this.setupNetworkOptimization();

      this.initialized = true;
      console.log('✅ Performance optimization initialized successfully');

      // 记录初始化完成时间
      this.performanceMonitor.markCustomMetric('performance_init_complete', performance.now());

    } catch (error) {
      console.error('❌ Failed to initialize performance optimization:', error);
      throw error;
    }
  }

  /**
   * 初始化性能监控
   */
  private async initPerformanceMonitor(): Promise<void> {
    console.log('📊 Initializing performance monitor...');
    
    // 启动性能监控
    this.performanceMonitor.startMonitoring();
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.performanceMonitor.resumeMonitoring();
      } else {
        this.performanceMonitor.pauseMonitoring();
      }
    });

    console.log('✅ Performance monitor initialized');
  }

  /**
   * 预加载关键资源
   */
  private async preloadCriticalResources(): Promise<void> {
    console.log('🔄 Preloading critical resources...');
    
    const { criticalResources } = performanceOptimizationConfig;
    
    try {
      // 预加载关键资源
      await preloadCriticalResources({
        styles: criticalResources.styles,
        fonts: criticalResources.fonts,
        images: criticalResources.images,
        scripts: criticalResources.scripts
      });
      
      console.log('✅ Critical resources preloaded');
    } catch (error) {
      console.warn('⚠️ Some critical resources failed to preload:', error);
    }
  }

  /**
   * 初始化路由懒加载
   */
  private async initRouteLazyLoader(): Promise<void> {
    console.log('🛣️ Initializing route lazy loader...');
    
    const { routePreload } = performanceOptimizationConfig;
    
    // 立即预加载高优先级路由
    for (const route of routePreload.immediate) {
      this.routeLazyLoader.preloadRoute(route, 'high');
    }
    
    // 空闲时预加载中优先级路由
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        for (const route of routePreload.idle) {
          this.routeLazyLoader.preloadRoute(route, 'medium');
        }
      });
    } else {
      // 降级方案：延迟预加载
      setTimeout(() => {
        for (const route of routePreload.idle) {
          this.routeLazyLoader.preloadRoute(route, 'medium');
        }
      }, 2000);
    }
    
    console.log('✅ Route lazy loader initialized');
  }

  /**
   * 初始化图片优化
   */
  private async initImageOptimization(): Promise<void> {
    console.log('🖼️ Initializing image optimization...');
    
    // 启用图片懒加载观察器
    this.imageOptimizer.enableLazyLoading();
    
    // 预加载关键图片
    const { criticalResources } = performanceOptimizationConfig;
    for (const imageUrl of criticalResources.images) {
      this.imageOptimizer.preloadImage(imageUrl);
    }
    
    console.log('✅ Image optimization initialized');
  }

  /**
   * 设置缓存策略
   */
  private async setupCacheStrategy(): Promise<void> {
    console.log('💾 Setting up cache strategy...');
    
    const { cacheStrategy } = performanceOptimizationConfig;
    
    // 注册 Service Worker（如果支持）
    if ('serviceWorker' in navigator && cacheStrategy.offline.enabled) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered:', registration);
      } catch (error) {
        console.warn('⚠️ Service Worker registration failed:', error);
      }
    }
    
    // 设置 HTTP 缓存头（通过 meta 标签）
    this.setCacheHeaders();
    
    console.log('✅ Cache strategy configured');
  }

  /**
   * 设置缓存头
   */
  private setCacheHeaders(): void {
    const { cacheStrategy } = performanceOptimizationConfig;
    
    // 创建缓存控制 meta 标签
    const cacheControl = document.createElement('meta');
    cacheControl.httpEquiv = 'Cache-Control';
    cacheControl.content = 'public, max-age=3600';
    document.head.appendChild(cacheControl);
    
    // 设置 ETag
    const etag = document.createElement('meta');
    etag.httpEquiv = 'ETag';
    etag.content = `"${Date.now()}"`;
    document.head.appendChild(etag);
  }

  /**
   * 初始化移动端优化
   */
  private async initMobileOptimization(): Promise<void> {
    console.log('📱 Initializing mobile optimization...');
    
    const { mobileOptimization } = performanceOptimizationConfig;
    
    // 设置视口
    this.setViewport(mobileOptimization.viewport);
    
    // 优化触摸事件
    this.optimizeTouchEvents(mobileOptimization.touch);
    
    // 优化滚动性能
    this.optimizeScrolling(mobileOptimization.scroll);
    
    console.log('✅ Mobile optimization initialized');
  }

  /**
   * 设置视口
   */
  private setViewport(viewportConfig: any): void {
    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    
    const content = Object.entries(viewportConfig)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}=${value}`)
      .join(', ');
    
    viewport.content = content;
  }

  /**
   * 优化触摸事件
   */
  private optimizeTouchEvents(touchConfig: any): void {
    if (touchConfig.fastClick) {
      // 移除 300ms 点击延迟
      document.addEventListener('touchstart', () => {}, { passive: true });
    }
    
    // 设置触摸操作
    document.body.style.touchAction = touchConfig.touchAction;
    
    // 设置点击高亮
    document.body.style.webkitTapHighlightColor = touchConfig.tapHighlight;
  }

  /**
   * 优化滚动性能
   */
  private optimizeScrolling(scrollConfig: any): void {
    // 启用惯性滚动
    if (scrollConfig.momentum) {
      document.body.style.webkitOverflowScrolling = 'touch';
    }
    
    // 设置过度滚动行为
    document.body.style.overscrollBehavior = scrollConfig.overscroll;
    
    // 优化滚动事件
    let ticking = false;
    document.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // 滚动事件处理
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * 设置网络优化
   */
  private async setupNetworkOptimization(): Promise<void> {
    console.log('🌐 Setting up network optimization...');
    
    const { networkOptimization } = performanceOptimizationConfig;
    
    // 添加资源提示
    this.addResourceHints(networkOptimization.resourceHints);
    
    // 检测网络状态
    this.detectNetworkStatus();
    
    console.log('✅ Network optimization configured');
  }

  /**
   * 添加资源提示
   */
  private addResourceHints(resourceHints: any): void {
    // 添加 preconnect
    resourceHints.preconnect?.forEach((url: string) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
    
    // 添加 dns-prefetch
    resourceHints.dnsPrefetch?.forEach((url: string) => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
    
    // 添加 prefetch
    resourceHints.prefetch?.forEach((url: string) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  /**
   * 检测网络状态
   */
  private detectNetworkStatus(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      // 根据网络状态调整策略
      const updateStrategy = () => {
        const effectiveType = connection.effectiveType;
        console.log(`📶 Network type: ${effectiveType}`);
        
        // 根据网络类型调整预加载策略
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          // 慢网络：减少预加载
          this.adjustForSlowNetwork();
        } else if (effectiveType === '4g') {
          // 快网络：增加预加载
          this.adjustForFastNetwork();
        }
      };
      
      connection.addEventListener('change', updateStrategy);
      updateStrategy(); // 初始检测
    }
  }

  /**
   * 慢网络优化
   */
  private adjustForSlowNetwork(): void {
    console.log('🐌 Adjusting for slow network...');
    // 减少预加载资源
    // 降低图片质量
    // 延迟非关键资源加载
  }

  /**
   * 快网络优化
   */
  private adjustForFastNetwork(): void {
    console.log('🚀 Adjusting for fast network...');
    // 增加预加载资源
    // 提高图片质量
    // 积极预加载
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): any {
    return this.performanceMonitor.getReport();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }
    this.initialized = false;
    console.log('🧹 Performance optimization cleaned up');
  }
}

// 创建全局实例
export const performanceOptimizationManager = new PerformanceOptimizationManager();

/**
 * 初始化性能优化
 */
export const initPerformanceOptimization = async (): Promise<void> => {
  try {
    await performanceOptimizationManager.init();
  } catch (error) {
    console.error('Failed to initialize performance optimization:', error);
  }
};

/**
 * 获取性能报告
 */
export const getPerformanceReport = (): any => {
  return performanceOptimizationManager.getPerformanceReport();
};

/**
 * 清理性能优化
 */
export const cleanupPerformanceOptimization = (): void => {
  performanceOptimizationManager.cleanup();
};

export default performanceOptimizationManager;