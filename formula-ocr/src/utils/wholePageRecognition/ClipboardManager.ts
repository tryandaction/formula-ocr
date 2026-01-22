/**
 * 剪贴板管理器
 * 负责管理剪贴板操作，支持现代API和降级方案
 */

import { ClipboardError } from './errors';

/**
 * 剪贴板管理器实现
 */
export class ClipboardManager {
  /**
   * 复制文本到剪贴板
   * 优先使用现代Clipboard API，失败时降级到传统方法
   * 
   * @param text - 要复制的文本
   * @returns 是否成功
   */
  async copyText(text: string): Promise<boolean> {
    // 方法1: 尝试现代Clipboard API
    if (this.isModernAPIAvailable()) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.warn('Modern Clipboard API failed, trying fallback', error);
      }
    }

    // 方法2: 降级到传统execCommand方法
    return this.copyTextLegacy(text);
  }

  /**
   * 复制图像到剪贴板
   * 
   * @param imageData - 要复制的图像（base64格式）
   * @returns 是否成功
   */
  async copyImage(imageData: string): Promise<boolean> {
    if (!this.isModernAPIAvailable()) {
      throw new ClipboardError(
        'Image copy requires modern Clipboard API',
        'api_not_available'
      );
    }

    try {
      // 将base64转换为Blob
      const blob = await this.base64ToBlob(imageData);
      
      // 创建ClipboardItem
      const item = new ClipboardItem({ [blob.type]: blob });
      
      // 写入剪贴板
      await navigator.clipboard.write([item]);
      return true;
    } catch (error) {
      throw new ClipboardError(
        'Failed to copy image',
        'image_copy_failed'
      );
    }
  }

  /**
   * 检查剪贴板API是否可用
   * 
   * @returns 是否可用
   */
  isAvailable(): boolean {
    return this.isModernAPIAvailable() || this.isLegacyAPIAvailable();
  }

  /**
   * 检查现代Clipboard API是否可用
   */
  private isModernAPIAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.clipboard !== 'undefined' &&
      typeof navigator.clipboard.writeText === 'function'
    );
  }

  /**
   * 检查传统API是否可用
   */
  private isLegacyAPIAvailable(): boolean {
    return typeof document !== 'undefined' && 
           typeof document.execCommand === 'function';
  }

  /**
   * 使用传统方法复制文本
   */
  private copyTextLegacy(text: string): boolean {
    if (!this.isLegacyAPIAvailable()) {
      throw new ClipboardError(
        'No clipboard API available',
        'no_api_available'
      );
    }

    try {
      // 创建临时textarea元素
      const textarea = document.createElement('textarea');
      textarea.value = text;
      
      // 设置样式使其不可见
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      
      // 添加到DOM
      document.body.appendChild(textarea);
      
      // 选择文本
      textarea.select();
      textarea.setSelectionRange(0, text.length);
      
      // 执行复制命令
      const success = document.execCommand('copy');
      
      // 清理
      document.body.removeChild(textarea);
      
      if (!success) {
        throw new ClipboardError(
          'execCommand copy failed',
          'legacy_api_failed'
        );
      }
      
      return true;
    } catch (error) {
      if (error instanceof ClipboardError) {
        throw error;
      }
      throw new ClipboardError(
        'Legacy copy method failed',
        'legacy_method_failed'
      );
    }
  }

  /**
   * 将base64字符串转换为Blob
   */
  private async base64ToBlob(base64: string): Promise<Blob> {
    // 移除data URL前缀（如果存在）
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    
    // 解码base64
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 检测MIME类型
    const mimeType = this.detectMimeType(base64);
    
    return new Blob([bytes], { type: mimeType });
  }

  /**
   * 检测图像MIME类型
   */
  private detectMimeType(base64: string): string {
    if (base64.startsWith('data:image/png')) return 'image/png';
    if (base64.startsWith('data:image/jpeg')) return 'image/jpeg';
    if (base64.startsWith('data:image/jpg')) return 'image/jpeg';
    if (base64.startsWith('data:image/gif')) return 'image/gif';
    if (base64.startsWith('data:image/webp')) return 'image/webp';
    
    // 默认PNG
    return 'image/png';
  }
}
