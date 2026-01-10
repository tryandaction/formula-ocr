// 硅基流动 (SiliconFlow) API provider
// API 兼容 OpenAI 格式，支持多种视觉模型

import type { ProviderInterface, ProviderType } from './types';
import { extractLatex } from '../apiClient';

const FORMULA_PROMPT = `分析这张包含学术公式的图片（数学、物理、化学或工程公式均可），提取所有公式并转换为 LaTeX 代码。

要求：
1. 只输出 LaTeX 代码，不要解释
2. 使用标准 LaTeX 语法（\\frac, \\int, \\sum, \\partial 等）
3. 化学公式请使用 \\ce{} 或标准下标格式
4. 多个公式用换行分隔
5. 不清楚的部分标记为 [unclear]

输出格式：
\`\`\`latex
公式1
公式2
\`\`\``;

export const siliconflowProvider: ProviderInterface = {
  type: 'siliconflow' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string): Promise<string> {
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
              text: FORMULA_PROMPT
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
