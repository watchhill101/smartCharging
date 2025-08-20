/**
 * 资源预加载和缓存管理工具
 */

/**
 * 资源类型枚举
 */
export enum ResourceType {
  IMAGE = 'image',
  SCRIPT = 'script',
  STYLE = 'style',
  FONT = 'font',
  AUDIO = 'audio',
  VIDEO = 'video',
  FETCH = 'fetch'
}

/**
 * 预加载优先级
 */
export enum PreloadPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * 资源配置接口
 */
interface ResourceConfig {
  url: string;
  type: ResourceType;
  priority?: PreloadPriority;
  crossOrigin?: 'anonymous' | 'use-credentials';
  integrity?: string;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

/**
 * 缓存策略枚举
 */
export enum CacheStrategy {
  CACHE_FIRST = 'cache-first',
  NETWORK_FIRST = 'network-first',
  CACHE_ONLY = 'cache-only',
  NETWORK_ONLY = 'network-only',
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate'
}

/**
 * 缓存配置接口
 */
interface CacheConfig {
  strategy: CacheStrategy;
  maxAge?: number; // 毫秒
  maxSize?: number; // 字节
  version?: string;
}

/**
 * 预加载状态
 */
interface PreloadStatus {
  url: string;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  progress: number;
  error?: Error;
  startTime: number;
  endTime?: number;
}

/**
 * 资源预加载器类
 */
class ResourcePreloader {
  private cache: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private preloadStatus: Map<string, PreloadStatus> = new Map();
  private cacheConfig: Map<string, CacheConfig> = new Map();
  private maxConcurrentLoads = 6;
  private currentLoads = 0;
  private loadQueue: (() => Promise<void>)[] = [];

