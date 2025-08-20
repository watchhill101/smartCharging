import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { View } from '@tarojs/components';
import { useLazyImage } from '../../utils/imageOptimization';
import './index.scss';

/**
 * 懒加载组件属性接口
 */
interface LazyLoadProps {
  children: ReactNode;
  className?: string;
  placeholder?: ReactNode;
  errorFallback?: ReactNode;
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 懒加载图片组件属性接口
 */
interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  placeholder?: ReactNode;
  errorFallback?: ReactNode;
  width?: number | string;
  height?: number | string;
  responsive?: boolean;
  webpSupport?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * 通用懒加载组件
 */
export const LazyLoad: React.FC<LazyLoadProps> = ({
  children,
  className = '',
  placeholder,
  errorFallback,
  threshold = 0.1,
  rootMargin = '50px',
  triggerOnce = true,
  onLoad,
  onError
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // 检查是否支持IntersectionObserver
    if (!window.IntersectionObserver) {
      setIsVisible(true);
      return;
    }

    // 创建观察器
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            
            if (triggerOnce && observerRef.current) {
              observerRef.current.unobserve(element);
            }
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  useEffect(() => {
    if (isVisible && !isLoaded) {
      try {
        setIsLoaded(true);
        onLoad?.();
      } catch (error) {
        setHasError(true);
        onError?.(error as Error);
      }
    }
  }, [isVisible, isLoaded, onLoad, onError]);

  const renderContent = () => {
    if (hasError && errorFallback) {
      return errorFallback;
    }

    if (!isVisible) {
      return placeholder || <View className="lazy-placeholder" />;
    }

    return children;
  };

  return (
    <View 
      ref={elementRef} 
      className={`lazy-load ${className} ${isVisible ? 'lazy-loaded' : 'lazy-loading'} ${hasError ? 'lazy-error' : ''}`}
    >
      {renderContent()}
    </View>
  );
};

/**
 * 懒加载图片组件
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  className = '',
  placeholder,
  errorFallback,
  width,
  height,
  responsive = true,
  webpSupport = true,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const { getResponsiveImageUrl, getWebPImageUrl } = useLazyImage();

  // 处理图片URL优化
  const getOptimizedImageUrl = (originalSrc: string): string => {
    let optimizedSrc = originalSrc;

    // WebP支持
    if (webpSupport) {
      optimizedSrc = getWebPImageUrl(optimizedSrc);
    }

    // 响应式图片
    if (responsive && width) {
      const targetWidth = typeof width === 'string' ? parseInt(width) : width;
      optimizedSrc = getResponsiveImageUrl(optimizedSrc, targetWidth);
    }

    return optimizedSrc;
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleImageError = (error: Event) => {
    setHasError(true);
    onError?.(new Error('Image load failed'));
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <View className="lazy-image-placeholder">
        <View className="placeholder-content">
          <View className="placeholder-icon">📷</View>
          <View className="placeholder-text">加载中...</View>
        </View>
      </View>
    );
  };

  const renderErrorFallback = () => {
    if (errorFallback) {
      return errorFallback;
    }

    return (
      <View className="lazy-image-error">
        <View className="error-content">
          <View className="error-icon">❌</View>
          <View className="error-text">图片加载失败</View>
        </View>
      </View>
    );
  };

  return (
    <LazyLoad
      className={`lazy-image-container ${className}`}
      placeholder={renderPlaceholder()}
      errorFallback={renderErrorFallback()}
      onLoad={() => {
        const optimizedSrc = getOptimizedImageUrl(src);
        setImageSrc(optimizedSrc);
      }}
      onError={onError}
    >
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`lazy-image ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy" // 原生懒加载支持
        />
      )}
    </LazyLoad>
  );
};

/**
 * 懒加载组件工厂
 */
export const createLazyComponent = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const LazyComponent: React.FC<P> = (props) => {
    return (
      <LazyLoad
        placeholder={fallback || <View className="component-loading">组件加载中...</View>}
        errorFallback={<View className="component-error">组件加载失败</View>}
      >
        <Component {...props} />
      </LazyLoad>
    );
  };

  LazyComponent.displayName = `Lazy(${Component.displayName || Component.name})`;
  return LazyComponent;
};

/**
 * 懒加载列表组件
 */
interface LazyListProps {
  items: any[];
  renderItem: (item: any, index: number) => ReactNode;
  className?: string;
  itemHeight?: number;
  bufferSize?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

export const LazyList: React.FC<LazyListProps> = ({
  items,
  renderItem,
  className = '',
  itemHeight = 100,
  bufferSize = 5,
  onEndReached,
  onEndReachedThreshold = 0.8
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: bufferSize });
  const [isEndReached, setIsEndReached] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, clientHeight, scrollHeight } = containerRef.current;
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + Math.ceil(clientHeight / itemHeight) + bufferSize
    );

    setVisibleRange({ start: Math.max(0, startIndex - bufferSize), end: endIndex });

    // 检查是否到达底部
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    if (scrollPercentage >= onEndReachedThreshold && !isEndReached) {
      setIsEndReached(true);
      onEndReached?.();
      
      // 重置状态，允许再次触发
      setTimeout(() => setIsEndReached(false), 1000);
    }
  };

  const throttledHandleScroll = () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(handleScroll, 16); // ~60fps
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', throttledHandleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const renderVisibleItems = () => {
    const visibleItems = [];
    
    for (let i = visibleRange.start; i <= visibleRange.end && i < items.length; i++) {
      visibleItems.push(
        <View 
          key={i} 
          className="lazy-list-item"
          style={{ 
            height: `${itemHeight}px`,
            transform: `translateY(${i * itemHeight}px)`,
            position: 'absolute',
            width: '100%'
          }}
        >
          {renderItem(items[i], i)}
        </View>
      );
    }
    
    return visibleItems;
  };

  return (
    <View 
      ref={containerRef}
      className={`lazy-list ${className}`}
      style={{ 
        height: '100%',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <View 
        className="lazy-list-content"
        style={{ 
          height: `${items.length * itemHeight}px`,
          position: 'relative'
        }}
      >
        {renderVisibleItems()}
      </View>
    </View>
  );
};

export default LazyLoad;