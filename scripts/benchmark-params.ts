#!/usr/bin/env tsx
/**
 * Parameter benchmark script.
 * Runs N games with two param sets on identical seeds and compares results.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark-params.ts --games 200
 *   pnpm tsx scripts/benchmark-params.ts --games 100 --verbose
 */

import { GameOrchestrator } from '../src/orchestration/GameOrchestrator';
import { gameStore } from '../src/store/gameStore';
import { settingsStore } from '../src/store/settingsStore';
import { chengduRulePack } from '../src/core/rules/packs/chengdu';
import { setAIParams, getAIParams, DEFAULT_PARAMS } from '../src/agents/algo/aiParams';
import type { AIParams } from '../src/agents/algo/aiParams';
import { extractMetrics } from '../src/training/metrics';
import { calculateFitness } from '../src/training/metrics';
import { testConfig } from '../src/config/testConfig';
import type { PlayerId } from '../src/core/model/types';

// ─── Expert param sets ───────────────────────────────────────

/** Balanced expert: moderate aggression, solid defense */
const EXPERT_BALANCED: AIParams = {
    xiangtingBase: 0.40,
    pimproveNStageA: 6,
    pimproveNStageB: 3,
    stageFactorB: 0.55,
    basePloseScale: 0.35,
    stageFactorPloseB: 1.6,
    stageFactorPloseC: 3.2,
    gangSideEffectK: 0.15,
    gangPenaltyBCMultiplier: 2.5,
    genbutsuRiskScale: 0.08,
    dingQueRiskScale: 0.40,
    meldSuitRiskScale: 1.6,
    turnRiskFactor: 0.012,
    baseWinValue: 1200,
    speedBonusK: 250,
    firstWinBonus: 600,
    stageDiscountB: 0.55,
    baseLoss: 1800,
    stageMultiplierA: 2.0,
    stageMultiplierB: 1.8,
    stageMultiplierC: 3.5,
    oppNotHuMultiplier: 1.6,
    oppMeldMultiplierK: 0.12,
    informationPenaltyPengA: 120,
    informationPenaltyPengB: 200,
    informationPenaltyGangA: 100,
    informationPenaltyGangB: 250,
};

/** Defensive expert: prioritise not dealing in */
const EXPERT_DEFENSIVE: AIParams = {
    xiangtingBase: 0.38,
    pimproveNStageA: 5,
    pimproveNStageB: 3,
    stageFactorB: 0.48,
    basePloseScale: 0.42,
    stageFactorPloseB: 1.8,
    stageFactorPloseC: 3.6,
    gangSideEffectK: 0.20,
    gangPenaltyBCMultiplier: 2.8,
    genbutsuRiskScale: 0.12,
    dingQueRiskScale: 0.45,
    meldSuitRiskScale: 1.8,
    turnRiskFactor: 0.015,
    baseWinValue: 1000,
    speedBonusK: 180,
    firstWinBonus: 450,
    stageDiscountB: 0.50,
    baseLoss: 1900,
    stageMultiplierA: 2.2,
    stageMultiplierB: 1.9,
    stageMultiplierC: 3.8,
    oppNotHuMultiplier: 1.7,
    oppMeldMultiplierK: 0.15,
    informationPenaltyPengA: 140,
    informationPenaltyPengB: 230,
    informationPenaltyGangA: 120,
    informationPenaltyGangB: 280,
};

/** Aggressive expert: race to win fast, less worried about dealing in */
const EXPERT_AGGRESSIVE: AIParams = {
    xiangtingBase: 0.45,
    pimproveNStageA: 7,
    pimproveNStageB: 4,
    stageFactorB: 0.65,
    basePloseScale: 0.25,
    stageFactorPloseB: 1.3,
    stageFactorPloseC: 2.6,
    gangSideEffectK: 0.10,
    gangPenaltyBCMultiplier: 1.8,
    genbutsuRiskScale: 0.06,
    dingQueRiskScale: 0.30,
    meldSuitRiskScale: 1.3,
    turnRiskFactor: 0.008,
    baseWinValue: 1400,
    speedBonusK: 280,
    firstWinBonus: 650,
    stageDiscountB: 0.65,
    baseLoss: 1300,
    stageMultiplierA: 1.7,
    stageMultiplierB: 1.5,
    stageMultiplierC: 3.0,
    oppNotHuMultiplier: 1.4,
    oppMeldMultiplierK: 0.08,
    informationPenaltyPengA: 90,
    informationPenaltyPengB: 160,
    informationPenaltyGangA: 70,
    informationPenaltyGangB: 180,
};

const PARAM_SETS: Record<string, AIParams> = {
    default: DEFAULT_PARAMS,
    'expert-balanced': EXPERT_BALANCED,
    'expert-defensive': EXPERT_DEFENSIVE,
    'expert-aggressive': EXPERT_AGGRESSIVE,
};

// ─── CLI parsing ─────────────────────────────────────────────

interface BenchConfig {
    games: number;
    verbose: boolean;
}

function parseArgs(): BenchConfig {
    const args = process.argv.slice(2);
    const config: BenchConfig = { games: 200, verbose: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--games' && args[i + 1]) { config.games = parseInt(args[++i], 10); }
        if (args[i] === '--verbose') { config.verbose = true; }
    }
    return config;
}

