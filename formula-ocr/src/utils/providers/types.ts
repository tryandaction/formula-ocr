// Provider types and interfaces for multi-provider OCR system

export type ProviderType = 
  | 'backend'        // 后端代理模式（推荐）
  | 'anthropic'      // Claude Vision API (需要 API Key)
  | 'openai'         // GPT-4 Vision API (需要 API Key)
  | 'gemini'         // Google Gemini API (免费额度较高)
  | 'simpletex'      // SimpleTex API (专业公式识别，有免费额度)
  | 'siliconflow'    // 硅基流动 (超便宜，API兼容OpenAI)
  | 'qwen'           // 阿里通义千问 (Qwen-VL，价格便宜)
  | 'zhipu'          // 智谱AI (GLM-4V，有免费额度)
  | 'local';         // 本地模型 (完全免费，离线可用)

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyPlaceholder?: string;
  freeQuota?: string;
  pros: string[];
  cons: string[];
  setupUrl?: string;
}

export interface RecognitionResult {
  latex: string;
  provider: ProviderType;
  confidence?: number;
  processingTime?: number;
}

export interface ProviderInterface {
  type: ProviderType;
  recognize(imageBase64: string, apiKey?: string): Promise<string>;
  validateApiKey?(apiKey: string): Promise<boolean>;
}

// Provider configurations
export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  backend: {
    type: 'backend',
    name: '云端服务（推荐）',
    description: '通过后端代理，免费用户每天10次',
    requiresApiKey: false,
    freeQuota: '免费用户每天10次',
    pros: ['无需配置', '免费额度', '付费可升级', '速度快'],
    cons: ['需要网络连接'],
  },
  anthropic: {
    type: 'anthropic',
    name: 'Claude (Anthropic)',
    description: '高精度视觉识别，支持复杂公式',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-ant-...',
    pros: ['识别精度高', '支持复杂公式', '上下文理解强'],
    cons: ['需要 API Key', '按量付费', '国内需代理'],
    setupUrl: 'https://console.anthropic.com/'
  },
  openai: {
    type: 'openai',
    name: 'GPT-4 Vision (OpenAI)',
    description: 'OpenAI 视觉模型，广泛使用',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    pros: ['识别精度高', '生态成熟', '文档丰富'],
    cons: ['需要 API Key', '按量付费', '国内需代理'],
    setupUrl: 'https://platform.openai.com/api-keys'
  },
  gemini: {
    type: 'gemini',
    name: 'Gemini (Google)',
    description: 'Google AI，免费额度充足',
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIza...',
    freeQuota: '每天 1500 次免费请求',
    pros: ['免费额度高', '速度快', '无需信用卡'],
    cons: ['需要 Google 账号', '国内需代理'],
    setupUrl: 'https://aistudio.google.com/apikey'
  },
  simpletex: {
    type: 'simpletex',
    name: 'SimpleTex',
    description: '专业公式识别 API，有免费额度',
    requiresApiKey: true,
    apiKeyPlaceholder: 'your-simpletex-token',
    freeQuota: '每月 1000 次免费',
    pros: ['专为公式优化', '支持手写', '中文友好', '国内可用'],
    cons: ['需要注册', '高级功能付费'],
    setupUrl: 'https://simpletex.cn/'
  },
  siliconflow: {
    type: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    description: '国内平台，超便宜，支持多种视觉模型',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    freeQuota: '新用户送 14 元额度',
    pros: ['价格超低', '国内直连', 'API兼容OpenAI', '多模型可选'],
    cons: ['需要注册', '新平台'],
    setupUrl: 'https://cloud.siliconflow.cn/'
  },
  qwen: {
    type: 'qwen',
    name: '通义千问 (Qwen-VL)',
    description: '阿里云视觉大模型，价格便宜',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    freeQuota: '新用户有免费额度',
    pros: ['价格便宜', '国内直连', '阿里云稳定', '中文优化'],
    cons: ['需要阿里云账号'],
    setupUrl: 'https://dashscope.console.aliyun.com/'
  },
  zhipu: {
    type: 'zhipu',
    name: '智谱AI (GLM-4V)',
    description: '国产视觉大模型，有免费额度',
    requiresApiKey: true,
    apiKeyPlaceholder: 'your-api-key',
    freeQuota: 'GLM-4V-Flash 免费使用',
    pros: ['有免费模型', '国内直连', '清华技术', '中文友好'],
    cons: ['需要注册'],
    setupUrl: 'https://open.bigmodel.cn/'
  },
  local: {
    type: 'local',
    name: '本地模型 (Pix2Tex)',
    description: '完全离线，无需 API Key',
    requiresApiKey: false,
    pros: ['完全免费', '离线可用', '隐私安全'],
    cons: ['需要安装 Python 环境', '首次加载较慢', '精度略低于云端']
  }
};

// Storage keys for API keys (localStorage)
export const API_KEY_STORAGE_KEYS: Record<ProviderType, string> = {
  backend: '',
  anthropic: 'anthropic_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key',
  simpletex: 'simpletex_api_key',
  siliconflow: 'siliconflow_api_key',
  qwen: 'qwen_api_key',
  zhipu: 'zhipu_api_key',
  local: ''
};

// Environment variable keys for built-in API keys
export const ENV_API_KEY_MAPPING: Record<ProviderType, string> = {
  backend: '',
  anthropic: 'VITE_ANTHROPIC_API_KEY',
  openai: 'VITE_OPENAI_API_KEY',
  gemini: 'VITE_GEMINI_API_KEY',
  simpletex: 'VITE_SIMPLETEX_API_KEY',
  siliconflow: 'VITE_SILICONFLOW_API_KEY',
  qwen: 'VITE_QWEN_API_KEY',
  zhipu: 'VITE_ZHIPU_API_KEY',
  local: ''
};

/**
 * Get built-in API key from environment variables
 * These are configured by the site owner, not exposed to users
 * For zhipu: only returns built-in key if user is activated (paid)
 */
export function getBuiltInApiKey(type: ProviderType, checkActivation = true): string {
  const envKey = ENV_API_KEY_MAPPING[type];
  if (!envKey) return '';
  
  const builtInKey = (import.meta.env[envKey] as string) || '';
  
  // 智谱API需要激活才能使用内置Key
  if (type === 'zhipu' && checkActivation && builtInKey) {
    // 动态导入避免循环依赖
    const activationCode = localStorage.getItem('formula_ocr_activation_code');
    if (!activationCode) return '';
    
    // 简单验证激活码格式和过期时间
    const parts = activationCode.split('-');
    if (parts.length !== 4 || parts[0] !== 'FOCR') return '';
    
    const expireTimestamp = parseInt(parts[2], 10);
    const now = Math.floor(Date.now() / 1000);
    if (expireTimestamp < now) return '';
  }
  
  return builtInKey;
}

/**
 * Check if a provider has a built-in API key (free for users)
 * For zhipu: also checks if user is activated
 */
export function hasBuiltInApiKey(type: ProviderType): boolean {
  return !!getBuiltInApiKey(type);
}

/**
 * Check if zhipu has built-in key configured (regardless of activation)
 */
export function hasZhipuBuiltInKeyConfigured(): boolean {
  const envKey = ENV_API_KEY_MAPPING['zhipu'];
  return !!(import.meta.env[envKey] as string);
}
