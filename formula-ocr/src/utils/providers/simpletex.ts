// SimpleTex API provider - specialized for formula recognition

import type { ProviderInterface, ProviderType } from './types';

export const simpletexProvider: ProviderInterface = {
  type: 'simpletex' as ProviderType,

  async recognize(imageBase64: string, apiKey?: string): Promise<string> {
    if (!apiKey) {
      throw new Error('SimpleTex API token is required');
    }

    // Extract base64 data
    const base64Data = imageBase64.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data');
    }

    // Convert base64 to blob for form data
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Determine mime type
    let mimeType = 'image/png';
    if (imageBase64.includes('data:image/jpeg')) mimeType = 'image/jpeg';
    else if (imageBase64.includes('data:image/webp')) mimeType = 'image/webp';
    
    const blob = new Blob([byteArray], { type: mimeType });

    // Create form data
    const formData = new FormData();
    formData.append('file', blob, 'formula.png');

    const response = await fetch('https://server.simpletex.cn/api/latex_ocr', {
      method: 'POST',
      headers: {
        'token': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (data.status === false) {
      throw new Error(data.message || 'Recognition failed');
    }

    // SimpleTex returns latex directly in res.latex
    if (data.res && data.res.latex) {
      return data.res.latex;
    }

    throw new Error('No LaTeX result in response');
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    // SimpleTex doesn't have a dedicated validation endpoint
    // We'll assume the key is valid if it's not empty
    return apiKey.length > 0;
  }
};
