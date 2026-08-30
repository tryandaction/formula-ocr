// OpenAI GPT-4 Vision API provider

import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';
import { extractLatex } from '../apiClient';
import { buildFormulaPrompt } from './contract';

export const openaiProvider: ProviderInterface = {
  type: 'openai' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string, context?: RecognitionRequestContext): Promise<string> {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response format');
    }

    return extractLatex(data.choices[0].message.content);
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
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
