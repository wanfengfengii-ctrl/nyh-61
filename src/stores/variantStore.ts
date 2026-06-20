import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  VariantEntry,
  VariantCategory,
  AcceptanceStatus,
  EvolutionPath,
  VariantStatistics,
  ChapterInfo,
  MultiVersionDiff,
  ScanStatus,
} from '@/types';
import {
  scanMultiVersionVariants,
  autoAcceptVariants,
  type MultiVersionScanOptions,
} from '@/utils/multiVersionDiffEngine';
import { useVersionStore } from './versionStore';
import { useRuleStore } from './ruleStore';
import { useProjectStore } from './projectStore';
import { useAuditStore } from './auditStore';

const VARIANT_KEY = 'ancientscrutiny_variants_v1';
const DIFF_KEY = 'ancientscrutiny_multi_diff_v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const useVariantStore = defineStore('variant', () => {
  const variants = ref<VariantEntry[]>([]);
  const multiVersionDiffs = ref<MultiVersionDiff[]>([]);
  const selectedVariantId = ref<string | null>(null);
  const selectedChapterId = ref<string | null>(null);
  const scanStatus = ref<ScanStatus>('idle');
  const currentDiffId = ref<string | null>(null);
  const filterCategory = ref<VariantCategory | 'all'>('all');
  const filterAcceptance = ref<AcceptanceStatus | 'all'>('all');
  const initialized = ref(false);

  function load() {
    try {
      const rawVariants = localStorage.getItem(VARIANT_KEY);
      const rawDiffs = localStorage.getItem(DIFF_KEY);
      if (rawVariants) {
        variants.value = JSON.parse(rawVariants);
      }
      if (rawDiffs) {
        multiVersionDiffs.value = JSON.parse(rawDiffs);
      }
      if (variants.value.length > 0 && !selectedVariantId.value) {
        selectedVariantId.value = variants.value[0].id;
      }
      initialized.value = true;
    } catch {
      variants.value = [];
      multiVersionDiffs.value = [];
    }
  }

  function persistVariants() {
    localStorage.setItem(VARIANT_KEY, JSON.stringify(variants.value));
  }

  function persistDiffs() {
    localStorage.setItem(DIFF_KEY, JSON.stringify(multiVersionDiffs.value));
  }

  async function runMultiVersionScan(
    chapter?: ChapterInfo
  ): Promise<{ ok: boolean; error?: string; count?: number }> {
    const versionStore = useVersionStore();
    const ruleStore = useRuleStore();
    const projectStore = useProjectStore();
    const auditStore = useAuditStore();

    if (!versionStore.baseVersion) {
      return { ok: false, error: '请先选择底本版本' };
    }
    if (versionStore.comparingVersions.length === 0) {
      return { ok: false, error: '请至少选择一个比对版本' };
    }
    if (!projectStore.currentProjectId) {
      return { ok: false, error: '请先选择项目' };
    }

    scanStatus.value = 'scanning';
    await new Promise((r) => setTimeout(r, 100));

    try {
      const options: MultiVersionScanOptions = {
        projectId: projectStore.currentProjectId,
        baseVersion: versionStore.baseVersion,
        comparingVersions: versionStore.comparingVersions,
        chapter,
        tabooRules: ruleStore.enabledRules,
        versionRelations: versionStore.getRelationsByProject(projectStore.currentProjectId),
        scannedBy: '本地用户',
      };

      const { variants: newVariants, statistics } = scanMultiVersionVariants(options);

      const diff: MultiVersionDiff = {
        id: uid(),
        projectId: projectStore.currentProjectId,
        chapterId: chapter?.id,
        baseVersionId: versionStore.baseVersion.id,
        comparingVersionIds: versionStore.comparingVersionIds,
        status: 'done',
        totalVariants: newVariants.length,
        statistics,
        variants: newVariants,
        scannedAt: Date.now(),
        scannedBy: '本地用户',
      };

      const existingIdx = variants.value.findIndex(
        (v) => v.chapterId === chapter?.id && v.projectId === projectStore.currentProjectId
      );
      if (existingIdx >= 0) {
        variants.value = variants.value.filter(
          (v) => !(v.chapterId === chapter?.id && v.projectId === projectStore.currentProjectId)
        );
      }
      variants.value.push(...newVariants);

      multiVersionDiffs.value.push(diff);
      currentDiffId.value = diff.id;

      if (newVariants.length > 0 && !selectedVariantId.value) {
        selectedVariantId.value = newVariants[0].id;
      }

      scanStatus.value = 'done';
      persistVariants();
      persistDiffs();

      auditStore.addLog({
        actionType: 'variant_scan',
        actor: '本地用户',
        projectId: projectStore.currentProjectId,
        description: `执行多版本异文扫描，发现 ${newVariants.length} 处异文${chapter ? `（${chapter.title}）` : ''}`,
      });

      return { ok: true, count: newVariants.length };
    } catch (e: any) {
      scanStatus.value = 'idle';
      return { ok: false, error: e?.message || '扫描失败' };
    }
  }

  function runAutoAccept(options: {
    minConfidence: number;
    preferEarlierVersions: boolean;
    preferMajorityReading: boolean;
  }): number {
    const projectStore = useProjectStore();
    const auditStore = useAuditStore();

    const projectVariants = getVariantsByProject(projectStore.currentProjectId || '');
    const updated = autoAcceptVariants(projectVariants, options);

    let count = 0;
    for (const updatedVariant of updated) {
      const idx = variants.value.findIndex((v) => v.id === updatedVariant.id);
      if (idx >= 0 && variants.value[idx].acceptance !== updatedVariant.acceptance) {
        variants.value[idx] = updatedVariant;
        count++;
      }
    }

    if (count > 0) {
      persistVariants();
      auditStore.addLog({
        actionType: 'variant_accept',
        actor: '本地用户',
        projectId: projectStore.currentProjectId || undefined,
        description: `自动采信 ${count} 处高置信度异文`,
      });
    }

    return count;
  }

  function setVariantAcceptance(
    id: string,
    acceptance: AcceptanceStatus,
    acceptedReading?: string,
    acceptedVersionId?: string,
    researcherNote?: string
  ) {
    const auditStore = useAuditStore();
    const d = variants.value.find((x) => x.id === id);
    if (!d) return;

    d.acceptance = acceptance;
    if (acceptedReading !== undefined) d.acceptedReading = acceptedReading;
    if (acceptedVersionId !== undefined) d.acceptedVersionId = acceptedVersionId;
    if (researcherNote !== undefined) d.researcherNote = researcherNote;
    d.updatedAt = Date.now();

    persistVariants();

    auditStore.addLog({
      actionType: acceptance === 'accepted' ? 'variant_accept' : 'variant_reject',
      actor: '本地用户',
      targetId: id,
      description: `异文判断：${d.contextBefore}...${d.contextAfter} → ${acceptance}`,
    });
  }

  function setVariantCategory(id: string, category: VariantCategory, note?: string) {
    const auditStore = useAuditStore();
    const d = variants.value.find((x) => x.id === id);
    if (!d) return;

    d.category = category;
    d.categoryConfidence = 1.0;
    if (note) d.collationNote = note;
    d.updatedAt = Date.now();

    persistVariants();

    auditStore.addLog({
      actionType: 'variant_classify',
      actor: '本地用户',
      targetId: id,
      description: `异文分类：${d.contextBefore}...${d.contextAfter} → ${category}`,
    });
  }

  function setVariantNote(id: string, note: string) {
    const auditStore = useAuditStore();
    const d = variants.value.find((x) => x.id === id);
    if (!d) return;

    d.researcherNote = note.trim() || undefined;
    d.updatedAt = Date.now();

    persistVariants();

    auditStore.addLog({
      actionType: 'variant_note',
      actor: '本地用户',
      targetId: id,
      description: '更新异文研究备注',
    });
  }

  function setEvolutionPath(
    variantId: string,
    path: Omit<EvolutionPath, 'id' | 'variantId' | 'establishedAt' | 'establishedBy'>
  ) {
    const auditStore = useAuditStore();
    const d = variants.value.find((x) => x.id === variantId);
    if (!d) return;

    d.evolutionPath = {
      id: uid(),
      variantId,
      ...path,
      establishedAt: Date.now(),
      establishedBy: '本地用户',
    };
    d.updatedAt = Date.now();

    persistVariants();

    auditStore.addLog({
      actionType: 'evolution_path_create',
      actor: '本地用户',
      targetId: variantId,
      description: '建立异文演变路径',
    });
  }

  function addCitationToVariant(variantId: string, citationId: string) {
    const d = variants.value.find((x) => x.id === variantId);
    if (!d) return;

    if (!d.citations.includes(citationId)) {
      d.citations.push(citationId);
      d.updatedAt = Date.now();
      persistVariants();
    }
  }

  function removeCitationFromVariant(variantId: string, citationId: string) {
    const d = variants.value.find((x) => x.id === variantId);
    if (!d) return;

    const idx = d.citations.indexOf(citationId);
    if (idx >= 0) {
      d.citations.splice(idx, 1);
      d.updatedAt = Date.now();
      persistVariants();
    }
  }

  function getVariantById(id: string): VariantEntry | undefined {
    return variants.value.find((v) => v.id === id);
  }

  function getVariantsByProject(projectId: string): VariantEntry[] {
    return variants.value.filter((v) => v.projectId === projectId);
  }

  function getVariantsByChapter(projectId: string, chapterId: string): VariantEntry[] {
    return variants.value.filter((v) => v.projectId === projectId && v.chapterId === chapterId);
  }

  function deleteVariantsByProject(projectId: string) {
    variants.value = variants.value.filter((v) => v.projectId !== projectId);
    multiVersionDiffs.value = multiVersionDiffs.value.filter((d) => d.projectId !== projectId);
    persistVariants();
    persistDiffs();
  }

  function clearVariants() {
    const projectStore = useProjectStore();
    if (projectStore.currentProjectId) {
      variants.value = variants.value.filter((v) => v.projectId !== projectStore.currentProjectId);
      multiVersionDiffs.value = multiVersionDiffs.value.filter(
        (d) => d.projectId !== projectStore.currentProjectId
      );
      persistVariants();
      persistDiffs();
    }
    selectedVariantId.value = null;
    currentDiffId.value = null;
    scanStatus.value = 'idle';
  }

  function selectVariant(id: string | null) {
    selectedVariantId.value = id;
  }

  function selectChapter(chapterId: string | null) {
    selectedChapterId.value = chapterId;
  }

  const selectedVariant = computed(() =>
    selectedVariantId.value ? getVariantById(selectedVariantId.value) : undefined
  );

  const currentDiff = computed(() =>
    currentDiffId.value ? multiVersionDiffs.value.find((d) => d.id === currentDiffId.value) : undefined
  );

  const filteredVariants = computed(() => {
    const projectStore = useProjectStore();
    const versionStore = useVersionStore();

    let result = getVariantsByProject(projectStore.currentProjectId || '');

    if (selectedChapterId.value) {
      result = result.filter((v) => v.chapterId === selectedChapterId.value);
    }

    if (filterCategory.value !== 'all') {
      result = result.filter((v) => v.category === filterCategory.value);
    }

    if (filterAcceptance.value !== 'all') {
      result = result.filter((v) => v.acceptance === filterAcceptance.value);
    }

    return result;
  });

  const statistics = computed((): VariantStatistics => {
    const projectStore = useProjectStore();
    const projectVariants = getVariantsByProject(projectStore.currentProjectId || '');

    const stats: VariantStatistics = {
      byCategory: {
        transcription: 0,
        taboo_layered: 0,
        later_revision: 0,
        orthographic: 0,
        phonetic: 0,
        missing: 0,
        added: 0,
        disputed: 0,
      },
      byAcceptance: {
        accepted: 0,
        rejected: 0,
        tentative: 0,
        needs_review: 0,
      },
      byChapter: {},
      tabooLayeredCount: 0,
      laterRevisionCount: 0,
      transcriptionCount: 0,
      disputedCount: 0,
    };

    for (const variant of projectVariants) {
      stats.byCategory[variant.category]++;
      stats.byAcceptance[variant.acceptance]++;

      if (variant.chapterId) {
        stats.byChapter[variant.chapterId] = (stats.byChapter[variant.chapterId] || 0) + 1;
      }

      if (variant.category === 'taboo_layered') stats.tabooLayeredCount++;
      if (variant.category === 'later_revision') stats.laterRevisionCount++;
      if (variant.category === 'transcription') stats.transcriptionCount++;
      if (variant.category === 'disputed') stats.disputedCount++;
    }

    return stats;
  });

  const allReviewed = computed(() => {
    const projectStore = useProjectStore();
    const projectVariants = getVariantsByProject(projectStore.currentProjectId || '');
    return projectVariants.length > 0 && projectVariants.every((v) => v.acceptance !== 'needs_review');
  });

  return {
    variants,
    multiVersionDiffs,
    selectedVariantId,
    selectedChapterId,
    scanStatus,
    currentDiffId,
    filterCategory,
    filterAcceptance,
    initialized,
    selectedVariant,
    currentDiff,
    filteredVariants,
    statistics,
    allReviewed,
    load,
    runMultiVersionScan,
    runAutoAccept,
    setVariantAcceptance,
    setVariantCategory,
    setVariantNote,
    setEvolutionPath,
    addCitationToVariant,
    removeCitationFromVariant,
    getVariantById,
    getVariantsByProject,
    getVariantsByChapter,
    deleteVariantsByProject,
    clearVariants,
    selectVariant,
    selectChapter,
  };
});
