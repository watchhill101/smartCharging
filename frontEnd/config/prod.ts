import type { UserConfigExport } from "@tarojs/cli"

export default {
  mini: {},
  h5: {
    // 暂时禁用 legacy 模式以避免 Babel 兼容性问题
    legacy: false,
    vite: {
      build: {
        rollupOptions: {
          // 不要将 @amap/amap-jsapi-loader 作为外部依赖
          external: (id: string) => {
            // 排除 @amap/amap-jsapi-loader，确保它被打包进来
            if (id.includes('@amap/amap-jsapi-loader')) {
              return false
            }
            // 其他外部依赖的默认处理
            return false
          }
        }
      },
      optimizeDeps: {
        // 预构建 @amap/amap-jsapi-loader
        include: ['@amap/amap-jsapi-loader']
      }
    },
    /**
     * WebpackChain 插件配置
     * @docs https://github.com/neutrinojs/webpack-chain
     */
    // webpackChain (chain) {
    //   /**
    //    * 如果 h5 端编译后体积过大，可以使用 webpack-bundle-analyzer 插件对打包体积进行分析。
    //    * @docs https://github.com/webpack-contrib/webpack-bundle-analyzer
    //    */
    //   chain.plugin('analyzer')
    //     .use(require('webpack-bundle-analyzer').BundleAnalyzerPlugin, [])
    //   /**
    //    * 如果 h5 端首屏加载时间过长，可以使用 prerender-spa-plugin 插件预加载首页。
    //    * @docs https://github.com/chrisvfritz/prerender-spa-plugin
    //    */
    //   const path = require('path')
    //   const Prerender = require('prerender-spa-plugin')
    //   const staticDir = path.join(__dirname, '..', 'dist')
    //   chain
    //     .plugin('prerender')
    //     .use(new Prerender({
    //       staticDir,
    //       routes: [ '/pages/index/index' ],
    //       postProcess: (context) => ({ ...context, outputPath: path.join(staticDir, 'index.html') })
    //     }))
    // }
  }
} satisfies UserConfigExport<'vite'>
