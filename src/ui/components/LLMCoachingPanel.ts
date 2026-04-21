import type { Action } from '../../core/model/action';
import type { GameState } from '../../core/model/state';
import type { GuidanceLevel } from '../../llm/types';
import {
  clearCoachAdvice,
  renderLLMChatAssistant,
  setCoachGuidanceLevel,
} from './LLMChatAssistant';

export function renderLLMCoachingPanel(
  state: GameState,
  legalActions: Action[],
  _onRequestAdvice?: () => void,
): HTMLElement {
  return renderLLMChatAssistant({ gameState: state, legalActions });
}

export function clearCoachingAdvice(): void {
  clearCoachAdvice();
}

export function setGuidanceLevel(level: GuidanceLevel): void {
  setCoachGuidanceLevel(level);
}
