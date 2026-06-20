<script setup lang="ts">
import { computed, ref, watch, nextTick, reactive, onMounted } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Eraser,
  Filter,
  Sparkles,
  AlertTriangle,
  BookMarked,
  ArrowRight,
  Eye,
  EyeOff,
  ScrollText,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  User,
  RotateCcw,
  CornerDownRight,
  X,
} from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useDiffStore } from '@/stores/diffStore';
import { useTextStore } from '@/stores/textStore';
import { useAnnotationStore } from '@/stores/annotationStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import TextHighlightViewer from '@/components/TextHighlightViewer.vue';
import type { DiffEntry, JudgmentType, ReviewFlow, Annotation } from '@/types';
import {
  judgmentLabel,
  judgmentTagCls,
  judgmentHlCls,
  formatDate,
} from '@/utils/exportEngine';
import { JUDGMENT_META, REVIEW_STATUS_META } from '@/types';

const diffStore = useDiffStore();
const textStore = useTextStore();
const annotationStore = useAnnotationStore();
const reviewStore = useReviewStore();
const auditStore = useAuditStore();
const projectStore = useProjectStore();
const router = useRouter();

onMounted(() => {
  if (diffStore.scanStatus !== 'done' || diffStore.entries.length === 0) {
    router.replace({ path: '/import', query: { reason: 'needtext' } });
  }
});

watch(
  [() => diffStore.scanStatus, () => diffStore.entries.length],
  () => {
    if (diffStore.scanStatus !== 'done' || diffStore.entries.length === 0) {
      router.replace({ path: '/import', query: { reason: 'needtext' } });
    }
  },
);

type FilterKey = 'all' | 'unjudged' | Exclude<JudgmentType, null>;

const filter = ref<FilterKey>('all');
const focusText = ref(true);
const draftJudgment = ref<JudgmentType>(null);
const draftNote = ref('');
const activeTab = ref<'judgment' | 'annotation' | 'review'>('judgment');
const newAnnotation = ref('');
const reviewComment = ref('');
const showReviewHistory = ref(false);

const filteredEntries = computed<DiffEntry[]>(() => {
  const all = diffStore.entries;
  if (filter.value === 'all') return all;
  if (filter.value === 'unjudged') return all.filter((d) => !d.judgment);
  return all.filter((d) => d.judgment === filter.value);
});

const indexInFiltered = computed(() =>
  filteredEntries.value.findIndex((d) => d.id === diffStore.selectedId),
);

const nextPrevAvailable = computed(() => ({
  prev: indexInFiltered.value > 0,
  next: indexInFiltered.value >= 0 && indexInFiltered.value < filteredEntries.value.length - 1,
}));

const currentReviewFlow = computed((): ReviewFlow | null => {
  if (!diffStore.selectedId || !projectStore.currentProjectId) return null;
  return reviewStore.getFlowByDiffEntry(diffStore.selectedId, projectStore.currentProjectId) || null;
});

const currentAnnotations = computed((): Annotation[] => {
  if (!diffStore.selectedId) return [];
  return annotationStore.getByDiffEntry(diffStore.selectedId);
});

function goPrev() {
  const idx = indexInFiltered.value;
  if (idx > 0) selectEntry(filteredEntries.value[idx - 1].id);
}
function goNext() {
  const idx = indexInFiltered.value;
  if (idx >= 0 && idx < filteredEntries.value.length - 1)
    selectEntry(filteredEntries.value[idx + 1].id);
}