// ─── Game runner ─────────────────────────────────────────────

interface RunResult {
    winRate: number;
    firstHuRate: number;
    avgScore: number;
    dealInRate: number;    // avg deal-ins per game
    avgWinTurn: number;    // avg turn when winning
    avgFitness: number;
    drawRate: number;
    games: number;
}

const PLAYERS: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

async function runGames(
    params: AIParams,
    numGames: number,
    baseSeed: number,
    verbose: boolean,
): Promise<RunResult> {
    settingsStore.setP0IsAI(true);
    // DO NOT set trainingMode — it bypasses AI params entirely (uses fastDiscard)
    testConfig.trainingMode = false;

    setAIParams(params);

    let wins = 0;
    let firstHus = 0;
    let totalScore = 0;
    let totalDealIns = 0;
    let winTurnSum = 0;
    let winTurnCount = 0;
    let fitnessSum = 0;
    let draws = 0;

    // Suppress noisy game-engine logs during benchmark
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (() => { }) as typeof console.log;
    console.warn = (() => { }) as typeof console.warn;

    const orchestrator = new GameOrchestrator(chengduRulePack, undefined, gameStore, settingsStore, null);

    for (let i = 0; i < numGames; i++) {
        // Deterministic seed per game
        (globalThis as any).__trainingGameSeed = baseSeed + i * 1000003;
        orchestrator.startNewMatch('chengdu');
        // Override params AFTER startNewMatch (which loads from file)
        setAIParams(params);
        await waitEnd(orchestrator);

        const state = orchestrator.getState();
        if (!state) continue;

        // Pick a representative player for this game (rotate)
        const pid = PLAYERS[i % 4];
        const m = extractMetrics(state, pid);
        const f = calculateFitness(m);

        if (m.didWin) wins++;
        if (m.isFirstHu) firstHus++;
        totalScore += m.finalScore;
        totalDealIns += m.dealInCount;
        fitnessSum += f;
        if (m.didWin && m.winTurn > 0) { winTurnSum += m.winTurn; winTurnCount++; }
        if (m.result === 'DRAW') draws++;

        if (verbose && (i + 1) % 50 === 0) {
            const wr = ((wins / (i + 1)) * 100).toFixed(1);
            origLog(`  [${i + 1}/${numGames}] winRate=${wr}% avgScore=${(totalScore / (i + 1)).toFixed(0)}`);
        }
    }

    console.log = origLog;
    console.warn = origWarn;

    return {
        winRate: wins / numGames,
        firstHuRate: firstHus / numGames,
        avgScore: totalScore / numGames,
        dealInRate: totalDealIns / numGames,
        avgWinTurn: winTurnCount > 0 ? winTurnSum / winTurnCount : 0,
        avgFitness: fitnessSum / numGames,
        drawRate: draws / numGames,
        games: numGames,
    };
}

async function waitEnd(orch: GameOrchestrator): Promise<void> {
    return new Promise(resolve => {
        const timer = setInterval(() => {
            const s = orch.getState();
            if (!s || s.phase === 'END' || !orch.isRunning()) {
                clearInterval(timer);
                resolve();
            }
        }, 1);
    });
}

// ─── Pretty print ────────────────────────────────────────────

function printResult(name: string, r: RunResult) {
    console.log(`  ${name.padEnd(22)} | win ${(r.winRate * 100).toFixed(1).padStart(5)}% | 1st ${(r.firstHuRate * 100).toFixed(1).padStart(5)}% | score ${r.avgScore.toFixed(0).padStart(6)} | dealIn ${r.dealInRate.toFixed(2).padStart(5)} | turn ${r.avgWinTurn.toFixed(0).padStart(3)} | draw ${(r.drawRate * 100).toFixed(1).padStart(5)}% | fitness ${r.avgFitness.toFixed(0).padStart(6)}`);
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
    const config = parseArgs();
    const baseSeed = 42_000_000;

    console.log(`\n🎯 Parameter Benchmark — ${config.games} games per param set\n`);
    console.log('  Name                   | win     | 1st     | score        | dealIn      | turn    | draw     | fitness');
    console.log('  ' + '-'.repeat(110));

    const results: Record<string, RunResult> = {};

    for (const [name, params] of Object.entries(PARAM_SETS)) {
        const r = await runGames(params, config.games, baseSeed, config.verbose);
        results[name] = r;
        printResult(name, r);
    }

    // Also benchmark the currently trained params from ai-params.json
    try {
        const { loadParams } = await import('../src/training/paramPersistence');
        const trained = loadParams();
        if (trained.trainingState.currentStep > 0) {
            const r = await runGames(trained.params, config.games, baseSeed, config.verbose);
            results['trained (ai-params)'] = r;
            printResult('trained (ai-params)', r);
        }
    } catch { /* no file */ }

    // Find best
    let bestName = '';
    let bestFitness = -Infinity;
    for (const [name, r] of Object.entries(results)) {
        if (r.avgFitness > bestFitness) { bestFitness = r.avgFitness; bestName = name; }
    }
    console.log(`\n  🏆 Best: ${bestName} (avgFitness=${bestFitness.toFixed(0)})\n`);
}

main().catch(console.error);
