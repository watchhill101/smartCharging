import Taro from "@tarojs/taro";
import { API_CONFIG, STORAGE_KEYS, ERROR_CODES, TIME_CONSTANTS } from "./constants";
import { tokenManager } from "./tokenManager";

// 环境检测
const isH5 = process.env.TARO_ENV === 'h5';
const isBrowser = typeof window !== 'undefined';

// 显示提示信息的工具函数

// 安全的存储工具函数
const getStorageSync = (key: string) => {
  try {
    if (isH5 || isBrowser) {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }
    if (typeof Taro.getStorageSync === 'function') {
      return Taro.getStorageSync(key);
    }
    return null;
  } catch (error) {
    console.error("获取存储失败:", error);
    return null;
  }
};

// 设置存储的工具函数 (暂未使用)
// const setStorageSync = (key: string, value: any) => {
//   try {
//     taroSetStorageSync(key, value)
//   } catch (error) {
//     console.error('设置存储失败:', error)
//   }
// }

// 安全的移除存储工具函数
const removeStorageSync = (key: string) => {
  try {
    if (isH5 || isBrowser) {
      localStorage.removeItem(key);
      return;
    }
    if (typeof Taro.removeStorageSync === 'function') {
      Taro.removeStorageSync(key);
    }
  } catch (error) {
    console.error("移除存储失败:", error);
  }
};

// 请求接口类型定义
export interface RequestOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  data?: any;
  header?: Record<string, string>;
  timeout?: number;
  showLoading?: boolean;
  showError?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  timestamp?: string;
  requestId?: string;
}
// 请求拦截器
const requestInterceptor = async (options: RequestOptions) => {
  console.log('🚀 请求拦截器 - 开始处理:', options.url);
  
  // 添加基础URL
  if (!options.url.startsWith("http")) {
    options.url = `${API_CONFIG.BASE_URL}${options.url}`;
  }

  // 设置默认请求头
  const defaultHeaders: any = {
    "X-Requested-With": "XMLHttpRequest",
  };

  // 只有在没有指定Content-Type且不是FormData时才设置JSON Content-Type
  if (!options.header?.['Content-Type'] && 
      !(options.data instanceof FormData)) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  // 添加认证token（避免登录接口的循环刷新）
  const isAuthEndpoint = options.url.includes('/auth/login') || 
                         options.url.includes('/auth/register') || 
                         options.url.includes('/auth/send-verify-code') ||
                         options.url.includes('/auth/slider-challenge') ||
                         options.url.includes('/auth/slider-verify') ||
                         options.url.includes('/auth/refresh-token') ||
                         options.url.includes('/face/login'); // 添加人脸登录接口
                         
  if (!isAuthEndpoint) {
    console.log('🔑 非认证接口，尝试添加Token');
    try {
      const token = await tokenManager.getValidAccessToken();
      if (token) {
        defaultHeaders["Authorization"] = `Bearer ${token}`;
        console.log('✅ Token已添加');
      } else {
        console.log('⚠️ 无有效Token');
      }
    } catch (error) {
      console.error('❌ 获取Token失败:', error);
    }
  } else {
    console.log('🔓 认证接口，跳过Token验证');
  }

  // 合并请求头，但不覆盖已设置的Content-Type
  options.header = {
    ...defaultHeaders,
    ...options.header,
  };

  // 如果是FormData，删除Content-Type让浏览器自动设置
  if (options.data instanceof FormData && options.header['Content-Type'] === 'multipart/form-data') {
    delete options.header['Content-Type'];
    console.log('📎 检测到FormData，移除Content-Type让浏览器自动设置');
  }

  // 设置超时时间
  options.timeout = options.timeout || API_CONFIG.TIMEOUT;

  // 显示加载中
  if (options.showLoading !== false) {
    try {
      if (typeof Taro.showLoading === 'function') {
        Taro.showLoading({
          title: "请求中...",
          mask: true,
        });
      } else {
        console.log("Loading: 请求中...");
      }
    } catch (error) {
      console.log("showLoading 不可用:", error);
    }
  }

  return options;
};

// 响应拦截器
const responseInterceptor = (response: any, options: RequestOptions) => {
  // 隐藏加载中
  if (options.showLoading !== false) {
    try {
      if (typeof Taro.hideLoading === 'function') {
        Taro.hideLoading();
      }
    } catch (error) {
      console.log("hideLoading 不可用:", error);
    }
  }

  const { statusCode, data } = response;

  // HTTP状态码检查
  if (statusCode >= 200 && statusCode < 300) {
    // 业务逻辑检查
    if (data.success === false) {
      // 处理业务错误
      handleBusinessError(data, options);
      return Promise.reject(data);
    }
    return data;
  } else {
    // 处理HTTP错误
    const error = handleHttpError(statusCode, options);
    return Promise.reject(error);
  }
};

