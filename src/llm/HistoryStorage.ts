/**
 * 历史记录存储系统
 * 使用 IndexedDB 永久保存用户对局历史
 */

import type { GameRecord, GameHistory, UserProfile } from './types';

const DB_NAME = 'ai-mahjong-db';
const DB_VERSION = 1;

// Store names
const STORES = {
  GAMES: 'games',
  PROFILE: 'profile',
  REVIEWS: 'reviews',
  QA_HISTORY: 'qa_history',
};

/**
 * 打开数据库
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建游戏记录存储
      if (!db.objectStoreNames.contains(STORES.GAMES)) {
        const gamesStore = db.createObjectStore(STORES.GAMES, { keyPath: 'gameId' });
        gamesStore.createIndex('timestamp', 'timestamp', { unique: false });
        gamesStore.createIndex('result', 'result', { unique: false });
      }
      
      // 创建用户画像存储
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'userId' });
      }
      
      // 创建复盘记录存储
      if (!db.objectStoreNames.contains(STORES.REVIEWS)) {
        const reviewsStore = db.createObjectStore(STORES.REVIEWS, { keyPath: 'reviewId', autoIncrement: true });
        reviewsStore.createIndex('gameId', 'gameId', { unique: false });
        reviewsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // 创建问答历史存储
      if (!db.objectStoreNames.contains(STORES.QA_HISTORY)) {
        const qaStore = db.createObjectStore(STORES.QA_HISTORY, { keyPath: 'sessionId' });
        qaStore.createIndex('timestamp', 'lastActivity', { unique: false });
      }
    };
  });
}

/**
 * 历史存储类
 */
export class HistoryStorage {
  private db: IDBDatabase | null = null;
  private userId: string;
  
  constructor(userId: string = 'default_user') {
    this.userId = userId;
  }
  
  /**
   * 初始化数据库连接
   */
  async init(): Promise<void> {
    if (!this.db) {
      this.db = await openDB();
    }
  }
  
  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }
  
  // ============ 游戏记录 ============
  
  /**
   * 保存游戏记录
   */
  async saveGame(record: GameRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.GAMES, 'readwrite');
      const store = transaction.objectStore(STORES.GAMES);
      const request = store.put(record);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  
  /**
   * 获取单个游戏记录
   */
  async getGame(gameId: string): Promise<GameRecord | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.GAMES, 'readonly');
      const store = transaction.objectStore(STORES.GAMES);
      const request = store.get(gameId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  
  /**
   * 获取所有游戏记录
   */
  async getAllGames(): Promise<GameRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.GAMES, 'readonly');
      const store = transaction.objectStore(STORES.GAMES);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }
  
  /**
   * 获取最近N局游戏
   */
  async getRecentGames(count: number = 10): Promise<GameRecord[]> {
    const all = await this.getAllGames();
    return all
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count);
  }
  
  /**
   * 删除游戏记录
   */
  async deleteGame(gameId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.GAMES, 'readwrite');
      const store = transaction.objectStore(STORES.GAMES);
      const request = store.delete(gameId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  
  /**
   * 获取游戏历史统计
   */
  async getGameHistory(): Promise<GameHistory> {
    const games = await this.getAllGames();
    
    const wins = games.filter(g => g.result === 'win').length;
    const losses = games.filter(g => g.result === 'lose').length;
    const draws = games.filter(g => g.result === 'draw').length;
    
    // 计算连胜
    let bestStreak = 0;
    let currentStreak = 0;
    const sortedGames = [...games].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    for (const game of sortedGames) {
      if (game.result === 'win') {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    // 最近一局的连胜
    let recentStreak = 0;
    for (let i = sortedGames.length - 1; i >= 0; i--) {
      if (sortedGames[i].result === 'win') {
        recentStreak++;
      } else {
        break;
      }
    }
    
    return {
      version: '1.0.0',
      userId: this.userId,
      games,
      aggregateStats: {
        totalGames: games.length,
        wins,
        losses,
        draws,
        winRate: games.length > 0 ? wins / games.length : 0,
        avgScore: games.length > 0 
          ? games.reduce((sum, g) => sum + g.score, 0) / games.length 
          : 0,
        bestStreak,
        currentStreak: recentStreak,
      },
    };
  }
  
  // ============ 用户画像 ============
  
  /**
   * 保存用户画像
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROFILE, 'readwrite');
      const store = transaction.objectStore(STORES.PROFILE);
      const request = store.put(profile);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
  
  /**
   * 获取用户画像
   */
  async getProfile(): Promise<UserProfile | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROFILE, 'readonly');
      const store = transaction.objectStore(STORES.PROFILE);
      const request = store.get(this.userId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  
  // ============ 统计计算 ============
  
  /**
   * 计算用于LLM分析的统计数据
   */
  async calculateStatsForAnalysis(): Promise<{
    totalGames: number;
    winRate: number;
    avgDealIn: number;
    avgShanten: number;
    meldFrequency: number;
    commonMistakes: string[];
  }> {
    const games = await this.getAllGames();
    
    if (games.length === 0) {
      return {
        totalGames: 0,
        winRate: 0,
        avgDealIn: 0,
        avgShanten: 3,
        meldFrequency: 0,
        commonMistakes: [],
      };
    }
    
    const wins = games.filter(g => g.result === 'win').length;
    const totalDealIn = games.reduce((sum, g) => sum + (g.stats?.dealInCount || 0), 0);
    const totalShanten = games.reduce((sum, g) => sum + (g.stats?.finalShanten || 3), 0);
    const totalMelds = games.reduce((sum, g) => sum + (g.stats?.meldCount || 0), 0);
    
    return {
      totalGames: games.length,
      winRate: wins / games.length,
      avgDealIn: totalDealIn / games.length,
      avgShanten: totalShanten / games.length,
      meldFrequency: totalMelds / games.length / 4, // 假设最多4次副露
      commonMistakes: [], // TODO: 从复盘中提取
    };
  }
  
  // ============ 数据导出/导入 ============
  
  /**
   * 导出所有数据为JSON
   */
  async exportData(): Promise<string> {
    const history = await this.getGameHistory();
    const profile = await this.getProfile();
    
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      history,
      profile,
    }, null, 2);
  }
  
  /**
   * 从JSON导入数据
   */
  async importData(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    
    if (data.history?.games) {
      for (const game of data.history.games) {
        await this.saveGame(game);
      }
    }
    
    if (data.profile) {
      await this.saveProfile(data.profile);
    }
  }
  
  /**
   * 清除所有数据
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    
    const transaction = db.transaction(
      [STORES.GAMES, STORES.PROFILE, STORES.REVIEWS, STORES.QA_HISTORY],
      'readwrite'
    );
    
    transaction.objectStore(STORES.GAMES).clear();
    transaction.objectStore(STORES.PROFILE).clear();
    transaction.objectStore(STORES.REVIEWS).clear();
    transaction.objectStore(STORES.QA_HISTORY).clear();
  }
}

// 导出单例
export const historyStorage = new HistoryStorage();