function selectEntry(id: string) {
  diffStore.setSelected(id);
  const item = diffStore.entries.find((d) => d.id === id);
  if (item) {
    draftJudgment.value = item.judgment;
    draftNote.value = item.judgmentNote || '';
  }
  if (focusText.value) {
    nextTick(() => {
      const el = document.getElementById(`diff-anchor-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  newAnnotation.value = '';
  reviewComment.value = '';
}

watch(
  () => diffStore.selectedEntry,
  (v) => {
    if (v) {
      draftJudgment.value = v.judgment;
      draftNote.value = v.judgmentNote || '';
    }
  },
  { immediate: true },
);

function saveJudgment() {
  if (!diffStore.selectedId) return;
  if (!draftJudgment.value) return;
  diffStore.setJudgment(diffStore.selectedId, draftJudgment.value, draftNote.value);
  auditStore.addLog({
    actionType: 'judgment_set',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: `设置判断：${judgmentLabel(draftJudgment.value)}`,
    details: { judgment: draftJudgment.value, note: draftNote.value },
  });
  if (nextPrevAvailable.value.next) goNext();
}

function resetCurrentJudgment() {
  if (!diffStore.selectedId) return;
  diffStore.clearJudgment(diffStore.selectedId);
  auditStore.addLog({
    actionType: 'judgment_clear',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: '清除判断',
  });
  draftJudgment.value = null;
  draftNote.value = '';
}

function applyBulkByRule() {
  if (!confirm('将对未判断的差异条目按规则自动标记：匹配到避讳规则者标记为「避讳」，其余标记为「待定」。是否继续？')) return;
  let count = 0;
  for (const d of diffStore.entries) {
    if (d.judgment) continue;
    if (d.matchedRuleId) {
      diffStore.setJudgment(d.id, 'taboo', d.judgmentNote || `自动匹配避讳规则：${d.matchedRule?.originalChar}→${d.matchedRule?.replacedChar}`);
    } else {
      diffStore.setJudgment(d.id, 'pending', d.judgmentNote || '未匹配到避讳规则，需人工复核。');
    }
    count++;
  }
  auditStore.addLog({
    actionType: 'judgment_set',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    description: `批量自动判断 ${count} 条`,
  });
  alert(`已自动标记 ${count} 条，请逐条复核。`);
}

const filterTabs: { key: FilterKey; label: string; cls?: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'unjudged', label: '未判断' },
  { key: 'taboo', label: '避讳' },
  { key: 'variant', label: '异体' },
  { key: 'error', label: '误改' },
  { key: 'pending', label: '待定' },
];

function filterCount(k: FilterKey) {
  if (k === 'all') return diffStore.entries.length;
  if (k === 'unjudged') return diffStore.statistics.unjudged;
  return diffStore.statistics[k];
}

function addAnnotation() {
  if (!diffStore.selectedId || !newAnnotation.value.trim()) return;
  const projectId = projectStore.currentProjectId || 'default';
  annotationStore.addAnnotation({
    diffEntryId: diffStore.selectedId,
    projectId,
    content: newAnnotation.value,
  });
  auditStore.addLog({
    actionType: 'annotation_add',
    actor: '本地用户',
    projectId,
    targetId: diffStore.selectedId,
    description: '添加批注',
    details: { content: newAnnotation.value.slice(0, 50) },
  });
  newAnnotation.value = '';
}

function resolveAnnotation(id: string) {
  annotationStore.resolveAnnotation(id);
  auditStore.addLog({
    actionType: 'annotation_resolve',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: id,
    description: '解决批注',
  });
}

function submitForReview() {
  if (!diffStore.selectedId) return;
  const projectId = projectStore.currentProjectId || 'default';
  const flow = reviewStore.getOrCreateFlow(diffStore.selectedId, projectId);
  reviewStore.submitForReview(flow.id, '本地用户', reviewComment.value || undefined);
  auditStore.addLog({
    actionType: 'review_submit',
    actor: '本地用户',
    projectId,
    targetId: diffStore.selectedId,
    description: '提交复核',
    details: { comment: reviewComment.value },
  });
  reviewComment.value = '';
}

function approveReview() {
  if (!currentReviewFlow.value) return;
  reviewStore.approveFlow(currentReviewFlow.value.id, '本地用户', reviewComment.value || undefined);
  auditStore.addLog({
    actionType: 'review_approve',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: '复核通过',
    details: { comment: reviewComment.value },
  });
  reviewComment.value = '';
}

function rejectReview() {
  if (!currentReviewFlow.value) return;
  reviewStore.rejectFlow(currentReviewFlow.value.id, '本地用户', reviewComment.value || undefined);
  auditStore.addLog({
    actionType: 'review_reject',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: '复核驳回',
    details: { comment: reviewComment.value },
  });
  reviewComment.value = '';
}

function resetReview() {
  if (!currentReviewFlow.value) return;
  reviewStore.resetToDraft(currentReviewFlow.value.id, '本地用户');
}

function getUnresolvedAnnotationCount(diffId: string): number {
  return annotationStore.getByDiffEntry(diffId).filter((a) => !a.resolved).length;
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷三">差异审核与标记</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          点击差异片段或下方列表条目查看详细上下文，支持多人协作批注与复核流转，
          <span class="text-vermilion">所有操作均留痕，确保学术审查可追溯。</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" @click="applyBulkByRule">
          <Sparkles class="w-4 h-4" />
          按规则自动初判
        </button>
        <RouterLink
          to="/report"
          class="btn-primary"
          :class="{
            '!bg-ink-muted !border-ink-muted cursor-not-allowed': !diffStore.allJudged,
          }"
          :title="
            diffStore.allJudged
              ? '所有差异已判断，可生成报告'
              : `还剩 ${diffStore.statistics.unjudged} 条未判断`
          "
        >
          <ScrollText class="w-4 h-4" />
          前往校验报告
          <ArrowRight class="w-4 h-4" />
        </RouterLink>
      </div>
    </div>

    <div
      v-if="diffStore.statistics.unjudged > 0"
      class="rounded-sm border border-rattan/60 bg-rattan/20 p-3 text-sm font-serif text-ink flex items-start gap-2"
    >
      <AlertTriangle class="w-4 h-4 text-vermilion mt-0.5 flex-shrink-0" />
      <span>
        还有 <strong class="text-vermilion mx-1">{{ diffStore.statistics.unjudged }}</strong> 处差异未作出最终判断，
        请全部判断后再生成最终校验报告。
      </span>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div class="card-scroll flex flex-col overflow-hidden xl:row-span-2 max-h-[75vh]">
        <div class="px-4 py-3 border-b border-ink/10 flex items-center justify-between bg-paper-200/50">
          <div class="flex items-center gap-2">
            <Filter class="w-4 h-4 text-vermilion" />
            <span class="font-title text-base text-ink">差 异 条 目</span>
            <span class="text-xs text-ink-muted font-serif">
              共 {{ diffStore.entries.length }} 条 · 当前筛选 {{ filteredEntries.length }} 条
            </span>
          </div>
          <button class="btn-ghost !p-1" @click="focusText = !focusText" :title="focusText ? '点击取消自动滚动' : '点击启用自动滚动'">
            <Eye v-if="focusText" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
        <div class="flex flex-wrap gap-1 px-3 py-2 border-b border-ink/5 bg-paper-100/50">
          <button
            v-for="t in filterTabs"
            :key="t.key"
            class="px-2.5 py-1 text-xs font-serif rounded-sm transition border"
            :class="
              filter === t.key
                ? 'bg-vermilion text-paper-50 border-vermilion'
                : 'border-ink/15 bg-paper-50 text-ink-muted hover:border-vermilion/50 hover:text-ink'
            "
            @click="filter = t.key"
          >
            {{ t.label }}
            <span class="ml-1 opacity-70">{{ filterCount(t.key) }}</span>
          </button>
        </div>
        <div class="overflow-y-auto flex-1 p-2 space-y-2">
          <div
            v-for="(d, idx) in filteredEntries"
            :key="d.id"
            :id="`diff-anchor-${d.id}`"
            class="rounded-sm border p-3 cursor-pointer transition-all duration-150"
            :class="
              diffStore.selectedId === d.id
                ? 'border-vermilion bg-vermilion/5 shadow-sm'
                : 'border-ink/10 bg-paper-50 hover:border-vermilion/40 hover:bg-paper-100'
            "
            @click="selectEntry(d.id)"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center justify-center w-7 h-7 rounded-sm font-mono text-xs bg-paper-200 border border-ink/10"
                >
                  {{ String(diffStore.entries.findIndex((x) => x.id === d.id) + 1).padStart(2, '0') }}
                </span>
                <span
                  v-if="d.diffType === 'replace'"
                  class="text-[10px] px-1.5 py-0.5 rounded-sm bg-ink/5 border border-ink/10 text-ink-muted"
                  >替 换</span
                >
                <span
                  v-else-if="d.diffType === 'insert'"
                  class="text-[10px] px-1.5 py-0.5 rounded-sm bg-azure/10 border border-azure/30 text-azure"
                  >插 入</span
                >
                <span
                  v-else
                  class="text-[10px] px-1.5 py-0.5 rounded-sm bg-carmine/10 border border-carmine/30 text-carmine"
                  >删 除</span
                >
              </div>
              <span :class="judgmentTagCls(d.judgment)">
                {{ judgmentLabel(d.judgment) }}
              </span>
            </div>
            <div
              class="text-sm font-serif leading-7 text-ink-soft grid grid-cols-[auto_1fr] gap-x-2 gap-y-1"
            >
              <span class="text-ink-pale text-xs pr-1">原</span>
              <span class="break-all">
                <span
                  class="hl-raw"
                  v-if="d.diffType !== 'insert'"
                  >{{ d.originalText || '（无）' }}</span
                >
                <span v-else class="text-ink-pale italic">（插入处原为空）</span>
              </span>
              <span class="text-ink-pale text-xs pr-1">改</span>
              <span class="break-all">
                <span
                  class="hl-new"
                  v-if="d.diffType !== 'delete'"
                  >{{ d.revisedText || '（无）' }}</span
                >
                <span v-else class="text-ink-pale italic">（删除处为空）</span>
              </span>
            </div>
            <div
              v-if="d.matchedRule"
              class="mt-2 rounded-sm border border-rattan/50 bg-rattan/15 px-2 py-1 text-xs font-serif text-ink flex items-center gap-2"
            >
              <BookMarked class="w-3 h-3 text-vermilion flex-shrink-0" />
              <span>
                匹配避讳规则：
                <strong class="font-title">{{ d.matchedRule.originalChar }} → {{ d.matchedRule.replacedChar }}</strong>
                <span v-if="d.matchedRule.dynasty" class="text-ink-muted ml-1">（{{ d.matchedRule.dynasty }}）</span>
              </span>
            </div>
            <div class="mt-2 flex items-center gap-3 text-xs text-ink-muted">
              <span class="flex items-center gap-1">
                <MessageSquare class="w-3.5 h-3.5" />
                {{ annotationStore.getByDiffEntry(d.id).length }} 批注
                <span v-if="getUnresolvedAnnotationCount(d.id) > 0" class="text-carmine">
                  ({{ getUnresolvedAnnotationCount(d.id) }} 未解决)
                </span>
              </span>
              <span v-if="reviewStore.getFlowByDiffEntry(d.id, projectStore.currentProjectId || 'default')" class="flex items-center gap-1">
                <Clock class="w-3.5 h-3.5" />
                {{ REVIEW_STATUS_META[reviewStore.getFlowByDiffEntry(d.id, projectStore.currentProjectId || 'default')!.status].label }}
              </span>
            </div>
          </div>
          <div
            v-if="filteredEntries.length === 0"
            class="py-12 text-center text-ink-muted font-serif text-sm"
          >
            该筛选条件下暂无差异条目
          </div>
        </div>
      </div>

      <div class="xl:col-span-2 space-y-5">
        <div class="card-scroll p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="font-title text-lg text-ink">原 文 与 校 改 文 对 照</span>
              <div class="flex items-center gap-1 text-xs font-serif text-ink-muted">
                <button
                  class="btn-ghost !p-1 !text-xs"
                  :disabled="!nextPrevAvailable.prev"
                  :class="{ '!opacity-30': !nextPrevAvailable.prev }"
                  @click="goPrev"
                >
                  <ChevronLeft class="w-4 h-4" />
                </button>
                <span>
                  {{ indexInFiltered >= 0 ? indexInFiltered + 1 : 0 }} /
                  {{ filteredEntries.length }}
                </span>
                <button
                  class="btn-ghost !p-1 !text-xs"
                  :disabled="!nextPrevAvailable.next"
                  :class="{ '!opacity-30': !nextPrevAvailable.next }"
                  @click="goNext"
                >
                  <ChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-sm border border-ink/15 bg-paper-100/40 p-4">
              <div class="flex items-center justify-between mb-2 pb-2 border-b border-ink/10">
                <h4 class="font-title text-sm text-ink">原 始 文 本</h4>
                <span class="text-xs font-serif text-ink-muted">{{ textStore.originalCharCount }} 字</span>
              </div>
              <div class="max-h-[40vh] overflow-auto pr-1">
                <TextHighlightViewer
                  :text="textStore.originalText"
                  :entries="diffStore.entries"
                  :selected-id="diffStore.selectedId"
                  side="original"
                  @click-diff="selectEntry"
                />
              </div>
            </div>
            <div class="rounded-sm border border-ink/15 bg-paper-100/40 p-4">
              <div class="flex items-center justify-between mb-2 pb-2 border-b border-ink/10">
                <h4 class="font-title text-sm text-ink">校 改 文 本</h4>
                <span class="text-xs font-serif text-ink-muted">{{ textStore.revisedCharCount }} 字</span>
              </div>
              <div class="max-h-[40vh] overflow-auto pr-1">
                <TextHighlightViewer
                  :text="textStore.revisedText"
                  :entries="diffStore.entries"
                  :selected-id="diffStore.selectedId"
                  side="revised"
                  @click-diff="selectEntry"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="card-scroll p-5">
          <div class="flex border-b border-ink/10 mb-4">
            <button
              v-for="tab in [
                { key: 'judgment', label: '判断标记', icon: CheckCircle },
                { key: 'annotation', label: '协作批注', icon: MessageSquare },
                { key: 'review', label: '复核流转', icon: Clock },
              ]"
              :key="tab.key"
              class="flex items-center gap-2 px-4 py-2 -mb-px border-b-2 font-serif text-sm transition-all"
              :class="
                activeTab === tab.key
                  ? 'border-vermilion text-vermilion'
                  : 'border-transparent text-ink-muted hover:text-ink'
              "
              @click="activeTab = tab.key as any"
            >
              <component :is="tab.icon" class="w-4 h-4" />
              {{ tab.label }}
              <span
                v-if="tab.key === 'annotation' && diffStore.selectedEntry"
                class="text-xs bg-paper-200 px-1.5 rounded-full"
              >
                {{ currentAnnotations.length }}
              </span>
            </button>
          </div>

          <div v-if="!diffStore.selectedEntry" class="py-10 text-center text-ink-muted font-serif">
            请先在左侧列表或对照文本中点击一处差异
          </div>

          <template v-else-if="diffStore.selectedEntry">
            <div v-show="activeTab === 'judgment'">
              <div
                class="rounded-sm border border-ink/15 bg-paper-100/40 p-4 mb-4 font-serif text-sm"
              >
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div class="text-xs text-ink-muted mb-1">上下文 · 前 10 字</div>
                    <div class="text-ink">「{{ diffStore.selectedEntry.contextBefore || '（无）' }}」</div>
                  </div>
                  <div>
                    <div class="text-xs text-ink-muted mb-1">上下文 · 后 10 字</div>
                    <div class="text-ink">「{{ diffStore.selectedEntry.contextAfter || '（无）' }}」</div>
                  </div>
                  <div>
                    <div class="text-xs text-ink-muted mb-1">原 文 片 段</div>
                    <div
                      class="rounded-sm bg-paper-50 border border-ink/10 px-3 py-2 break-all"
                    >
                      <span
                        class="hl-raw font-title text-lg"
                        v-if="diffStore.selectedEntry.diffType !== 'insert'"
                        >{{ diffStore.selectedEntry.originalText || '（空）' }}</span
                      >
                      <span v-else class="text-ink-pale italic">（插入处，原文为空）</span>
                      <span class="mx-1 text-ink-muted">→</span>
                      <span
                        class="hl-new font-title text-lg"
                        v-if="diffStore.selectedEntry.diffType !== 'delete'"
                        >{{ diffStore.selectedEntry.revisedText || '（空）' }}</span
                      >
                      <span v-else class="text-ink-pale italic">（删除处，校改文为空）</span>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-ink-muted mb-1">匹配避讳规则</div>
                    <div
                      class="rounded-sm border px-3 py-2 min-h-[42px] flex items-center"
                      :class="
                        diffStore.selectedEntry.matchedRule
                          ? 'border-rattan/50 bg-rattan/15'
                          : 'border-ink/10 bg-paper-50 text-ink-muted italic'
                      "
                    >
                      <template v-if="diffStore.selectedEntry.matchedRule">
                        <span class="font-title text-lg mr-2">
                          {{ diffStore.selectedEntry.matchedRule.originalChar }} →
                          {{ diffStore.selectedEntry.matchedRule.replacedChar }}
                        </span>
                        <span class="text-xs text-ink-muted">
                          {{ diffStore.selectedEntry.matchedRule.dynasty }}
                          <span v-if="diffStore.selectedEntry.matchedRule.note"
                            >· {{ diffStore.selectedEntry.matchedRule.note }}</span
                          >
                        </span>
                      </template>
                      <template v-else> 未匹配到避讳规则，请人工判断 </template>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mb-4">
                <div class="text-sm font-serif text-ink-soft mb-2">
                  请选择最终判断 <span class="text-carmine">*</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label
                    v-for="(meta, key) in JUDGMENT_META"
                    :key="key"
                    class="cursor-pointer group"
                  >
                    <input
                      type="radio"
                      class="sr-only"
                      :value="key"
                      v-model="draftJudgment"
                    />
                    <div
                      class="rounded-sm border-2 transition-all duration-200 p-3 h-full flex flex-col items-center justify-center gap-1 relative"
                      :class="
                        draftJudgment === key
                          ? `${meta.cls} border-current shadow-sm`
                          : 'border-ink/15 bg-paper-50 text-ink-muted hover:border-ink/30'
                      "
                    >
                      <div class="font-title text-xl">{{ meta.label }}</div>
                      <div class="text-[10px] opacity-75 font-serif">
                        {{ key === 'taboo' ? '匹配避讳制度' : key === 'variant' ? '异体/通用字' : key === 'error' ? '误改/讹误' : '存疑待复核' }}
                      </div>
                      <div
                        v-if="draftJudgment === key"
                        class="absolute top-2 right-2 rounded-full bg-vermilion text-paper-50 w-5 h-5 flex items-center justify-center"
                      >
                        <Check class="w-3 h-3" />
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div class="mb-4">
                <div class="text-sm font-serif text-ink-soft mb-2">判断依据 / 备注</div>
                <textarea
                  v-model="draftNote"
                  rows="3"
                  placeholder="请记录作出此判断的依据，如参考典籍、避讳通例、字形分析等，将随报告一并导出……"
                  class="text-area-paper text-sm"
                />
              </div>

              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xs font-serif text-ink-muted">
                  <span v-if="diffStore.selectedEntry.judgment">
                    当前已保存为：
                    <span :class="judgmentTagCls(diffStore.selectedEntry.judgment)">
                      {{ judgmentLabel(diffStore.selectedEntry.judgment) }}
                    </span>
                  </span>
                  <span v-else class="text-carmine">尚未作出最终判断</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn-secondary"
                    @click="resetCurrentJudgment"
                    :disabled="!diffStore.selectedEntry.judgment"
                  >
                    <Eraser class="w-4 h-4" />
                    清除判断
                  </button>
                  <button
                    class="btn-primary"
                    :disabled="!draftJudgment"
                    @click="saveJudgment"
                  >
                    <Check class="w-4 h-4" />
                    保存并进入下一条
                  </button>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'annotation'" class="space-y-4">
              <div class="text-sm font-serif text-ink-soft">
                协作批注 · 共 {{ currentAnnotations.length }} 条，
                <span v-if="currentAnnotations.filter(a => !a.resolved).length > 0" class="text-carmine">
                  {{ currentAnnotations.filter(a => !a.resolved).length }} 条未解决
                </span>
                <span v-else class="text-moss">全部已解决</span>
              </div>

              <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
                <div
                  v-for="ann in currentAnnotations"
                  :key="ann.id"
                  class="rounded-sm border p-3 bg-paper-50"
                  :class="ann.resolved ? 'border-moss/30 opacity-70' : 'border-ink/15'"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <User class="w-4 h-4 text-ink-pale" />
                      <span class="text-sm font-serif text-ink">{{ ann.author }}</span>
                      <span class="text-xs text-ink-muted font-mono">{{ formatDate(ann.createdAt) }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span
                        v-if="ann.resolved"
                        class="text-xs text-moss flex items-center gap-1"
                      >
                        <CheckCircle class="w-3.5 h-3.5" />
                        已解决
                      </span>
                      <button
                        v-else
                        class="btn-ghost !p-1 !text-xs text-moss hover:!text-moss"
                        @click="resolveAnnotation(ann.id)"
                        title="标记为已解决"
                      >
                        <CheckCircle class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div class="text-sm font-serif text-ink leading-relaxed pl-6">
                    {{ ann.content }}
                  </div>
                </div>

                <div v-if="currentAnnotations.length === 0" class="text-center py-6 text-ink-muted font-serif text-sm">
                  暂无批注，添加第一条吧
                </div>
              </div>

              <div class="flex gap-2">
                <input
                  v-model="newAnnotation"
                  type="text"
                  placeholder="输入批注内容，按回车发送……"
                  class="flex-1 rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                  @keyup.enter="addAnnotation"
                />
                <button
                  class="btn-primary"
                  :disabled="!newAnnotation.trim()"
                  @click="addAnnotation"
                >
                  <Send class="w-4 h-4" />
                  发送
                </button>
              </div>
            </div>

            <div v-show="activeTab === 'review'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-sm font-serif text-ink-soft">复核状态</div>
                <span
                  v-if="currentReviewFlow"
                  :class="['px-3 py-1 rounded-sm border text-sm font-serif', REVIEW_STATUS_META[currentReviewFlow.status].cls]"
                >
                  {{ REVIEW_STATUS_META[currentReviewFlow.status].label }}
                </span>
                <span v-else class="text-sm font-serif text-ink-muted">未启动复核流程</span>
              </div>

              <div v-if="currentReviewFlow" class="rounded-sm border border-ink/10 bg-paper-100/50 p-3">
                <div class="flex items-center justify-between text-xs text-ink-muted font-serif">
                  <span>创建人：{{ currentReviewFlow.createdBy }}</span>
                  <span>创建于：{{ formatDate(currentReviewFlow.createdAt) }}</span>
                </div>
                <div v-if="currentReviewFlow.assignedTo" class="mt-1 text-xs text-ink-muted font-serif">
                  指派人：{{ currentReviewFlow.assignedTo }}
                </div>
              </div>

              <div>
                <div class="text-sm font-serif text-ink-soft mb-2">复核意见</div>
                <textarea
                  v-model="reviewComment"
                  rows="3"
                  placeholder="输入复核意见或备注……"
                  class="text-area-paper text-sm"
                />
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-if="!currentReviewFlow || currentReviewFlow.status === 'draft'"
                  class="btn-primary"
                  @click="submitForReview"
                >
                  <Send class="w-4 h-4" />
                  提交复核
                </button>
                <button
                  v-if="currentReviewFlow && currentReviewFlow.status === 'pending_review'"
                  class="btn-primary !bg-moss !border-moss"
                  @click="approveReview"
                >
                  <CheckCircle class="w-4 h-4" />
                  审核通过
                </button>
                <button
                  v-if="currentReviewFlow && currentReviewFlow.status === 'pending_review'"
                  class="btn-secondary"
                  @click="rejectReview"
                >
                  <XCircle class="w-4 h-4" />
                  驳回
                </button>
                <button
                  v-if="currentReviewFlow && currentReviewFlow.status !== 'draft'"
                  class="btn-secondary"
                  @click="resetReview"
                >
                  <RotateCcw class="w-4 h-4" />
                  退回草稿
                </button>
                <button
                  v-if="currentReviewFlow"
                  class="btn-secondary ml-auto"
                  @click="showReviewHistory = !showReviewHistory"
                >
                  <Clock class="w-4 h-4" />
                  {{ showReviewHistory ? '隐藏' : '查看' }}流转历史
                </button>
              </div>

              <div v-if="showReviewHistory && currentReviewFlow" class="border-t border-ink/10 pt-4">
                <div class="text-sm font-serif text-ink-soft mb-3">流转历史</div>
                <div class="space-y-3">
                  <div
                    v-for="action in [...currentReviewFlow.reviewHistory].reverse()"
                    :key="action.id"
                    class="flex gap-3"
                  >
                    <div class="flex flex-col items-center">
                      <div class="w-2 h-2 rounded-full bg-vermilion mt-1.5" />
                      <div class="w-px flex-1 bg-ink/10" />
                    </div>
                    <div class="flex-1 pb-3">
                      <div class="flex items-center gap-2 text-sm">
                        <span class="font-serif text-ink">{{ action.actor }}</span>
                        <span class="text-xs text-vermilion font-serif">
                          {{ action.action === 'submit' ? '提交复核' :
                             action.action === 'approve' ? '审核通过' :
                             action.action === 'reject' ? '驳回' :
                             action.action === 'comment' ? '添加评论' :
                             action.action === 'reassign' ? '转交' : action.action }}
                        </span>
                        <span class="text-xs text-ink-muted font-mono">{{ formatDate(action.timestamp) }}</span>
                      </div>
                      <div v-if="action.comment" class="mt-1 text-sm text-ink-soft font-serif pl-4 border-l-2 border-ink/10">
                        {{ action.comment }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
