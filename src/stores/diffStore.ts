import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { DiffEntry, JudgmentType, ScanStatus, VerificationReport } from '@/types';
import { computeCharDiff } from '@/utils/diffEngine';
import { matchRulesToDiffs } from '@/utils/ruleMatcher';
import { useRuleStore } from './ruleStore';
import { useTextStore } from './textStore';

const DIFF_KEY = 'ancientscrutiny_diffs_v1';

export const useDiffStore = defineStore('diff', () => {
  const entries = ref<DiffEntry[]>([]);
  const scanStatus = ref<ScanStatus>('idle');
  const scannedAt = ref<number | null>(null);
  const selectedId = ref<string | null>(null);
  const lastInvalidation = ref<{ type: 'rule' | 'text'; message: string; at: number } | null>(null);

  function load() {
    try {
      const raw = localStorage.getItem(DIFF_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        entries.value = data.entries || [];
        scanStatus.value = data.scanStatus || 'idle';
        scannedAt.value = data.scannedAt || null;
        selectedId.value = entries.value[0]?.id || null;
      }
    } catch {
      entries.value = [];
    }
  }

  function persist() {
    localStorage.setItem(
      DIFF_KEY,
      JSON.stringify({
        entries: entries.value,
        scanStatus: scanStatus.value,
        scannedAt: scannedAt.value,
      }),
    );
  }

  async function runScan(): Promise<{ ok: boolean; error?: string; count?: number }> {
    const textStore = useTextStore();
    const ruleStore = useRuleStore();
    if (!textStore.originalText.trim() || !textStore.revisedText.trim()) {
      return { ok: false, error: '原文和校改文本均不可为空，请先填写文本。' };
    }
    scanStatus.value = 'scanning';
    await new Promise((r) => setTimeout(r, 80));
    try {
      const raw = computeCharDiff(textStore.originalText, textStore.revisedText);
      entries.value = matchRulesToDiffs(raw, ruleStore.rules);
      scanStatus.value = 'done';
      scannedAt.value = Date.now();
      selectedId.value = entries.value[0]?.id || null;
      ruleStore.acknowledgeChange();
      persist();
      return { ok: true, count: entries.value.length };
    } catch (e: any) {
      scanStatus.value = 'idle';
      return { ok: false, error: e?.message || '扫描失败' };
    }
  }

  function invalidateDiffs(reason: 'rule' | 'text' = 'rule') {
    if (scanStatus.value === 'idle' && entries.value.length === 0) return;
    const hadData = entries.value.length > 0;
    const message =
      reason === 'rule'
        ? '避讳字规则表已修改，已清空旧的扫描结果与判断，请重新执行差异扫描。'
        : '原文或校改文本已变动，已清空旧的扫描结果与判断，请重新执行差异扫描。';
    entries.value = [];
    scanStatus.value = 'idle';
    scannedAt.value = null;
    selectedId.value = null;
    localStorage.removeItem(DIFF_KEY);
    if (hadData) {
      lastInvalidation.value = { type: reason, message, at: Date.now() };
    }
    return { hadData, message };
  }

  function clearDiffs() {
    entries.value = [];
    scanStatus.value = 'idle';
    scannedAt.value = null;
    selectedId.value = null;
    localStorage.removeItem(DIFF_KEY);
  }

  function setSelected(id: string | null) {
    selectedId.value = id;
  }

  function setJudgment(id: string, judgment: JudgmentType, note?: string) {
    const d = entries.value.find((x) => x.id === id);
    if (!d) return;
    d.judgment = judgment;
    if (note !== undefined) d.judgmentNote = note.trim() || undefined;
    persist();
  }

  function clearJudgment(id: string) {
    const d = entries.value.find((x) => x.id === id);
    if (!d) return;
    d.judgment = null;
    d.judgmentNote = undefined;
    persist();
  }

  const selectedEntry = computed(() => entries.value.find((d) => d.id === selectedId.value) || null);

  const statistics = computed(() => {
    const total = entries.value.length;
    const stats = { taboo: 0, error: 0, variant: 0, pending: 0, unjudged: 0 };
    for (const d of entries.value) {
      if (d.judgment === 'taboo') stats.taboo++;
      else if (d.judgment === 'error') stats.error++;
      else if (d.judgment === 'variant') stats.variant++;
      else if (d.judgment === 'pending') stats.pending++;
      else stats.unjudged++;
    }
    return { total, ...stats, judged: total - stats.unjudged };
  });

  const allJudged = computed(
    () =>
      scanStatus.value === 'done' &&
      entries.value.length > 0 &&
      statistics.value.unjudged === 0,
  );

  const matchedCount = computed(() => entries.value.filter((d) => !!d.matchedRuleId).length);

  function buildReport(): VerificationReport | null {
    const textStore = useTextStore();
    if (!allJudged.value) return null;
    return {
      generatedAt: Date.now(),
      originalSummary: textStore.originalText.slice(0, 30) + (textStore.originalText.length > 30 ? '……' : ''),
      revisedSummary: textStore.revisedText.slice(0, 30) + (textStore.revisedText.length > 30 ? '……' : ''),
      totalDiffs: entries.value.length,
      statistics: {
        taboo: statistics.value.taboo,
        error: statistics.value.error,
        variant: statistics.value.variant,
        pending: statistics.value.pending,
      },
      judgments: entries.value.map((d) => ({ ...d })),
    };
  }

  return {
    entries,
    scanStatus,
    scannedAt,
    selectedId,
    selectedEntry,
    statistics,
    allJudged,
    matchedCount,
    lastInvalidation,
    load,
    persist,
    runScan,
    invalidateDiffs,
    clearDiffs,
    setSelected,
    setJudgment,
    clearJudgment,
    buildReport,
  };
});
