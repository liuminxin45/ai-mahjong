import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderEventLog } from '../components/eventLogView';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import { makeAgentStyleContext, styleBadgeText } from '../../agents/algo/style';

export function renderDebugMode(
  root: HTMLElement,
  ctx: UiCtx,
  lastLlmState: {
    key: string | null;
    text: string | null;
    inFlight: boolean;
  }
): void {
  const s = ctx.gameStore.state;
  const evs = ctx.gameStore.events;

  if (!s) {
    root.innerHTML = '<div>No match running.</div>';
    return;
  }

  root.innerHTML = '';

  const info = document.createElement('div');
  info.style.display = 'flex';
  info.style.gap = '12px';
  info.style.alignItems = 'center';
  info.style.marginBottom = '12px';
  info.style.color = 'var(--text-secondary)';

  const cur = document.createElement('div');
  cur.textContent = `Current: ${s.currentPlayer} | Turn: ${s.turn} | Wall: ${s.wall.length}`;

  const disc = document.createElement('div');
  disc.textContent = `Discards: P0=${s.discards.P0.length} P1=${s.discards.P1.length} P2=${s.discards.P2.length} P3=${s.discards.P3.length}`;

  info.appendChild(cur);
  info.appendChild(disc);

  const p0Style = makeAgentStyleContext(s, 'P0');
  const styleDiv = document.createElement('div');
  styleDiv.textContent = `Style: ${styleBadgeText(p0Style.style)} (${p0Style.style})`;
  info.appendChild(styleDiv);

  const layout = document.createElement('div');
  layout.style.display = 'grid';
  layout.style.gridTemplateColumns = '1fr 1fr';
  layout.style.gap = '12px';

  const left = document.createElement('div');
  const right = document.createElement('div');

  const hTitle = document.createElement('h3');
  hTitle.textContent = 'P0 Hand (click to discard)';
  left.appendChild(hTitle);

  const handWrap = document.createElement('div');
  const reactionWrap = document.createElement('div');
  const analysisWrap = document.createElement('div');

  const meldCountP0 = s.melds.P0.length;
  const baseP0 = 13 - meldCountP0 * 3;
  const canDiscard = !s.lastDiscard && s.currentPlayer === 'P0' && s.hands.P0.length === baseP0 + 1;
  const onClick = canDiscard
    ? (tile: Tile) => {
      const action: Action = { type: 'DISCARD', tile };
      ctx.orchestrator.dispatchHumanAction(action);
    }
    : undefined;

  left.appendChild(handWrap);

  const p0Legal = ctx.orchestrator.getLegalActions('P0');
  const p0Reactions = p0Legal.filter((a) => a.type === 'PASS' || a.type === 'PENG' || a.type === 'GANG' || a.type === 'HU');
  const reactionTargetTiles =
    s.lastDiscard && s.lastDiscard.from !== 'P0'
      ? p0Reactions
        .filter((a) => a.type === 'PENG' || a.type === 'GANG')
        .map((a) => a.tile)
      : [];

  handWrap.innerHTML = '';
  handWrap.appendChild(renderHand(s.hands.P0, onClick, undefined, reactionTargetTiles));

  if (s.lastDiscard && s.lastDiscard.from !== 'P0' && p0Reactions.length > 0) {
    const title = document.createElement('div');
    title.textContent = `Response to ${s.lastDiscard.from} discard`;
    title.style.marginTop = '8px';
    reactionWrap.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';

    const order: Array<Action['type']> = ['HU', 'GANG', 'PENG', 'PASS'];
    for (const t of order) {
      const act = p0Reactions.find((a) => a.type === t);
      if (!act) continue;
      const b = document.createElement('button');
      b.textContent = act.type;
      b.onclick = () => ctx.orchestrator.dispatchHumanAction(act);
      btnRow.appendChild(b);
    }

    reactionWrap.appendChild(btnRow);

    if (ctx.settingsStore.analysisEnabled) {
      const a = document.createElement('div');
      a.style.whiteSpace = 'pre-wrap';
      const meldCount = s.melds.P0.length;
      a.textContent = ctx.analyzer.analyzeReactions(s.hands.P0, meldCount, p0Reactions, s.lastDiscard.tile);
      reactionWrap.appendChild(a);
    }
  }

  left.appendChild(reactionWrap);

  if (ctx.settingsStore.analysisEnabled && !s.lastDiscard && s.currentPlayer === 'P0' && s.hands.P0.length === baseP0 + 1) {
    const recs = ctx.analyzer.recommendDiscards(s.hands.P0, meldCountP0, {
      state: s,
      playerId: 'P0',
      style: { style: p0Style.style, reasons: p0Style.styleReasons },
    });

    const title = document.createElement('div');
    title.textContent = '推荐出牌 Top3';
    title.style.fontWeight = '600';
    analysisWrap.appendChild(title);

    for (const r of recs) {
      const row = document.createElement('div');
      row.style.marginTop = '6px';
      row.textContent = `打 ${r.discard}：向听 ${r.shantenBefore}->${r.shantenAfter}，有效牌 ${r.ukeireTotal}，风险 ${r.dangerLevel}`;
      analysisWrap.appendChild(row);

      if (r.dangerReasons.length > 0) {
        const ul = document.createElement('ul');
        ul.style.margin = '4px 0 0 18px';
        for (const reason of r.dangerReasons) {
          const li = document.createElement('li');
          li.textContent = reason;
          ul.appendChild(li);
        }
        analysisWrap.appendChild(ul);
      }
    }

    const warning = document.createElement('div');
    warning.style.whiteSpace = 'pre-wrap';
    warning.style.marginTop = '8px';
    warning.textContent = ctx.analyzer.analyzeHand(s.hands.P0, meldCountP0, {
      state: s,
      playerId: 'P0',
      style: { style: p0Style.style, reasons: p0Style.styleReasons },
    });
    analysisWrap.appendChild(warning);

    if (ctx.settingsStore.llmEnabled) {
      const details = document.createElement('details');
      details.style.marginTop = '10px';
      const summary = document.createElement('summary');
      summary.textContent = 'AI 战术解释';
      details.appendChild(summary);

      const box = document.createElement('div');
      box.style.whiteSpace = 'pre-wrap';
      box.style.marginTop = '6px';
      details.appendChild(box);

      const wallN = s.wall.length;
      const phase = wallN <= 16 ? '后巡' : wallN <= 28 ? '中巡' : '早巡';
      const stateSummary = `${phase}，wall=${wallN}，玩家碰杠=${meldCountP0} 组`;

      const key = `${stateSummary}|${recs
        .map((r) => `${r.discard}:${r.shantenAfter}:${r.ukeireTotal}:${r.dangerLevel}`)
        .join('|')}`;

      if (!ctx.llmAnalyzer) {
        box.textContent = 'AI 解释暂不可用（未配置 LLM）。';
      } else {
        if (lastLlmState.key === key && lastLlmState.text) {
          box.textContent = lastLlmState.text;
        } else {
          box.textContent = lastLlmState.inFlight ? '生成中…' : '生成中…';

          if (!lastLlmState.inFlight || lastLlmState.key !== key) {
            lastLlmState.key = key;
            lastLlmState.text = null;
            lastLlmState.inFlight = true;
            void ctx.llmAnalyzer
              .explainDecision({ recommendations: recs, stateSummary })
              .then((txt) => {
                lastLlmState.text = txt;
              })
              .catch(() => {
                lastLlmState.text = 'AI 解释暂不可用';
              })
              .finally(() => {
                lastLlmState.inFlight = false;
              });
          }
        }
      }

      analysisWrap.appendChild(details);
    }
  }

  left.appendChild(analysisWrap);

  const eTitle = document.createElement('h3');
  eTitle.textContent = 'Event Log';
  right.appendChild(eTitle);
  right.appendChild(renderEventLog(evs));

  layout.appendChild(left);
  layout.appendChild(right);

  root.appendChild(info);
  root.appendChild(layout);
}
