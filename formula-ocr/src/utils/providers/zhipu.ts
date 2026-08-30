// 智谱 AI (GLM-4V) API provider
// 国产视觉大模型，有免费额度

import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';
import { extractLatex } from '../apiClient';
import { buildFormulaPrompt } from './contract';

// 请求超时时间（毫秒）
const API_TIMEOUT = 60000; // 60秒，AI模型需要较长时间

export const zhipuProvider: ProviderInterface = {
  type: 'zhipu' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string, context?: RecognitionRequestContext): Promise<string> {
    if (!apiKey) {
      throw new Error('智谱 AI API Key 是必需的');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4v-flash',  // 免费的视觉模型
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              },
              {
                type: 'text',
                text: buildFormulaPrompt(context)
              }
            ]
          }]
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `API 错误: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('API 响应格式无效');
      }

      return extractLatex(data.choices[0].message.content);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('识别超时，请稍后重试或尝试更小的图片');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // 智谱没有简单的验证端点，尝试获取模型列表
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          signal: controller.signal,
        });
        return response.ok;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }
};
