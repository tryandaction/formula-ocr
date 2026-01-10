// Provider registry and unified recognition interface

import type { ProviderType, ProviderInterface } from './types';
import { PROVIDER_CONFIGS, API_KEY_STORAGE_KEYS, getBuiltInApiKey, hasBuiltInApiKey, hasZhipuBuiltInKeyConfigured } from './types';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { geminiProvider } from './gemini';
import { simpletexProvider } from './simpletex';
import { siliconflowProvider } from './siliconflow';
import { qwenProvider } from './qwen';
import { zhipuProvider } from './zhipu';
import { localProvider, checkLocalServer, LOCAL_SETUP_INSTRUCTIONS } from './local';
import { backendProvider } from './backend';
import { isBackendEnabled } from '../api';

export * from './types';
export { checkLocalServer, LOCAL_SETUP_INSTRUCTIONS };
export { hasZhipuBuiltInKeyConfigured };

// Provider registry
const providers: Record<ProviderType, ProviderInterface> = {
  backend: backendProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  simpletex: simpletexProvider,
  siliconflow: siliconflowProvider,
  qwen: qwenProvider,
  zhipu: zhipuProvider,
  local: localProvider
};

/**
 * Get provider by type
 */
export function getProvider(type: ProviderType): ProviderInterface {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`Unknown provider: ${type}`);
  }
  return provider;
}

/**
 * Get stored API key for a provider
 * Priority: user's localStorage key > built-in env key
 */
export function getStoredApiKey(type: ProviderType): string {
  const key = API_KEY_STORAGE_KEYS[type];
  if (key) {
    const userKey = localStorage.getItem(key);
    if (userKey) return userKey;
  }
  // Fall back to built-in key from environment
  return getBuiltInApiKey(type);
}

/**
 * Get user's own API key (not built-in)
 */
export function getUserApiKey(type: ProviderType): string {
  const key = API_KEY_STORAGE_KEYS[type];
  if (!key) return '';
  return localStorage.getItem(key) || '';
}

/**
 * Check if user has their own API key configured
 */
export function hasUserApiKey(type: ProviderType): boolean {
  return !!getUserApiKey(type);
}

/**
 * Store API key for a provider
 */
export function storeApiKey(type: ProviderType, apiKey: string): void {
  const key = API_KEY_STORAGE_KEYS[type];
  if (key) {
    localStorage.setItem(key, apiKey);
  }
}

/**
 * Clear stored API key for a provider
 */
export function clearApiKey(type: ProviderType): void {
  const key = API_KEY_STORAGE_KEYS[type];
  if (key) {
    localStorage.removeItem(key);
  }
}

/**
 * Get all available providers with their status
 * Returns providers list and local server status to avoid duplicate requests
 */
export async function getAvailableProviders(): Promise<{
  providers: Array<{
    type: ProviderType;
    config: typeof PROVIDER_CONFIGS[ProviderType];
    hasApiKey: boolean;
    hasUserKey: boolean;
    hasBuiltInKey: boolean;
    isAvailable: boolean;
  }>;
  localServerStatus: { available: boolean; message: string };
}> {
  // Check local server once
  const localServerStatus = await checkLocalServer();
  
  const providersList = Object.entries(PROVIDER_CONFIGS).map(([type, config]) => {
    const providerType = type as ProviderType;
    const hasUserKey = hasUserApiKey(providerType);
    const builtInKey = hasBuiltInApiKey(providerType);
    const hasApiKey = !config.requiresApiKey || hasUserKey || builtInKey;
    
    let isAvailable = hasApiKey;
    
    // Backend provider: check if API_BASE is configured
    if (providerType === 'backend') {
      isAvailable = isBackendEnabled();
    }
    
    // Use cached local server status
    if (providerType === 'local') {
      isAvailable = localServerStatus.available;
    }
    
    return {
      type: providerType,
      config,
      hasApiKey,
      hasUserKey,
      hasBuiltInKey: builtInKey,
      isAvailable
    };
  });
  
  return { providers: providersList, localServerStatus };
}

/**
 * Recognize formula using specified provider
 */
export async function recognizeWithProvider(
  imageBase64: string,
  providerType: ProviderType,
  apiKey?: string
): Promise<string> {
  const provider = getProvider(providerType);
  const key = apiKey || getStoredApiKey(providerType);
  
  return provider.recognize(imageBase64, key);
}

/**
 * Get the best available provider (prioritizes free options)
 */
export async function getBestAvailableProvider(): Promise<ProviderType | null> {
  const { providers } = await getAvailableProviders();
  
  // Priority order: backend (推荐) > local (free) > 国内免费/便宜 > 国外
  const priority: ProviderType[] = ['backend', 'local', 'zhipu', 'siliconflow', 'qwen', 'simpletex', 'gemini', 'anthropic', 'openai'];
  
  for (const type of priority) {
    const provider = providers.find(p => p.type === type);
    if (provider?.isAvailable) {
      return type;
    }
  }
  
  return null;
}

/**
 * Get recommended provider for new users
 * Prioritizes backend mode if available
 */
export function getRecommendedProvider(): ProviderType {
  // 优先使用后端模式
  if (isBackendEnabled()) {
    return 'backend';
  }
  
  // Check if zhipu has built-in key (our default free service)
  if (hasBuiltInApiKey('zhipu')) {
    return 'zhipu';
  }
  // Gemini has the most generous free tier and is easiest to set up
  return 'gemini';
}
