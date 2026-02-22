/**
 * 状态缓存服务 - 保存和恢复 PDF 阅读状态
 * 使用 localStorage 实现零成本持久化
 */

import type { FormulaRegion } from './documentParser';

// 缓存键前缀
const CACHE_PREFIX = 'formula-ocr-pdf-state-';
const CACHE_INDEX_KEY = 'formula-ocr-pdf-state-index';
export const CACHE_VERSION = 2;

// 最大缓存数量
const MAX_CACHED_DOCUMENTS = 10;

// 缓存过期时间（7天）
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 已识别公式的序列化格式
 */
export interface SerializedRecognizedFormula {
  id: string;
  latex: string;
  markdown?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

/**
 * 检测到的公式位置（不含 imageData，恢复时从 pageImages 裁剪）
 */
export interface SerializedDetectedFormula {
  id: string;
  pageNumber: number;
  position: { x: number; y: number; width: number; height: number };
  originalPosition: { x: number; y: number; width: number; height: number };
  confidence?: number;
  type?: string;
  formulaType?: string;
  confidenceLevel?: string;
}

/**
 * PDF 阅读器状态
 */
export interface PDFViewerState {
  documentId: string;
  cacheVersion: number;
  currentPage: number;
  zoom: number;
  scrollPosition: number;
  recognizedFormulas: SerializedRecognizedFormula[];
  detectedFormulas?: SerializedDetectedFormula[];
  timestamp: number;
}

/**
 * 缓存索引项
 */
interface CacheIndexItem {
  documentId: string;
  fileName: string;
  timestamp: number;
}

/**
 * 生成文档唯一标识符
 * 基于文件名和文件大小生成哈希
 */
export function generateDocumentId(fileName: string, fileSize: number): string {
  const str = `${fileName}-${fileSize}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `doc_${Math.abs(hash).toString(36)}`;
}

/**
 * 获取缓存键
 */
function getCacheKey(documentId: string): string {
  return `${CACHE_PREFIX}${documentId}`;
}

/**
 * 获取缓存索引
 */
function getCacheIndex(): CacheIndexItem[] {
  try {
    const indexStr = localStorage.getItem(CACHE_INDEX_KEY);
    if (!indexStr) return [];
    return JSON.parse(indexStr);
  } catch {
    return [];
  }
}

/**
 * 保存缓存索引
 */
function saveCacheIndex(index: CacheIndexItem[]): void {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to save cache index:', error);
  }
}

/**
 * 清理过期和超量的缓存
 */
function cleanupOldCaches(): void {
  const index = getCacheIndex();
  const now = Date.now();
  
  // 过滤掉过期的缓存
  const validItems = index.filter(item => {
    const isExpired = now - item.timestamp > CACHE_EXPIRY_MS;
    if (isExpired) {
      try {
        localStorage.removeItem(getCacheKey(item.documentId));
      } catch {
        // 忽略删除错误
      }
    }
    return !isExpired;
  });
  
  // 如果仍然超过最大数量，删除最旧的
  if (validItems.length > MAX_CACHED_DOCUMENTS) {
    validItems.sort((a, b) => b.timestamp - a.timestamp);
    const toRemove = validItems.slice(MAX_CACHED_DOCUMENTS);
    toRemove.forEach(item => {
      try {
        localStorage.removeItem(getCacheKey(item.documentId));
      } catch {
        // 忽略删除错误
      }
    });
    validItems.length = MAX_CACHED_DOCUMENTS;
  }
  
  saveCacheIndex(validItems);
}

/**
 * 保存 PDF 阅读状态
 */
export function saveState(state: PDFViewerState, fileName: string): boolean {
  try {
    const key = getCacheKey(state.documentId);
    const stateStr = JSON.stringify(state);
    
    try {
      localStorage.setItem(key, stateStr);
    } catch (error) {
      // 可能是配额超限，尝试清理后重试
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        cleanupOldCaches();
        localStorage.setItem(key, stateStr);
      } else {
        throw error;
      }
    }
    
    // 更新索引
    const index = getCacheIndex();
    const existingIndex = index.findIndex(item => item.documentId === state.documentId);
    
    if (existingIndex >= 0) {
      index[existingIndex].timestamp = state.timestamp;
    } else {
      index.push({
        documentId: state.documentId,
        fileName,
        timestamp: state.timestamp,
      });
    }
    
    saveCacheIndex(index);
    cleanupOldCaches();
    
    return true;
  } catch (error) {
    console.error('Failed to save PDF state:', error);
    return false;
  }
}

/**
 * 加载 PDF 阅读状态
 */
export function loadState(documentId: string): PDFViewerState | null {
  try {
    const key = getCacheKey(documentId);
    const stateStr = localStorage.getItem(key);
    
    if (!stateStr) return null;
    
    const state: PDFViewerState = JSON.parse(stateStr);

    if (state.cacheVersion !== CACHE_VERSION) {
      clearState(documentId);
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - state.timestamp > CACHE_EXPIRY_MS) {
      clearState(documentId);
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Failed to load PDF state:', error);
    return null;
  }
}

/**
 * 清除指定文档的缓存状态
 */
export function clearState(documentId: string): boolean {
  try {
    const key = getCacheKey(documentId);
    localStorage.removeItem(key);
    
    // 更新索引
    const index = getCacheIndex();
    const newIndex = index.filter(item => item.documentId !== documentId);
    saveCacheIndex(newIndex);
    
    return true;
  } catch (error) {
    console.error('Failed to clear PDF state:', error);
    return false;
  }
}

/**
 * 清除所有缓存状态
 */
export function clearAllStates(): boolean {
  try {
    const index = getCacheIndex();
    
    // 删除所有缓存
    index.forEach(item => {
      try {
        localStorage.removeItem(getCacheKey(item.documentId));
      } catch {
        // 忽略删除错误
      }
    });
    
    // 清空索引
    localStorage.removeItem(CACHE_INDEX_KEY);
    
    return true;
  } catch (error) {
    console.error('Failed to clear all PDF states:', error);
    return false;
  }
}

/**
 * 获取所有缓存的文档列表
 */
export function getCachedDocuments(): CacheIndexItem[] {
  return getCacheIndex();
}

/**
 * 检查文档是否有缓存状态
 */
export function hasState(documentId: string): boolean {
  const index = getCacheIndex();
  return index.some(item => item.documentId === documentId);
}

/**
 * 将 FormulaRegion 数组中的识别结果转换为可序列化格式
 */
export function serializeRecognizedFormulas(
  formulas: FormulaRegion[],
  recognizedMap: Map<string, { latex: string; markdown?: string; status: string; error?: string }>
): SerializedRecognizedFormula[] {
  const result: SerializedRecognizedFormula[] = [];
  
  formulas.forEach(formula => {
    const recognized = recognizedMap.get(formula.id);
    if (recognized && recognized.status === 'done') {
      result.push({
        id: formula.id,
        latex: recognized.latex,
        markdown: recognized.markdown,
        status: 'done',
      });
    }
  });
  
  return result;
}

/**
 * 将序列化的识别结果恢复为 Map
 */
export function deserializeRecognizedFormulas(
  serialized: SerializedRecognizedFormula[]
): Map<string, { id: string; latex: string; markdown?: string; status: 'pending' | 'processing' | 'done' | 'error'; error?: string }> {
  const map = new Map<string, { id: string; latex: string; markdown?: string; status: 'pending' | 'processing' | 'done' | 'error'; error?: string }>();
  
  serialized.forEach(item => {
    map.set(item.id, {
      id: item.id,
      latex: item.latex,
      markdown: item.markdown,
      status: item.status,
      error: item.error,
    });
  });
  
  return map;
}

/**
 * 将 FormulaRegion[] 序列化为位置信息（不含 imageData）
 */
export function serializeDetectedFormulas(
  formulas: FormulaRegion[]
): SerializedDetectedFormula[] {
  return formulas.map(f => ({
    id: f.id,
    pageNumber: f.pageNumber,
    position: { ...f.position },
    originalPosition: { ...f.originalPosition },
    confidence: f.confidence,
    type: f.type,
    formulaType: f.formulaType,
    confidenceLevel: f.confidenceLevel,
  }));
}

/**
 * 从缓存位置 + pageImages 重建 FormulaRegion[]
 */
export function restoreDetectedFormulas(
  serialized: SerializedDetectedFormula[],
  pageImages: string[]
): FormulaRegion[] {
  const results: FormulaRegion[] = [];

  for (const s of serialized) {
    const pageImage = pageImages[s.pageNumber - 1];
    if (!pageImage) continue;

    results.push({
      id: s.id,
      pageNumber: s.pageNumber,
      imageData: '', // 延迟裁剪，由 viewer 按需提取
      position: { ...s.position },
      originalPosition: { ...s.originalPosition },
      confidence: s.confidence,
      type: s.type as FormulaRegion['type'],
      formulaType: s.formulaType as FormulaRegion['formulaType'],
      confidenceLevel: s.confidenceLevel as FormulaRegion['confidenceLevel'],
    });
  }

  return results;
}
