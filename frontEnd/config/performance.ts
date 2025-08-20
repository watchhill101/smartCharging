import type { UserConfigExport } from "@tarojs/cli";

/**
 * 前端性能优化配置
 * 包含代码分割、资源优化、缓存策略等
 */
export const performanceConfig: UserConfigExport<'vite'> = {
  h5: {
    vite: {
      build: {
        // 代码分割配置
        rollupOptions: {
          output: {
            // 手动分包策略
            manualChunks: {
              // 第三方库分包
              'vendor-react': ['react', 'react-dom'],
              'vendor-taro': ['@tarojs/taro', '@tarojs/components', '@tarojs/runtime'],
              'vendor-nutui': ['@nutui/nutui-react-taro'],
              'vendor-utils': ['crypto-js', 'socket.io-client'],
              'vendor-icons': ['@fortawesome/fontawesome-svg-core', '@fortawesome/free-solid-svg-icons', '@fortawesome/react-fontawesome'],
              'vendor-ai': ['openai', 'assemblyai'],
              'vendor-map': ['@amap/amap-jsapi-loader', 'react-amap'],
              // 业务模块分包
              'pages-charging': [
                'src/pages/charging/index',
                'src/components/ChargingMonitor/index',
                'src/components/ChargingControl/index',
                'src/components/ChargingStatus/index'
              ],
              'pages-ai': [
                'src/pages/aiserver/index'
              ],
              'pages-map': [
                'src/pages/map/index',
                'src/components/StationList/index'
              ]
            },
            // 文件命名策略
            chunkFileNames: 'js/[name]-[hash].js',
            entryFileNames: 'js/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name?.split('.') || [];
              const ext = info[info.length - 1];
              if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
                return `images/[name]-[hash].${ext}`;
              }
              if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
                return `fonts/[name]-[hash].${ext}`;
              }
              if (/\.(css|scss|sass|less)$/i.test(assetInfo.name || '')) {
                return `css/[name]-[hash].${ext}`;
              }
              return `assets/[name]-[hash].${ext}`;
            }
          },
          // 外部依赖优化
          external: (id: string) => {
            // 保持高德地图等必要依赖内联
            if (id.includes('@amap/amap-jsapi-loader')) {
              return false;
            }
            return false;
          }
        },
        // 构建优化
        target: 'es2015',
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true, // 生产环境移除console
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug']
          },
          mangle: {
            safari10: true
          }
        },
        // 资源内联阈值
        assetsInlineLimit: 4096, // 4KB以下的资源内联
        // CSS代码分割
        cssCodeSplit: true,
        // 源码映射
        sourcemap: false, // 生产环境关闭sourcemap
        // 构建报告
        reportCompressedSize: false,
        // 分包大小警告阈值
        chunkSizeWarningLimit: 1000
      },
      // 依赖预构建优化
      optimizeDeps: {
        include: [
          '@amap/amap-jsapi-loader',
          'react',
          'react-dom',
          '@tarojs/taro',
          '@tarojs/components',
          '@nutui/nutui-react-taro',
          'crypto-js',
          'socket.io-client'
        ],
        exclude: [
          // 排除不需要预构建的包
        ]
      },
      // 服务器配置
      server: {
        // 预热常用文件
        warmup: {
          clientFiles: [
            './src/app.tsx',
            './src/pages/index/index.tsx',
            './src/pages/map/index.tsx',
            './src/components/StationList/index.tsx'
          ]
        }
      },
      // 实验性功能
      experimental: {
        // 渲染内置组件
        renderBuiltUrl: true
      }
    },
    // CSS提取配置
    miniCssExtractPluginOption: {
      ignoreOrder: true,
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].css'
    },
    // 路由配置
    router: {
      mode: 'hash',
      basename: '/'
    },
    // 静态资源配置
    staticDirectory: 'static',
    publicPath: '/',
    // 输出配置
    output: {
      dir: 'dist'
    }
  }
};

/**
 * 图片优化配置
 */
export const imageOptimizationConfig = {
  // 支持的图片格式
  supportedFormats: ['webp', 'avif', 'jpg', 'png', 'svg'],
  // 图片质量配置
  quality: {
    webp: 80,
    avif: 75,
    jpg: 85,
    png: 90
  },
  // 响应式图片尺寸
  responsiveSizes: [320, 640, 768, 1024, 1280, 1920],
  // 懒加载配置
  lazyLoading: {
    threshold: 100, // 提前100px开始加载
    rootMargin: '50px'
  }
};

/**
 * 缓存策略配置
 */
export const cacheConfig = {
  // 静态资源缓存
  staticAssets: {
    // 图片缓存1年
    images: 'max-age=31536000',
    // 字体缓存1年
    fonts: 'max-age=31536000',
    // CSS/JS缓存1年（有hash）
    scripts: 'max-age=31536000',
    // HTML不缓存
    html: 'no-cache'
  },
  // Service Worker缓存策略
  serviceWorker: {
    // 缓存策略
    strategies: {
      // 页面：网络优先
      pages: 'NetworkFirst',
      // 静态资源：缓存优先
      assets: 'CacheFirst',
      // API：网络优先，缓存备用
      api: 'NetworkFirst'
    },
    // 缓存时间
    maxAge: {
      pages: 24 * 60 * 60, // 1天
      assets: 30 * 24 * 60 * 60, // 30天
      api: 5 * 60 // 5分钟
    }
  }
};

/**
 * 性能监控配置
 */
export const performanceMonitorConfig = {
  // Web Vitals阈值
  thresholds: {
    FCP: 1800, // First Contentful Paint
    LCP: 2500, // Largest Contentful Paint
    FID: 100,  // First Input Delay
    CLS: 0.1,  // Cumulative Layout Shift
    TTFB: 800  // Time to First Byte
  },
  // 性能预算
  budgets: {
    // 总包大小限制
    totalSize: 2048, // 2MB
    // 单个包大小限制
    chunkSize: 512,  // 512KB
    // 图片大小限制
    imageSize: 200,  // 200KB
    // 字体大小限制
    fontSize: 100    // 100KB
  }
};

export default performanceConfig;