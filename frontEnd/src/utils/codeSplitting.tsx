import React, { ComponentType, LazyExoticComponent, Suspense } from 'react';
import { View } from '@tarojs/components';

/**
 * 动态导入配置接口
 */
interface DynamicImportOptions {
  fallback?: React.ComponentType;
  errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
  retryCount?: number;
  retryDelay?: number;
  preload?: boolean;
  chunkName?: string;
}

/**
 * 路由懒加载配置接口
 */
interface RouteConfig {
  path: string;
  component: () => Promise<{ default: ComponentType<any> }>;
  preload?: boolean;
  chunkName?: string;
}

/**
 * 默认加载组件
 */
const DefaultFallback: React.FC = () => (
  <View className="loading-container">
    <View className="loading-spinner" />
    <View className="loading-text">页面加载中...</View>
  </View>
);

/**
 * 默认错误边界组件
 */
const DefaultErrorBoundary: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <View className="error-container">
    <View className="error-icon">⚠️</View>
    <View className="error-title">页面加载失败</View>
    <View className="error-message">{error.message}</View>
    <View className="error-actions">
      <button className="retry-button" onClick={retry}>
        重试
      </button>
    </View>
  </View>
);

/**
 * 创建动态导入组件
 */
export const createDynamicImport = <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: DynamicImportOptions = {}
): LazyExoticComponent<ComponentType<P>> => {
  const {
    fallback = DefaultFallback,
    errorBoundary = DefaultErrorBoundary,
    retryCount = 3,
    retryDelay = 1000,
    preload = false,
    chunkName
  } = options;

  // 创建带重试机制的导入函数
  const importWithRetry = async (attempt = 1): Promise<{ default: ComponentType<P> }> => {
    try {
      return await importFn();
    } catch (error) {
      if (attempt < retryCount) {
        console.warn(`Dynamic import failed (attempt ${attempt}/${retryCount}), retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        return importWithRetry(attempt + 1);
      }
      throw error;
    }
  };

  // 创建懒加载组件
  const LazyComponent = React.lazy(importWithRetry);

  // 预加载功能
  if (preload) {
    // 在空闲时间预加载
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        importWithRetry().catch(console.error);
      });
    } else {
      // 降级到setTimeout
      setTimeout(() => {
        importWithRetry().catch(console.error);
      }, 100);
    }
  }

  // 返回包装后的组件
  const WrappedComponent: React.FC<P> = (props) => {
    const [error, setError] = React.useState<Error | null>(null);
    const [retryKey, setRetryKey] = React.useState(0);

    const handleRetry = () => {
      setError(null);
      setRetryKey(prev => prev + 1);
    };

    if (error) {
      const ErrorComponent = errorBoundary;
      return <ErrorComponent error={error} retry={handleRetry} />;
    }

    return (
      <React.ErrorBoundary
        fallback={({ error, resetErrorBoundary }) => {
          const ErrorComponent = errorBoundary;
          return <ErrorComponent error={error} retry={resetErrorBoundary} />;
        }}
        onError={setError}
        resetKeys={[retryKey]}
      >
        <Suspense fallback={React.createElement(fallback)}>
          <LazyComponent key={retryKey} {...props} />
        </Suspense>
      </React.ErrorBoundary>
    );
  };

  // 设置显示名称
  WrappedComponent.displayName = `DynamicImport(${chunkName || 'Unknown'})`;

  return WrappedComponent as LazyExoticComponent<ComponentType<P>>;
};

/**
 * 路由懒加载管理器
 */
class RouteLazyLoader {
  private routes: Map<string, RouteConfig> = new Map();
  private preloadedRoutes: Set<string> = new Set();
  private loadingRoutes: Set<string> = new Set();

  /**
   * 注册路由
   */
  register(config: RouteConfig): void {
    this.routes.set(config.path, config);
    
    if (config.preload) {
      this.preloadRoute(config.path);
    }
  }

  /**
   * 批量注册路由
   */
  registerRoutes(configs: RouteConfig[]): void {
    configs.forEach(config => this.register(config));
  }

  /**
   * 获取路由组件
   */
  getRouteComponent(path: string): LazyExoticComponent<ComponentType<any>> | null {
    const config = this.routes.get(path);
    if (!config) {
      console.warn(`Route not found: ${path}`);
      return null;
    }

    return createDynamicImport(config.component, {
      chunkName: config.chunkName || path.replace(/\//g, '-'),
      preload: config.preload
    });
  }

  /**
   * 预加载路由
   */
  async preloadRoute(path: string): Promise<void> {
    if (this.preloadedRoutes.has(path) || this.loadingRoutes.has(path)) {
      return;
    }

    const config = this.routes.get(path);
    if (!config) {
      console.warn(`Route not found for preload: ${path}`);
      return;
    }

    this.loadingRoutes.add(path);

    try {
      await config.component();
      this.preloadedRoutes.add(path);
      console.log(`Route preloaded: ${path}`);
    } catch (error) {
      console.error(`Failed to preload route: ${path}`, error);
    } finally {
      this.loadingRoutes.delete(path);
    }
  }

  /**
   * 批量预加载路由
   */
  async preloadRoutes(paths: string[]): Promise<void> {
    const promises = paths.map(path => this.preloadRoute(path));
    await Promise.allSettled(promises);
  }

  /**
   * 预加载相关路由（基于当前路由）
   */
  async preloadRelatedRoutes(currentPath: string): Promise<void> {
    // 预加载策略：预加载同级路由和子路由
    const relatedPaths = Array.from(this.routes.keys()).filter(path => {
      // 同级路由（相同深度）
      const currentDepth = currentPath.split('/').length;
      const pathDepth = path.split('/').length;
      
      if (pathDepth === currentDepth) {
        return true;
      }
      
      // 子路由（深度+1）
      if (pathDepth === currentDepth + 1 && path.startsWith(currentPath)) {
        return true;
      }
      
      return false;
    });

    await this.preloadRoutes(relatedPaths);
  }

  /**
   * 获取预加载状态
   */
  getPreloadStatus(): {
    total: number;
    preloaded: number;
    loading: number;
    pending: number;
  } {
    const total = this.routes.size;
    const preloaded = this.preloadedRoutes.size;
    const loading = this.loadingRoutes.size;
    const pending = total - preloaded - loading;

    return { total, preloaded, loading, pending };
  }

  /**
   * 清理预加载缓存
   */
  clearPreloadCache(): void {
    this.preloadedRoutes.clear();
    this.loadingRoutes.clear();
  }
}

/**
 * 全局路由懒加载管理器实例
 */
export const routeLazyLoader = new RouteLazyLoader();
export { RouteLazyLoader };

/**
 * 组件懒加载工厂
 */
export const createLazyComponent = <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  displayName?: string
) => {
  const LazyComponent = createDynamicImport(importFn, {
    chunkName: displayName
  });
  
  if (displayName) {
    LazyComponent.displayName = displayName;
  }
  
  return LazyComponent;
};

/**
 * 预加载组件
 */
export const preloadComponent = async <P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
): Promise<ComponentType<P>> => {
  try {
    const module = await importFn();
    return module.default;
  } catch (error) {
    console.error('Failed to preload component:', error);
    throw error;
  }
};

/**
 * 智能预加载Hook
 */
export const useSmartPreload = () => {
  const [isIdle, setIsIdle] = React.useState(false);
  const [networkSpeed, setNetworkSpeed] = React.useState<'slow' | 'fast' | 'unknown'>('unknown');

  React.useEffect(() => {
    // 检测网络速度
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const effectiveType = connection?.effectiveType;
      
      if (effectiveType === '4g' || effectiveType === '3g') {
        setNetworkSpeed('fast');
      } else {
        setNetworkSpeed('slow');
      }
    }

    // 检测空闲状态
    if ('requestIdleCallback' in window) {
      const idleCallback = window.requestIdleCallback(() => {
        setIsIdle(true);
      });
      
      return () => window.cancelIdleCallback(idleCallback);
    } else {
      const timeout = setTimeout(() => setIsIdle(true), 1000);
      return () => clearTimeout(timeout);
    }
  }, []);

  const shouldPreload = React.useMemo(() => {
    return isIdle && networkSpeed !== 'slow';
  }, [isIdle, networkSpeed]);

  return {
    shouldPreload,
    isIdle,
    networkSpeed,
    preloadComponent: shouldPreload ? preloadComponent : () => Promise.resolve(null)
  };
};

/**
 * 代码分割统计
 */
export const getCodeSplittingStats = () => {
  const stats = {
    totalChunks: 0,
    loadedChunks: 0,
    failedChunks: 0,
    preloadedChunks: 0
  };

  // 这里可以集成实际的统计逻辑
  // 例如从webpack的运行时信息中获取
  
  return stats;
};

export default {
  createDynamicImport,
  createLazyComponent,
  routeLazyLoader,
  preloadComponent,
  useSmartPreload,
  getCodeSplittingStats
};