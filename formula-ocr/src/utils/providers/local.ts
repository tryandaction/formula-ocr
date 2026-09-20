// Local model provider using Pix2Tex via local server
// This requires running a local Python server with pix2tex installed

import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';

const LOCAL_SERVER_URL = 'http://localhost:8502';

export interface LocalServerStatus {
  available: boolean;
  message: string;
}

/**
 * Check if local pix2tex server is running
 */
export async function checkLocalServer(signal?: AbortSignal): Promise<LocalServerStatus> {
  try {
    const response = await fetch(`${LOCAL_SERVER_URL}/health`, {
      method: 'GET',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000)
    });
    
    if (response.ok) {
      return { available: true, message: '本地服务器运行中' };
    }
    return { available: false, message: '本地服务器响应异常' };
  } catch {
    return { 
      available: false, 
      message: '本地服务器未启动。请运行: python local_server.py' 
    };
  }
}

export const localProvider: ProviderInterface = {
  type: 'local' as ProviderType,

  async recognize(imageBase64: string, _key?: string, context?: RecognitionRequestContext): Promise<string> {
    // Check server availability first
    const status = await checkLocalServer(context?.signal);
    context?.signal?.throwIfAborted();
    if (!status.available) {
      throw new Error(status.message);
    }

    // Extract base64 data
    const base64Data = imageBase64.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data');
    }

    const response = await fetch(`${LOCAL_SERVER_URL}/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Data
      }),
      signal: context?.signal ?? AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.latex) {
      throw new Error('No LaTeX result from local model');
    }

    return data.latex;
  }
};

/**
 * Instructions for setting up local server
 */
export const LOCAL_SETUP_INSTRUCTIONS = `
## 本地模型设置指南 (Ollama)

### 1. 安装 Ollama
访问 https://ollama.ai 下载安装

### 2. 拉取视觉模型
\`\`\`bash
ollama pull llama3.2-vision
\`\`\`

### 3. 安装 Python 依赖
\`\`\`bash
pip install flask flask-cors requests
\`\`\`

### 4. 启动本地服务器
\`\`\`bash
python local_server.py
\`\`\`

### 优势
- ✅ 完全免费，无需 API Key
- ✅ 离线可用，保护隐私
- ✅ 无使用次数限制
- ✅ 支持多种视觉模型

### 支持的模型
- llama3.2-vision (推荐)
- llava
- bakllava
`;
