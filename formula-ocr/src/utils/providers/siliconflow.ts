// 硅基流动 (SiliconFlow) API provider
// API 兼容 OpenAI 格式，支持多种视觉模型

import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';
import { extractLatex } from '../apiClient';
import { buildFormulaPrompt } from './contract';

export const siliconflowProvider: ProviderInterface = {
  type: 'siliconflow' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string, context?: RecognitionRequestContext): Promise<string> {
    if (!apiKey) {
      throw new Error('硅基流动 API Key 是必需的');
    }

    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2-VL-72B-Instruct',  // 通义千问视觉模型，性价比高
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
                detail: 'high'
              }
            },
            {
              type: 'text',
              text: buildFormulaPrompt(context)
            }
          ]
        }]
      })
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
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.siliconflow.cn/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};
