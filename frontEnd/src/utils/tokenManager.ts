import Taro from '@tarojs/taro';
import { STORAGE_KEYS, API_CONFIG } from './constants';
import { TaroSafe } from './taroSafe';

export interface TokenInfo {
  token: string;
  refreshToken: string;
  expiresAt?: number;
}

export class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshAttempts: number = 0;
  private lastRefreshTime: number = 0;
  private readonly MAX_REFRESH_ATTEMPTS = 3;
  private readonly REFRESH_COOLDOWN = 30 * 1000; // 30秒冷却时间

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * 保存Token信息
   */
  saveTokens(tokenInfo: TokenInfo): void {
    try {
      TaroSafe.setStorageSync(STORAGE_KEYS.USER_TOKEN, tokenInfo.token);
      if (tokenInfo.refreshToken) {
        TaroSafe.setStorageSync(STORAGE_KEYS.USER_REFRESH_TOKEN, tokenInfo.refreshToken);
      }
      if (tokenInfo.expiresAt) {
        TaroSafe.setStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenInfo.expiresAt.toString());
      }
      console.log('✅ Token信息已保存');
    } catch (error) {
      console.error('❌ 保存Token失败:', error);
    }
  }

  /**
   * 获取访问Token
   */
  getAccessToken(): string | null {
    try {
      return TaroSafe.getStorageSync(STORAGE_KEYS.USER_TOKEN);
    } catch (error) {
      console.error('❌ 获取访问Token失败:', error);
      return null;
    }
  }

  /**
   * 获取刷新Token
   */
  getRefreshToken(): string | null {
    try {
      return TaroSafe.getStorageSync(STORAGE_KEYS.USER_REFRESH_TOKEN);
    } catch (error) {
      console.error('❌ 获取刷新Token失败:', error);
      return null;
    }
  }

  /**
   * 检查Token是否即将过期
   */
  isTokenExpiringSoon(): boolean {
    try {
      const expiresAtStr = TaroSafe.getStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      if (!expiresAtStr) return false;
      
      const expiresAt = parseInt(expiresAtStr);
      const now = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5分钟缓冲时间
      
      return (expiresAt - now) < bufferTime;
    } catch (error) {
      console.error('❌ 检查Token过期时间失败:', error);
      return false;
    }
  }

  /**
   * 检查是否有有效Token
   */
  hasValidToken(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;
    
    // 检查是否过期
    try {
      const expiresAtStr = TaroSafe.getStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      if (expiresAtStr) {
        const expiresAt = parseInt(expiresAtStr);
        if (Date.now() >= expiresAt) {
          return false;
        }
      }
    } catch (error) {
      console.error('❌ 检查Token有效性失败:', error);
    }
    
    return true;
  }

  /**
   * 刷新Token
   */
  async refreshAccessToken(): Promise<boolean> {
    // 检查冷却时间
    const now = Date.now();
    if (now - this.lastRefreshTime < this.REFRESH_COOLDOWN) {
      console.log('🚫 Token刷新冷却中，跳过刷新');
      return false;
    }

    // 检查刷新次数
    if (this.refreshAttempts >= this.MAX_REFRESH_ATTEMPTS) {
      console.log('🚫 Token刷新次数达到上限，清除Token');
      this.clearTokens();
      return false;
    }

    // 防止并发刷新
    if (this.refreshPromise) {
      console.log('⏳ Token刷新进行中，等待结果');
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    const result = await this.refreshPromise;
    this.refreshPromise = null;
    this.lastRefreshTime = now;
    
    if (result) {
      this.refreshAttempts = 0; // 成功后重置计数
    } else {
      this.refreshAttempts++; // 失败计数
    }
    
    return result;
  }

  private async performTokenRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        console.log('❌ 没有刷新Token，需要重新登录');
        this.clearTokens();
        this.redirectToLogin();
        return false;
      }

      console.log('🔄 正在刷新Token...');

      // 调用刷新Token API
      const response = await this.callRefreshAPI(refreshToken);
      
      if (response.success && response.data) {
        const { token, refreshToken: newRefreshToken } = response.data;
        
        // 保存新的Token
        this.saveTokens({
          token,
          refreshToken: newRefreshToken,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
        });
        
        console.log('✅ Token刷新成功');
        return true;
      } else {
        console.log('❌ Token刷新失败:', response.message);
        this.clearTokens();
        this.redirectToLogin();
        return false;
      }
    } catch (error) {
      console.error('❌ Token刷新异常:', error);
      this.clearTokens();
      this.redirectToLogin();
      return false;
    }
  }

  /**
   * 调用刷新Token API
   */
  private async callRefreshAPI(refreshToken: string): Promise<any> {
    const url = `${API_CONFIG.BASE_URL}/auth/refresh-token`;
    
    try {
      // 使用原生fetch避免循环依赖
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('🚫 刷新Token API调用失败:', error);
      throw error;
    }
  }

  /**
   * 清除所有Token
   */
  clearTokens(): void {
    try {
      TaroSafe.removeStorageSync(STORAGE_KEYS.USER_TOKEN);
      TaroSafe.removeStorageSync(STORAGE_KEYS.USER_REFRESH_TOKEN);
      TaroSafe.removeStorageSync(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      TaroSafe.removeStorageSync(STORAGE_KEYS.USER_INFO);
      console.log('✅ Token信息已清除');
    } catch (error) {
      console.error('❌ 清除Token失败:', error);
    }
  }

  /**
   * 重定向到登录页
   */
  private redirectToLogin(): void {
    try {
      if (typeof Taro.reLaunch === 'function') {
        Taro.reLaunch({
          url: '/pages/login/login',
        });
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.hash = '/pages/login/login';
      }
    } catch (error) {
      console.error('❌ 重定向到登录页失败:', error);
    }
  }

  /**
   * 获取带有自动刷新的Token
   */
  async getValidAccessToken(): Promise<string | null> {
    console.log('🔍 检查Token有效性...');
    
    // 检查当前Token是否有效
    if (this.hasValidToken()) {
      const token = this.getAccessToken();
      console.log('✅ Token有效');
      
      // 如果Token即将过期，尝试刷新（但不阻塞当前请求）
      if (this.isTokenExpiringSoon()) {
        console.log('⏰ Token即将过期，后台刷新...');
        // 异步刷新，不等待结果
        this.refreshAccessToken().catch(error => {
          console.error('🚫 后台Token刷新失败:', error);
        });
      }
      
      return token;
    }

    // Token无效，尝试刷新一次
    console.log('❌ Token无效，尝试刷新...');
    const refreshSuccess = await this.refreshAccessToken();
    
    if (refreshSuccess) {
      console.log('✅ Token刷新成功');
      return this.getAccessToken();
    }

    console.log('❌ Token刷新失败，返回null');
    return null;
  }
}

// 导出单例实例
export const tokenManager = TokenManager.getInstance();
