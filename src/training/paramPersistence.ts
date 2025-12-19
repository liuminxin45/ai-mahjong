/**
 * 参数持久化系统
 * 支持原子写入和版本管理
 */

import type { AIParams } from '../agents/algo/aiParams';
import { DEFAULT_PARAMS } from '../agents/algo/aiParams';
import * as fs from 'fs';

export interface TrainingState {
  bestParams: AIParams;
  bestFitness: number;
  currentStep: number;
  rngSeed: number;
  lastResult: {
    fitness: number;
    accepted: boolean;
    metrics: any;
  } | null;
}

export interface ParamsFile {
  version: string;
  params: AIParams;
  trainingState: TrainingState;
  updatedAt: string;
}

const PARAMS_FILE_PATH = './ai-params.json';
const PARAMS_FILE_TMP = './ai-params.json.tmp';

// 浏览器环境使用 localStorage
const isBrowser = typeof window !== 'undefined';

/**
 * 加载参数（每局开始前调用）
 */
export function loadParams(): ParamsFile {
  if (isBrowser) {
    const stored = localStorage.getItem('ai-params');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('[ParamPersistence] Failed to parse stored params, using default');
      }
    }
  } else {
    // Node 环境从文件读取
    try {
      if (fs.existsSync(PARAMS_FILE_PATH)) {
        const content = fs.readFileSync(PARAMS_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn('[ParamPersistence] Failed to load params file, using default');
    }
  }
  
  // 返回默认参数
  return {
    version: '1.0.0',
    params: { ...DEFAULT_PARAMS },
    trainingState: {
      bestParams: { ...DEFAULT_PARAMS },
      bestFitness: -Infinity,
      currentStep: 0,
      rngSeed: Date.now(),
      lastResult: null,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 保存参数（每局结束后调用）
 * 使用原子写入避免文件损坏
 */
export function saveParams(paramsFile: ParamsFile): void {
  paramsFile.updatedAt = new Date().toISOString();
  
  if (isBrowser) {
    localStorage.setItem('ai-params', JSON.stringify(paramsFile, null, 2));
    console.log('[ParamPersistence] Saved to localStorage, step:', paramsFile.trainingState.currentStep);
  } else {
    // Node 环境原子写入
    try {
      const content = JSON.stringify(paramsFile, null, 2);
      
      // 1. 写入临时文件
      fs.writeFileSync(PARAMS_FILE_TMP, content, 'utf-8');
      
      // 2. 原子重命名
      fs.renameSync(PARAMS_FILE_TMP, PARAMS_FILE_PATH);
      
      console.log('[ParamPersistence] Saved to file, step:', paramsFile.trainingState.currentStep);
    } catch (e) {
      console.error('[ParamPersistence] Failed to save params:', e);
    }
  }
}

/**
 * 重置参数到默认值
 */
export function resetParams(): void {
  const defaultFile = loadParams();
  defaultFile.params = { ...DEFAULT_PARAMS };
  defaultFile.trainingState.bestParams = { ...DEFAULT_PARAMS };
  defaultFile.trainingState.bestFitness = -Infinity;
  defaultFile.trainingState.currentStep = 0;
  saveParams(defaultFile);
}
