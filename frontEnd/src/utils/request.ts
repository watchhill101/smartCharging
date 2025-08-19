import Taro from "@tarojs/taro";
import { API_CONFIG, STORAGE_KEYS, ERROR_CODES } from "./constants";

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
const requestInterceptor = (options: RequestOptions) => {
  // 添加基础URL
  if (!options.url.startsWith("http")) {
    options.url = `${API_CONFIG.BASE_URL}${options.url}`;
  }

  // 设置默认请求头
  const defaultHeaders = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  // 添加认证token
  const token = getStorageSync(STORAGE_KEYS.USER_TOKEN);
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  options.header = {
    ...defaultHeaders,
    ...options.header,
  };

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
      // 清除token并跳转到登录页
      removeStorageSync(STORAGE_KEYS.USER_TOKEN);
      removeStorageSync(STORAGE_KEYS.USER_INFO);
      try {
        if (typeof Taro.reLaunch === 'function') {
          Taro.reLaunch({
            url: "/pages/login/login",
          });
        } else if (isH5 && window.location) {
          window.location.hash = '/pages/login/login';
        }
      } catch (error) {
        console.log("页面跳转不可用:", error);
      }
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
    const processedOptions = requestInterceptor(options);
    
    // 安全的请求调用
    let response;
    if (typeof Taro.request === 'function') {
      response = await Taro.request(processedOptions);
    } else if (isH5 || isBrowser) {
      // H5环境下使用fetch
      const fetchOptions: RequestInit = {
        method: processedOptions.method || 'GET',
        headers: processedOptions.header,
        body: processedOptions.data ? JSON.stringify(processedOptions.data) : undefined,
      };
      
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
        setTimeout(resolve, 1000 * (retryCount + 1))
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
