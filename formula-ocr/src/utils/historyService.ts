/**
 * 历史记录服务 - 使用 IndexedDB 存储识别历史
 */

export interface HistoryItem {
  id: string;
  imageBase64: string;
  latex: string;
  createdAt: number;
  source?: string;
  isFavorite: boolean;
}

export interface HistoryStats {
  totalCount: number;
  monthCount: number;
  favoriteCount: number;
}

const DB_NAME = 'formula-ocr-history';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let dbInstance: IDBDatabase | null = null;

/**
 * 初始化 IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
        store.createIndex('source', 'source', { unique: false });
      }
    };
  });
}

/**
 * 添加历史记录
 */
export async function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt' | 'isFavorite'>): Promise<HistoryItem> {
  const db = await initDB();
  
  const historyItem: HistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    createdAt: Date.now(),
    isFavorite: false,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(historyItem);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(historyItem);
  });
}


/**
 * 获取所有历史记录
 */
export async function getAllHistory(): Promise<HistoryItem[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev'); // 按时间倒序

    const items: HistoryItem[] = [];
    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
  });
}

/**
 * 获取收藏的历史记录
 */
export async function getFavorites(): Promise<HistoryItem[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('isFavorite');
    const request = index.getAll(IDBKeyRange.only(true));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result as HistoryItem[];
      // 按时间倒序排列
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
  });
}

/**
 * 搜索历史记录
 */
export async function searchHistory(options: {
  query?: string;
  startDate?: number;
  endDate?: number;
  favoritesOnly?: boolean;
}): Promise<HistoryItem[]> {
  const allItems = await getAllHistory();
  
  return allItems.filter(item => {
    // 日期范围过滤
    if (options.startDate && item.createdAt < options.startDate) return false;
    if (options.endDate && item.createdAt > options.endDate) return false;
    
    // 收藏过滤
    if (options.favoritesOnly && !item.isFavorite) return false;
    
    // 内容搜索
    if (options.query) {
      const query = options.query.toLowerCase();
      const matchLatex = item.latex.toLowerCase().includes(query);
      const matchSource = item.source?.toLowerCase().includes(query);
      if (!matchLatex && !matchSource) return false;
    }
    
    return true;
  });
}

/**
 * 切换收藏状态
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const item = getRequest.result as HistoryItem;
      if (!item) {
        reject(new Error('History item not found'));
        return;
      }

      item.isFavorite = !item.isFavorite;
      const putRequest = store.put(item);
      
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve(item.isFavorite);
    };
  });
}

/**
 * 删除历史记录
 */
export async function deleteHistory(id: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 批量删除历史记录
 */
export async function deleteHistoryBatch(ids: string[]): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let completed = 0;
    let hasError = false;

    ids.forEach(id => {
      const request = store.delete(id);
      request.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(request.error);
        }
      };
      request.onsuccess = () => {
        completed++;
        if (completed === ids.length && !hasError) {
          resolve();
        }
      };
    });

    if (ids.length === 0) resolve();
  });
}

/**
 * 清空所有历史记录
 */
export async function clearAllHistory(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * 获取使用统计
 */
export async function getStats(): Promise<HistoryStats> {
  const allItems = await getAllHistory();
  
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartTime = monthStart.getTime();

  return {
    totalCount: allItems.length,
    monthCount: allItems.filter(item => item.createdAt >= monthStartTime).length,
    favoriteCount: allItems.filter(item => item.isFavorite).length,
  };
}

/**
 * 导出历史记录
 */
export async function exportHistory(ids?: string[]): Promise<HistoryItem[]> {
  if (ids && ids.length > 0) {
    const db = await initDB();
    const items: HistoryItem[] = [];

    for (const id of ids) {
      const item = await new Promise<HistoryItem | undefined>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });

      if (item) items.push(item);
    }

    return items;
  }

  return getAllHistory();
}
