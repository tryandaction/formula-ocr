/**
 * 简单的文本差异计算工具
 * 用于高亮显示 LaTeX 编辑前后的差异
 */

export interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

/**
 * 计算两个字符串之间的差异
 * 使用简化的 LCS (Longest Common Subsequence) 算法
 */
export function computeDiff(original: string, modified: string): DiffSegment[] {
  if (original === modified) {
    return [{ type: 'unchanged', text: original }];
  }

  if (!original) {
    return [{ type: 'added', text: modified }];
  }

  if (!modified) {
    return [{ type: 'removed', text: original }];
  }

  // 简化处理：按字符级别比较
  const result: DiffSegment[] = [];
  const lcs = longestCommonSubsequence(original, modified);
  
  let origIdx = 0;
  let modIdx = 0;
  let lcsIdx = 0;

  while (origIdx < original.length || modIdx < modified.length) {
    // 收集删除的字符
    let removed = '';
    while (origIdx < original.length && 
           (lcsIdx >= lcs.length || original[origIdx] !== lcs[lcsIdx])) {
      removed += original[origIdx];
      origIdx++;
    }
    if (removed) {
      result.push({ type: 'removed', text: removed });
    }

    // 收集添加的字符
    let added = '';
    while (modIdx < modified.length && 
           (lcsIdx >= lcs.length || modified[modIdx] !== lcs[lcsIdx])) {
      added += modified[modIdx];
      modIdx++;
    }
    if (added) {
      result.push({ type: 'added', text: added });
    }

    // 收集未变化的字符
    let unchanged = '';
    while (lcsIdx < lcs.length && 
           origIdx < original.length && 
           modIdx < modified.length &&
           original[origIdx] === lcs[lcsIdx] && 
           modified[modIdx] === lcs[lcsIdx]) {
      unchanged += lcs[lcsIdx];
      origIdx++;
      modIdx++;
      lcsIdx++;
    }
    if (unchanged) {
      result.push({ type: 'unchanged', text: unchanged });
    }
  }

  // 合并相邻的相同类型段
  return mergeAdjacentSegments(result);
}

/**
 * 计算最长公共子序列
 */
function longestCommonSubsequence(str1: string, str2: string): string {
  const m = str1.length;
  const n = str2.length;
  
  // 创建 DP 表
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 填充 DP 表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // 回溯找出 LCS
  let lcs = '';
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs = str1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

/**
 * 合并相邻的相同类型段
 */
function mergeAdjacentSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];
  
  const result: DiffSegment[] = [segments[0]];
  
  for (let i = 1; i < segments.length; i++) {
    const last = result[result.length - 1];
    const current = segments[i];
    
    if (last.type === current.type) {
      last.text += current.text;
    } else {
      result.push(current);
    }
  }
  
  return result;
}

/**
 * 检查两个字符串是否有差异
 */
export function hasDiff(original: string, modified: string): boolean {
  return original !== modified;
}

/**
 * 获取差异统计
 */
export function getDiffStats(original: string, modified: string): {
  added: number;
  removed: number;
  unchanged: number;
} {
  const diff = computeDiff(original, modified);
  
  return diff.reduce((stats, segment) => {
    stats[segment.type] += segment.text.length;
    return stats;
  }, { added: 0, removed: 0, unchanged: 0 });
}
