// Anthropic Claude Vision API provider

import type { ProviderInterface, ProviderType } from './types';
import { extractLatex, getMediaTypeFromBase64 } from '../apiClient';

const FORMULA_PROMPT = `这是一张包含学术公式的图片（可能是数学、物理、化学或工程公式）。请识别其中的所有公式，并转换为LaTeX代码。

要求：
1. 只输出LaTeX代码，不要其他解释
2. 使用标准LaTeX语法（\\frac, \\int, \\sum, \\partial 等）
3. 化学公式请使用 \\ce{} 或标准下标格式
4. 如果有多个公式，用换行分隔
5. 如果识别不清，标注[unclear]

输出格式：
\`\`\`latex
公式1
公式2
\`\`\``;

export const anthropicProvider: ProviderInterface = {
  type: 'anthropic' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string): Promise<string> {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const base64Data = imageBase64.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data');
    }

    const mediaType = getMediaTypeFromBase64(imageBase64);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
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
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.content || !data.content[0] || data.content[0].type !== 'text') {
      throw new Error('Invalid API response format');
    }

    return extractLatex(data.content[0].text);
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};
