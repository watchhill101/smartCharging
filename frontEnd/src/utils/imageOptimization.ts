import Taro from '@tarojs/taro';
import { imageOptimizationConfig } from '../../config/performance';

/**
 * 图片优化工具类
 * 提供图片懒加载、响应式图片、格式优化等功能
 */
export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private intersectionObserver: IntersectionObserver | null = null;
  private loadedImages = new Set<string>();
  private loadingImages = new Map<string, Promise<void>>();

  private constructor() {
    this.initIntersectionObserver();
  }

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  /**
   * 初始化Intersection Observer用于懒加载
   */
  private initIntersectionObserver() {
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      return;
    }

    const { threshold, rootMargin } = imageOptimizationConfig.lazyLoading;
    
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !this.loadedImages.has(src)) {
              this.loadImage(img, src);
            }
          }
        });
      },
      {
        rootMargin,
        threshold: 0.1
      }
    );
  }

  /**
   * 加载图片
   */
  private async loadImage(img: HTMLImageElement, src: string): Promise<void> {
    if (this.loadingImages.has(src)) {
      return this.loadingImages.get(src)!;
    }

    const loadPromise = new Promise<void>((resolve, reject) => {
      const tempImg = new Image();
      
      tempImg.onload = () => {
        img.src = src;
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-loaded');
        this.loadedImages.add(src);
        this.intersectionObserver?.unobserve(img);
        resolve();
      };
      
      tempImg.onerror = () => {
        img.classList.remove('lazy-loading');
        img.classList.add('lazy-error');
        // 设置默认错误图片
        img.src = this.getDefaultErrorImage();
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      tempImg.src = src;
    });

    this.loadingImages.set(src, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.loadingImages.delete(src);
    }
  }

  /**
   * 获取默认错误图片
   */
  private getDefaultErrorImage(): string {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEzMEg3MEwxMDAgNzBaIiBmaWxsPSIjQ0NDIi8+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIHN0cm9rZT0iI0NDQyIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+Cjwvc3ZnPg==';
  }

  /**
   * 注册懒加载图片
   */
  observeImage(img: HTMLImageElement): void {
    if (!this.intersectionObserver) {
      // 如果不支持IntersectionObserver，直接加载
      const src = img.dataset.src;
      if (src) {
        img.src = src;
      }
      return;
    }

    img.classList.add('lazy-loading');
    this.intersectionObserver.observe(img);
  }

  /**
   * 取消观察图片
   */
  unobserveImage(img: HTMLImageElement): void {
    this.intersectionObserver?.unobserve(img);
  }

  /**
   * 获取响应式图片URL
   */
  getResponsiveImageUrl(baseUrl: string, width: number): string {
    const { responsiveSizes } = imageOptimizationConfig;
    
    // 找到最接近的尺寸
    const targetSize = responsiveSizes.reduce((prev, curr) => {
      return Math.abs(curr - width) < Math.abs(prev - width) ? curr : prev;
    });

    // 如果是外部URL，直接返回
    if (baseUrl.startsWith('http')) {
      return baseUrl;
    }

    // 构建响应式图片URL
    const ext = baseUrl.split('.').pop();
    const baseName = baseUrl.replace(`.${ext}`, '');
    
    return `${baseName}_${targetSize}w.${ext}`;
  }

  /**
   * 获取WebP格式图片URL（如果支持）
   */
  getWebPImageUrl(originalUrl: string): string {
    if (!this.supportsWebP()) {
      return originalUrl;
    }

    // 如果是外部URL，直接返回
    if (originalUrl.startsWith('http')) {
      return originalUrl;
    }

    const ext = originalUrl.split('.').pop();
    if (ext && ['jpg', 'jpeg', 'png'].includes(ext.toLowerCase())) {
      return originalUrl.replace(`.${ext}`, '.webp');
    }

    return originalUrl;
  }

  /**
   * 检查浏览器是否支持WebP
   */
  private supportsWebP(): boolean {
    if (typeof window === 'undefined') return false;
    
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * 预加载关键图片
   */
  preloadImages(urls: string[]): Promise<void[]> {
    const promises = urls.map(url => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to preload: ${url}`));
        img.src = url;
      });
    });

    return Promise.all(promises);
  }

  /**
   * 获取图片尺寸
   */
  getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * 压缩图片
   */
  compressImage(
    file: File,
    quality: number = 0.8,
    maxWidth: number = 1920,
    maxHeight: number = 1080
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // 计算新尺寸
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // 绘制图片
        ctx?.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.loadedImages.clear();
    this.loadingImages.clear();
  }
}

/**
 * 懒加载图片组件Hook
 */
export const useLazyImage = () => {
  const optimizer = ImageOptimizer.getInstance();

  const registerLazyImage = (ref: React.RefObject<HTMLImageElement>) => {
    if (ref.current) {
      optimizer.observeImage(ref.current);
    }
  };

  const unregisterLazyImage = (ref: React.RefObject<HTMLImageElement>) => {
    if (ref.current) {
      optimizer.unobserveImage(ref.current);
    }
  };

  return {
    registerLazyImage,
    unregisterLazyImage,
    getResponsiveImageUrl: optimizer.getResponsiveImageUrl.bind(optimizer),
    getWebPImageUrl: optimizer.getWebPImageUrl.bind(optimizer)
  };
};

// 导出单例实例
export const imageOptimizer = ImageOptimizer.getInstance();

// 默认导出
export default ImageOptimizer;