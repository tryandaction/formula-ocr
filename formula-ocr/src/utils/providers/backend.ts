/**
 * 后端代理 Provider
 * 通过 Cloudflare Worker 后端调用智谱 API
 */

import type { ProviderInterface, ProviderType } from './types';
import { recognizeFormula, isBackendEnabled } from '../api';

export const backendProvider: ProviderInterface = {
  type: 'backend' as ProviderType,

  async recognize(imageBase64: string): Promise<string> {
    if (!isBackendEnabled()) {
      throw new Error('后端服务未配置');
    }

    const result = await recognizeFormula(imageBase64);
    
    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }

    return result.latex || '';
  },

  async validateApiKey(): Promise<boolean> {
    // 后端模式不需要验证 API Key
    return isBackendEnabled();
  }
};
