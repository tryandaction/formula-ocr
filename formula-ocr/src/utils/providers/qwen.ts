// 阿里通义千问 (Qwen-VL) API provider
// 阿里云视觉大模型，价格便宜

import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';
import { extractLatex } from '../apiClient';
import { buildFormulaPrompt } from './contract';

export const qwenProvider: ProviderInterface = {
  type: 'qwen' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string, context?: RecognitionRequestContext): Promise<string> {
    if (!apiKey) {
      throw new Error('通义千问 API Key 是必需的');
    }

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',  // 通义千问视觉模型
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.message || `API 错误: ${response.status}`;
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
      // 通义千问使用 DashScope API，验证方式
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/models', {
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
