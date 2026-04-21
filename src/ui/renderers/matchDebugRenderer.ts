import type { UiCtx } from '../context';
import { renderHand } from '../components/handView';
import { renderEventLog } from '../components/eventLogView';
import type { Action } from '../../core/model/action';
import type { Tile } from '../../core/model/tile';
import { makeAgentStyleContext, styleBadgeText } from '../../agents/algo/style';
import { languageStore } from '../../store/languageStore';

export function renderDebugMode(
  root: HTMLElement,
  ctx: UiCtx,
  lastLlmState: {
    key: string | null;
    text: string | null;
    inFlight: boolean;
  }
): void {
  const t = languageStore.t().debug;
  const s = ctx.gameStore.state;
  const evs = ctx.gameStore.events;

  if (!s) {
    root.innerHTML = `<div>${t.noMatchRunning}</div>`;
    return;
  }

  root.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'debug-info';

  const cur = document.createElement('div');
  cur.textContent = `${t.current}: ${s.currentPlayer} | ${t.turn}: ${s.turn} | ${t.wall}: ${s.wall.length}`;

  const disc = document.createElement('div');
  disc.textContent = `${t.discards}: P0=${s.discards.P0.length} P1=${s.discards.P1.length} P2=${s.discards.P2.length} P3=${s.discards.P3.length}`;

  info.appendChild(cur);
  info.appendChild(disc);

  const p0Style = makeAgentStyleContext(s, 'P0');
  const styleDiv = document.createElement('div');
  styleDiv.textContent = `${t.style}: ${styleBadgeText(p0Style.style)} (${p0Style.style})`;
  info.appendChild(styleDiv);

  const layout = document.createElement('div');
  layout.className = 'debug-layout';

  const left = document.createElement('div');
  const right = document.createElement('div');

  const hTitle = document.createElement('h3');
  hTitle.textContent = t.handTitle;
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
    title.textContent = t.responseToDiscard(s.lastDiscard.from);
    title.className = 'debug-title';
    reactionWrap.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.className = 'debug-btn-row';

    const order: Array<Action['type']> = ['HU', 'GANG', 'PENG', 'PASS'];
    for (const t of order) {
      const act = p0Reactions.find((a) => a.type === t);
      if (!act) continue;
      const b = document.createElement('button');
      b.className = 'debug-btn';
      b.textContent = act.type;
      b.onclick = () => ctx.orchestrator.dispatchHumanAction(act);
      btnRow.appendChild(b);
    }

    reactionWrap.appendChild(btnRow);

    if (ctx.settingsStore.analysisEnabled) {
      const a = document.createElement('div');
      a.className = 'debug-pre';
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
    title.textContent = t.recommendTop3;
    title.className = 'debug-title debug-title--strong';
    analysisWrap.appendChild(title);

    for (const r of recs) {
      const row = document.createElement('div');
      row.className = 'debug-row';
      row.textContent = t.recommendLine(r.discard, r.shantenBefore, r.shantenAfter, r.ukeireTotal, r.dangerLevel);
      analysisWrap.appendChild(row);

      if (r.dangerReasons.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'debug-list';
        for (const reason of r.dangerReasons) {
          const li = document.createElement('li');
          li.textContent = reason;
          ul.appendChild(li);
        }
        analysisWrap.appendChild(ul);
      }
    }

    const warning = document.createElement('div');
    warning.className = 'debug-pre debug-pre--gap';
    warning.textContent = ctx.analyzer.analyzeHand(s.hands.P0, meldCountP0, {
      state: s,
      playerId: 'P0',
      style: { style: p0Style.style, reasons: p0Style.styleReasons },
    });
    analysisWrap.appendChild(warning);

    if (ctx.settingsStore.llmEnabled) {
      const details = document.createElement('details');
      details.className = 'debug-details';
      const summary = document.createElement('summary');
      summary.textContent = t.tacticalExplain;
      details.appendChild(summary);

      const box = document.createElement('div');
      box.className = 'debug-pre debug-pre--gap';
      details.appendChild(box);

      const wallN = s.wall.length;
      const phase = wallN <= 16 ? t.phaseLate : wallN <= 28 ? t.phaseMid : t.phaseEarly;
      const stateSummary = t.stateSummary(phase, wallN, meldCountP0);

      const key = `${stateSummary}|${recs
        .map((r) => `${r.discard}:${r.shantenAfter}:${r.ukeireTotal}:${r.dangerLevel}`)
        .join('|')}`;

      if (!ctx.llmAnalyzer) {
        box.textContent = t.llmUnavailable;
      } else {
        if (lastLlmState.key === key && lastLlmState.text) {
          box.textContent = lastLlmState.text;
        } else {
          box.textContent = t.generating;

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
                lastLlmState.text = t.llmUnavailableShort;
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
  eTitle.textContent = t.eventLog;
  right.appendChild(eTitle);
  right.appendChild(renderEventLog(evs));

  layout.appendChild(left);
  layout.appendChild(right);

  root.appendChild(info);
  root.appendChild(layout);
}
