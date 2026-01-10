// Google Gemini API provider (generous free tier!)

import type { ProviderInterface, ProviderType } from './types';
import { extractLatex } from '../apiClient';

const FORMULA_PROMPT = `Analyze this image containing academic formulas (math, physics, chemistry, or engineering). Extract all formulas and convert them to LaTeX code.

Requirements:
1. Output only LaTeX code, no explanations
2. Use standard LaTeX syntax (\\frac, \\int, \\sum, \\partial, etc.)
3. For chemistry formulas, use \\ce{} or standard subscript format
4. Separate multiple formulas with newlines
5. Mark unclear parts with [unclear]

Output format:
\`\`\`latex
formula1
formula2
\`\`\``;

export const geminiProvider: ProviderInterface = {
  type: 'gemini' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string): Promise<string> {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Extract base64 data and mime type
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data format');
    }
    const [, mimeType, base64Data] = matches;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              },
              {
                text: FORMULA_PROMPT
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.1
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid API response format');
    }

    const text = data.candidates[0].content.parts
      .filter((p: { text?: string }) => p.text)
      .map((p: { text: string }) => p.text)
      .join('');

    return extractLatex(text);
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
};