  /**
   * 预加载单个资源
   */
  async preload(config: ResourceConfig): Promise<any> {
    const { url, type, priority = PreloadPriority.MEDIUM } = config;
    
    // 检查缓存
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    // 创建预加载状态
    this.preloadStatus.set(url, {
      url,
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    });

    // 创建加载Promise
    const loadPromise = this.createLoadPromise(config);
    this.loadingPromises.set(url, loadPromise);

    try {
      const result = await loadPromise;
      this.cache.set(url, result);
      this.updateStatus(url, 'loaded', 100);
      return result;
    } catch (error) {
      this.updateStatus(url, 'error', 0, error as Error);
      throw error;
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  /**
   * 批量预加载资源
   */
  async preloadBatch(configs: ResourceConfig[]): Promise<(any | Error)[]> {
    // 按优先级排序
    const sortedConfigs = configs.sort((a, b) => {
      const priorityOrder = {
        [PreloadPriority.HIGH]: 3,
        [PreloadPriority.MEDIUM]: 2,
        [PreloadPriority.LOW]: 1
      };
      return priorityOrder[b.priority || PreloadPriority.MEDIUM] - 
             priorityOrder[a.priority || PreloadPriority.MEDIUM];
    });

    const promises = sortedConfigs.map(config => 
      this.preload(config).catch(error => error)
    );

    return Promise.all(promises);
  }

  /**
   * 创建加载Promise
   */
  private async createLoadPromise(config: ResourceConfig): Promise<any> {
    const { url, type, timeout = 10000, retryCount = 3, retryDelay = 1000 } = config;

    const loadWithRetry = async (attempt = 1): Promise<any> => {
      try {
        this.updateStatus(url, 'loading', 0);
        
        switch (type) {
          case ResourceType.IMAGE:
            return await this.loadImage(config);
          case ResourceType.SCRIPT:
            return await this.loadScript(config);
          case ResourceType.STYLE:
            return await this.loadStyle(config);
          case ResourceType.FONT:
            return await this.loadFont(config);
          case ResourceType.AUDIO:
          case ResourceType.VIDEO:
            return await this.loadMedia(config);
          case ResourceType.FETCH:
            return await this.loadFetch(config);
          default:
            throw new Error(`Unsupported resource type: ${type}`);
        }
      } catch (error) {
        if (attempt < retryCount) {
          console.warn(`Resource load failed (attempt ${attempt}/${retryCount}): ${url}`, error);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          return loadWithRetry(attempt + 1);
        }
        throw error;
      }
    };

    // 添加超时控制
    return Promise.race([
      loadWithRetry(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout loading: ${url}`)), timeout)
      )
    ]);
  }

  /**
   * 加载图片
   */
  private loadImage(config: ResourceConfig): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      if (config.crossOrigin) {
        img.crossOrigin = config.crossOrigin;
      }

      img.onload = () => {
        config.onLoad?.();
        resolve(img);
      };
      
      img.onerror = () => {
        const error = new Error(`Failed to load image: ${config.url}`);
        config.onError?.(error);
        reject(error);
      };
      
      img.src = config.url;
    });
  }

  /**
   * 加载脚本
   */
  private loadScript(config: ResourceConfig): Promise<HTMLScriptElement> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = config.url;
      script.async = true;
      
      if (config.crossOrigin) {
        script.crossOrigin = config.crossOrigin;
      }
      
      if (config.integrity) {
        script.integrity = config.integrity;
      }

      script.onload = () => {
        config.onLoad?.();
        resolve(script);
      };
      
      script.onerror = () => {
        const error = new Error(`Failed to load script: ${config.url}`);
        config.onError?.(error);
        reject(error);
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * 加载样式
   */
  private loadStyle(config: ResourceConfig): Promise<HTMLLinkElement> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = config.url;
      
      if (config.crossOrigin) {
        link.crossOrigin = config.crossOrigin;
      }
      
      if (config.integrity) {
        link.integrity = config.integrity;
      }

      link.onload = () => {
        config.onLoad?.();
        resolve(link);
      };
      
      link.onerror = () => {
        const error = new Error(`Failed to load stylesheet: ${config.url}`);
        config.onError?.(error);
        reject(error);
      };
      
      document.head.appendChild(link);
    });
  }

  /**
   * 加载字体
   */
  private async loadFont(config: ResourceConfig): Promise<FontFace> {
    if (!('FontFace' in window)) {
      throw new Error('FontFace API not supported');
    }

    const fontName = config.url.split('/').pop()?.split('.')[0] || 'CustomFont';
    const fontFace = new FontFace(fontName, `url(${config.url})`);
    
    try {
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);
      config.onLoad?.();
      return loadedFont;
    } catch (error) {
      const fontError = new Error(`Failed to load font: ${config.url}`);
      config.onError?.(fontError);
      throw fontError;
    }
  }

  /**
   * 加载媒体文件
   */
  private loadMedia(config: ResourceConfig): Promise<HTMLMediaElement> {
    return new Promise((resolve, reject) => {
      const media = config.type === ResourceType.AUDIO 
        ? new Audio() 
        : document.createElement('video');
      
      if (config.crossOrigin) {
        media.crossOrigin = config.crossOrigin;
      }

      media.oncanplaythrough = () => {
        config.onLoad?.();
        resolve(media);
      };
      
      media.onerror = () => {
        const error = new Error(`Failed to load media: ${config.url}`);
        config.onError?.(error);
        reject(error);
      };
      
      media.onprogress = () => {
        if (media.buffered.length > 0) {
          const progress = (media.buffered.end(0) / media.duration) * 100;
          config.onProgress?.(progress);
          this.updateStatus(config.url, 'loading', progress);
        }
      };
      
      media.src = config.url;
      media.load();
    });
  }

  /**
   * 加载数据
   */
  private async loadFetch(config: ResourceConfig): Promise<Response> {
    const response = await fetch(config.url, {
      mode: config.crossOrigin ? 'cors' : 'same-origin'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    config.onLoad?.();
    return response;
  }

  /**
   * 更新预加载状态
   */
  private updateStatus(
    url: string, 
    status: PreloadStatus['status'], 
    progress: number, 
    error?: Error
  ): void {
    const currentStatus = this.preloadStatus.get(url);
    if (currentStatus) {
      currentStatus.status = status;
      currentStatus.progress = progress;
      currentStatus.error = error;
      
      if (status === 'loaded' || status === 'error') {
        currentStatus.endTime = Date.now();
      }
    }
  }

  /**
   * 获取预加载状态
   */
  getStatus(url: string): PreloadStatus | undefined {
    return this.preloadStatus.get(url);
  }

  /**
   * 获取所有预加载状态
   */
  getAllStatus(): PreloadStatus[] {
    return Array.from(this.preloadStatus.values());
  }

  /**
   * 清理缓存
   */
  clearCache(url?: string): void {
    if (url) {
      this.cache.delete(url);
      this.preloadStatus.delete(url);
    } else {
      this.cache.clear();
      this.preloadStatus.clear();
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * 设置缓存策略
   */
  setCacheConfig(url: string, config: CacheConfig): void {
    this.cacheConfig.set(url, config);
  }

  /**
   * 检查资源是否已缓存
   */
  isCached(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * 获取缓存的资源
   */
  getCached(url: string): any {
    return this.cache.get(url);
  }
}

/**
 * 全局资源预加载器实例
 */
export const resourcePreloader = new ResourcePreloader();

/**
 * 预加载关键资源
 */
export const preloadCriticalResources = async (resources: ResourceConfig[]): Promise<void> => {
  const criticalResources = resources.filter(r => r.priority === PreloadPriority.HIGH);
  await resourcePreloader.preloadBatch(criticalResources);
};

/**
 * 智能预加载Hook
 */
export const useResourcePreloader = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<Error | null>(null);

  const preload = async (configs: ResourceConfig | ResourceConfig[]) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const configArray = Array.isArray(configs) ? configs : [configs];
      
      // 添加进度回调
      const configsWithProgress = configArray.map(config => ({
        ...config,
        onProgress: (p: number) => {
          config.onProgress?.(p);
          // 计算总体进度
          const totalProgress = configArray.reduce((sum, c) => {
            const status = resourcePreloader.getStatus(c.url);
            return sum + (status?.progress || 0);
          }, 0) / configArray.length;
          setProgress(totalProgress);
        }
      }));

      await resourcePreloader.preloadBatch(configsWithProgress);
      setProgress(100);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    preload,
    isLoading,
    progress,
    error,
    clearCache: resourcePreloader.clearCache.bind(resourcePreloader),
    getStatus: resourcePreloader.getStatus.bind(resourcePreloader)
  };
};

/**
 * 预加载图片工具函数
 */
export const preloadImages = (urls: string[]): Promise<HTMLImageElement[]> => {
  const configs: ResourceConfig[] = urls.map(url => ({
    url,
    type: ResourceType.IMAGE,
    priority: PreloadPriority.MEDIUM
  }));
  
  return resourcePreloader.preloadBatch(configs) as Promise<HTMLImageElement[]>;
};

/**
 * 预加载字体工具函数
 */
export const preloadFonts = (urls: string[]): Promise<FontFace[]> => {
  const configs: ResourceConfig[] = urls.map(url => ({
    url,
    type: ResourceType.FONT,
    priority: PreloadPriority.HIGH
  }));
  
  return resourcePreloader.preloadBatch(configs) as Promise<FontFace[]>;
};

export default resourcePreloader;

// React import for hooks
import React from 'react';