// 处理业务错误
const handleBusinessError = (data: ApiResponse, options: RequestOptions) => {
  const { errorCode, message } = data;

  // 特殊错误码处理
  switch (errorCode) {
    case ERROR_CODES.INVALID_TOKEN:
    case ERROR_CODES.TOKEN_EXPIRED:
      // 使用Token管理器处理过期
      tokenManager.clearTokens();
      break;
    case ERROR_CODES.PERMISSION_DENIED:
      if (options.showError !== false) {
        console.log("Toast: 权限不足");
      }
      break;
    case ERROR_CODES.NETWORK_ERROR:
      if (options.showError !== false) {
        console.log("Toast: 网络连接失败");
      }
      break;
    default:
      if (options.showError !== false && message) {
        console.log("Toast:", message);
      }
      break;
  }
};

// 处理HTTP错误
const handleHttpError = (statusCode: number, options: RequestOptions) => {
  let message = "请求失败";

  switch (statusCode) {
    case 400:
      message = "请求参数错误";
      break;
    case 401:
      message = "未授权访问";
      break;
    case 403:
      message = "禁止访问";
      break;
    case 404:
      message = "请求资源不存在";
      break;
    case 500:
      message = "服务器内部错误";
      break;
    case 502:
      message = "网关错误";
      break;
    case 503:
      message = "服务不可用";
      break;
    case 504:
      message = "网关超时";
      break;
    default:
      message = `请求失败 (${statusCode})`;
      break;
  }

  if (options.showError !== false) {
    console.log("Toast:", message);
  }

  return {
    success: false,
    errorCode: `HTTP_${statusCode}`,
    message,
    statusCode,
  };
};

// 重试机制
const retryRequest = async (
  options: RequestOptions,
  retryCount = 0
): Promise<any> => {
  try {
    const processedOptions = await requestInterceptor(options);
    
    // 安全的请求调用
    let response;
    if (typeof Taro.request === 'function') {
      response = await Taro.request(processedOptions);
    } else if (isH5 || isBrowser) {
      // H5环境下使用fetch
      const method = processedOptions.method || 'GET';
      const fetchOptions: RequestInit = {
        method: method,
        headers: processedOptions.header,
      };
      
      // 只有在非GET/HEAD方法时才添加body
      if (method !== 'GET' && method !== 'HEAD' && processedOptions.data) {
        fetchOptions.body = JSON.stringify(processedOptions.data);
      }
      
      const fetchResponse = await fetch(processedOptions.url, fetchOptions);
      const data = await fetchResponse.json();
      
      response = {
        statusCode: fetchResponse.status,
        data: data,
        header: fetchResponse.headers
      };
    } else {
      throw new Error('请求API不可用');
    }
    
    return responseInterceptor(response, options);
  } catch (error) {
    if (retryCount < API_CONFIG.RETRY_COUNT) {
      console.log(
        `请求重试 ${retryCount + 1}/${API_CONFIG.RETRY_COUNT}:`,
        options.url
      );
      await new Promise((resolve) =>
        setTimeout(resolve, TIME_CONSTANTS.ONE_SECOND * (retryCount + 1))
      );
      return retryRequest(options, retryCount + 1);
    }
    throw error;
  }
};

// 主要的请求函数
const request = async <T = any>(
  options: RequestOptions
): Promise<ApiResponse<T>> => {
  try {
    return await retryRequest(options);
  } catch (error) {
    console.error("请求失败:", error);
    throw error;
  }
};

// 便捷方法
export const get = <T = any>(
  url: string,
  data?: any,
  options?: Partial<RequestOptions>
): Promise<ApiResponse<T>> => {
  return request<T>({
    url,
    method: "GET",
    data,
    ...options,
  });
};

export const post = <T = any>(
  url: string,
  data?: any,
  options?: Partial<RequestOptions>
): Promise<ApiResponse<T>> => {
  return request<T>({
    url,
    method: "POST",
    data,
    ...options,
  });
};

export const put = <T = any>(
  url: string,
  data?: any,
  options?: Partial<RequestOptions>
): Promise<ApiResponse<T>> => {
  return request<T>({
    url,
    method: "PUT",
    data,
    ...options,
  });
};

export const del = <T = any>(
  url: string,
  data?: any,
  options?: Partial<RequestOptions>
): Promise<ApiResponse<T>> => {
  return request<T>({
    url,
    method: "DELETE",
    data,
    ...options,
  });
};

export default request;
