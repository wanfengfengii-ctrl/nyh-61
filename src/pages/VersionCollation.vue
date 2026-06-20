<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
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
  Link2,
  Unlink,
  BookOpen,
  ShieldCheck,
  Search,
  Plus,
  Zap,
  List,
  Columns,
  GitBranch,
  FileText,
  Download,
  Play,
  Settings,
} from 'lucide-vue-next';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useVersionStore } from '@/stores/versionStore';
import { useVariantStore } from '@/stores/variantStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useCitationStore } from '@/stores/citationStore';
import type {
  VariantEntry,
  VariantCategory,
  AcceptanceStatus,
  ChapterInfo,
  VariantReading,
  EvolutionPath,
  EvolutionStep,
} from '@/types';
import {
  VARIANT_CATEGORY_META,
  ACCEPTANCE_META,
  VERSION_TYPE_META,
} from '@/types';
import { formatDate } from '@/utils/exportEngine';

const versionStore = useVersionStore();
const variantStore = useVariantStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const citationStore = useCitationStore();
const router = useRouter();
const route = useRoute();

const toast = ref('');
const scanLoading = ref(false);
const showAutoAcceptModal = ref(false);
const showEvolutionModal = ref(false);
const showCitationModal = ref(false);
const activeTab = ref<'list' | 'parallel' | 'detail'>('list');
const searchQuery = ref('');

const autoAcceptForm = reactive({
  minConfidence: 0.8,
  preferEarlierVersions: true,
  preferMajorityReading: true,
});

const evolutionForm = reactive({
  direction: 'earlier_to_later' as EvolutionPath['direction'],
  confidence: 0.8,
  evidence: '',
  steps: [] as EvolutionStep[],
});

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

onMounted(() => {
  if (!versionStore.initialized) versionStore.load();
  if (!variantStore.initialized) variantStore.load();
  if (!citationStore.initialized) citationStore.load();

  if (route.query.reason === 'needcollation') {
    flashToast('请先完成版本对读扫描，才能生成校勘报告');
  }
});

const projectVersions = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.getVersionsByProject(projectStore.currentProjectId);
});

const baseVersion = computed(() => versionStore.baseVersion);
const comparingVersions = computed(() => versionStore.comparingVersions);

const allChapters = computed(() => {
  if (!baseVersion.value) return [];
  return baseVersion.value.chapters || [];
});

const selectedChapterId = computed({
  get: () => variantStore.selectedChapterId,
  set: (val) => variantStore.selectChapter(val),
});

const filterCategory = computed({
  get: () => variantStore.filterCategory,
  set: (val) => (variantStore.filterCategory = val),
});

const filterAcceptance = computed({
  get: () => variantStore.filterAcceptance,
  set: (val) => (variantStore.filterAcceptance = val),
});

const selectedVariantId = computed({
  get: () => variantStore.selectedVariantId,
  set: (val) => variantStore.selectVariant(val),
});

const selectedVariant = computed(() => variantStore.selectedVariant);

const filteredVariants = computed(() => {
  let result = variantStore.filteredVariants;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    result = result.filter(
      (v) =>
        v.contextBefore.toLowerCase().includes(q) ||
        v.contextAfter.toLowerCase().includes(q) ||
        v.variants.some((vr) => vr.text.toLowerCase().includes(q)) ||
        (v.chapterTitle && v.chapterTitle.toLowerCase().includes(q))
    );
  }

  return result;
});

const statistics = computed(() => variantStore.statistics);

const selectedChapter = computed(() => {
  if (!selectedChapterId.value) return null;
  return allChapters.value.find((c) => c.id === selectedChapterId.value);
});

function getVersionById(id: string) {
  return versionStore.versions.find((v) => v.id === id);
}

function getReadingVersions(reading: VariantReading): string {
  return reading.versionIds
    .map((id) => getVersionById(id)?.shortName || id)
    .join('、');
}

async function runScan(chapter?: ChapterInfo) {
  if (!baseVersion.value) {
    flashToast('请先在版本管理中设置底本');
    return;
  }
  if (comparingVersions.value.length === 0) {
    flashToast('请先在版本管理中选择比对版本');
    return;
  }

  scanLoading.value = true;
  const result = await variantStore.runMultiVersionScan(chapter);
  scanLoading.value = false;

  if (result.ok) {
    flashToast(`扫描完成，发现 ${result.count} 处异文`);
  } else {
    flashToast(result.error || '扫描失败');
  }
}

function runAutoAccept() {
  const count = variantStore.runAutoAccept({
    minConfidence: autoAcceptForm.minConfidence,
    preferEarlierVersions: autoAcceptForm.preferEarlierVersions,
    preferMajorityReading: autoAcceptForm.preferMajorityReading,
  });
  flashToast(`自动采信 ${count} 处高置信度异文`);
  showAutoAcceptModal.value = false;
}

function setAcceptance(
  variant: VariantEntry,
  acceptance: AcceptanceStatus,
  reading?: VariantReading
) {
  variantStore.setVariantAcceptance(
    variant.id,
    acceptance,
    reading?.text,
    reading?.versionIds?.[0]
  );
  flashToast(`已标记为「${ACCEPTANCE_META[acceptance].label}」`);
}

function setCategory(variant: VariantEntry, category: VariantCategory) {
  variantStore.setVariantCategory(variant.id, category);
  flashToast(`已分类为「${VARIANT_CATEGORY_META[category].label}」`);
}

function updateNote(variant: VariantEntry, note: string) {
  variantStore.setVariantNote(variant.id, note);
}

function openEvolutionModal(variant: VariantEntry) {
  if (variant.evolutionPath) {
    evolutionForm.direction = variant.evolutionPath.direction;
    evolutionForm.confidence = variant.evolutionPath.confidence;
    evolutionForm.evidence = variant.evolutionPath.evidence || '';
    evolutionForm.steps = [...variant.evolutionPath.steps];
  } else {
    evolutionForm.direction = 'earlier_to_later';
    evolutionForm.confidence = 0.8;
    evolutionForm.evidence = '';
    evolutionForm.steps = variant.variants
      .filter((v) => v.versionIds.length > 0)
      .map((v) => ({
        versionId: v.versionIds[0],
        versionName: getVersionById(v.versionIds[0])?.name || '',
        text: v.text,
        changeType: 'modification' as const,
        rationale: '',
      }));
  }
  showEvolutionModal.value = true;
}

function saveEvolutionPath() {
  if (!selectedVariant.value) return;

  variantStore.setEvolutionPath(selectedVariant.value.id, {
    direction: evolutionForm.direction,
    confidence: evolutionForm.confidence,
    evidence: evolutionForm.evidence || undefined,
    steps: evolutionForm.steps,
  });

  flashToast('演变路径已保存');
  showEvolutionModal.value = false;
}

function addEvolutionStep() {
  evolutionForm.steps.push({
    versionId: '',
    versionName: '',
    text: '',
    changeType: 'modification',
    rationale: '',
  });
}

function removeEvolutionStep(index: number) {
  evolutionForm.steps.splice(index, 1);
}

function getParallelText(versionId: string): string {
  const version = getVersionById(versionId);
  if (!version) return '';

  if (selectedChapter.value) {
    return version.fullText.slice(
      selectedChapter.value.startOffset,
      selectedChapter.value.endOffset
    );
  }
  return version.fullText;
}

function exportVariantsJSON() {
  const data = JSON.stringify(variantStore.filteredVariants, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `异文记录_${formatDate(Date.now())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flashToast('异文记录已导出');
}

function goToReport() {
  if (variantStore.variants.length === 0) {
    flashToast('请先扫描异文');
    return;
  }
  router.push('/collation-report');
}
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-title text-ink flex items-center gap-2">
          <GitBranch class="w-6 h-6 text-vermilion" />
          版本对读
        </h1>
        <p class="text-sm text-ink-muted font-serif mt-1">
          跨版本差异比对 · 异文自动标记 · 采信结论记录
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          v-model="selectedChapterId"
          class="input-sm !py-1.5 font-serif"
        >
          <option :value="null">全部章节</option>
          <option v-for="c in allChapters" :key="c.id" :value="c.id">
            {{ c.title }}
          </option>
        </select>
        <button
          class="btn-primary !py-1.5"
          :disabled="scanLoading"
          @click="runScan(selectedChapter || undefined)"
        >
          <Play v-if="!scanLoading" class="w-4 h-4 mr-1" />
          <Zap v-else class="w-4 h-4 mr-1 animate-spin" />
          {{ scanLoading ? '扫描中...' : '扫描异文' }}
        </button>
        <button
          class="btn-secondary !py-1.5"
          @click="showAutoAcceptModal = true"
          :disabled="variantStore.variants.length === 0"
        >
          <Sparkles class="w-4 h-4 mr-1" />
          自动采信
        </button>
        <button
          class="btn-secondary !py-1.5"
          @click="exportVariantsJSON"
          :disabled="variantStore.variants.length === 0"
        >
          <Download class="w-4 h-4 mr-1" />
          导出
        </button>
        <RouterLink to="/collation-report" class="btn-primary !py-1.5">
          <FileText class="w-4 h-4 mr-1" />
          校勘报告
        </RouterLink>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <div class="text-xs text-ink-muted font-serif">异文总数</div>
        <div class="text-2xl font-title text-ink mt-1">
          {{ variantStore.variants.length }}
        </div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-muted font-serif">避讳层累</div>
        <div class="text-2xl font-title text-vermilion mt-1">
          {{ statistics.tabooLayeredCount }}
        </div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-muted font-serif">后出改字</div>
        <div class="text-2xl font-title text-carmine mt-1">
          {{ statistics.laterRevisionCount }}
        </div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-muted font-serif">待复核</div>
        <div class="text-2xl font-title text-rattan-dark mt-1">
          {{ statistics.byAcceptance.needs_review }}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <div class="inline-flex rounded-md border border-ink/20 overflow-hidden">
        <button
          class="px-3 py-1.5 text-sm font-serif transition-colors"
          :class="
            activeTab === 'list'
              ? 'bg-vermilion text-paper-50'
              : 'bg-paper-50 text-ink hover:bg-paper-100'
          "
          @click="activeTab = 'list'"
        >
          <List class="w-4 h-4 inline mr-1" />
          异文列表
        </button>
        <button
          class="px-3 py-1.5 text-sm font-serif transition-colors"
          :class="
            activeTab === 'parallel'
              ? 'bg-vermilion text-paper-50'
              : 'bg-paper-50 text-ink hover:bg-paper-100'
          "
          @click="activeTab = 'parallel'"
        >
          <Columns class="w-4 h-4 inline mr-1" />
          平行对读
        </button>
      </div>

      <div class="flex-1" />

      <div class="relative">
        <Search class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-pale" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索异文..."
          class="input-sm pl-8 w-48"
        />
      </div>

      <select
        v-model="filterCategory"
        class="input-sm"
      >
        <option value="all">全部分类</option>
        <option
          v-for="(meta, key) in VARIANT_CATEGORY_META"
          :key="key"
          :value="key"
        >
          {{ meta.label }}
        </option>
      </select>

      <select
        v-model="filterAcceptance"
        class="input-sm"
      >
        <option value="all">全部状态</option>
        <option
          v-for="(meta, key) in ACCEPTANCE_META"
          :key="key"
          :value="key"
        >
          {{ meta.label }}
        </option>
      </select>
    </div>

    <div v-if="activeTab === 'list'" class="space-y-3">
      <div
        v-for="variant in filteredVariants"
        :key="variant.id"
        class="card p-4 transition-all cursor-pointer hover:shadow-md"
        :class="{
          'ring-2 ring-vermilion/50': selectedVariantId === variant.id,
        }"
        @click="selectedVariantId = variant.id"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-serif"
                :class="VARIANT_CATEGORY_META[variant.category].cls"
              >
                {{ VARIANT_CATEGORY_META[variant.category].label }}
              </span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-serif"
                :class="ACCEPTANCE_META[variant.acceptance].cls"
              >
                {{ ACCEPTANCE_META[variant.acceptance].label }}
              </span>
              <span
                v-if="variant.chapterTitle"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-serif text-ink-muted border border-ink/20 bg-paper-100"
              >
                <BookOpen class="w-3 h-3 mr-1" />
                {{ variant.chapterTitle }}
              </span>
              <span
                v-if="variant.categoryConfidence < 1"
                class="text-xs text-ink-muted font-serif"
              >
                置信度：{{ (variant.categoryConfidence * 100).toFixed(0) }}%
              </span>
            </div>

            <div class="font-serif text-ink leading-relaxed">
              <span class="text-ink-muted">{{ variant.contextBefore }}</span>
              <span
                v-for="(reading, idx) in variant.variants"
                :key="idx"
                class="inline-block mx-0.5 px-1.5 py-0.5 rounded border"
                :class="{
                  'bg-vermilion/15 border-vermilion/40 text-vermilion':
                    reading.isBaseReading,
                  'bg-rattan/20 border-rattan/40 text-rattan-dark':
                    !reading.isBaseReading,
                }"
              >
                {{ reading.text }}
                <span class="text-[10px] ml-1 opacity-70">
                  {{ getReadingVersions(reading) }}
                </span>
              </span>
              <span class="text-ink-muted">{{ variant.contextAfter }}</span>
            </div>

            <div
              v-if="variant.acceptedReading"
              class="mt-2 text-sm font-serif text-moss flex items-center gap-1"
            >
              <CheckCircle class="w-4 h-4" />
              采信：<strong class="mx-1">{{ variant.acceptedReading }}</strong>
              <span class="text-ink-muted text-xs">
                ({{ getVersionById(variant.acceptedVersionId || '')?.name }})
              </span>
            </div>

            <div
              v-if="variant.researcherNote"
              class="mt-2 text-sm font-serif text-ink-muted bg-paper-100 p-2 rounded border-l-2 border-vermilion/30"
            >
              <MessageSquare class="w-3.5 h-3.5 inline mr-1 text-vermilion" />
              {{ variant.researcherNote }}
            </div>
          </div>

          <div
            v-if="selectedVariantId === variant.id"
            class="flex-shrink-0 space-y-2"
            @click.stop
          >
            <div class="text-xs font-serif text-ink-muted mb-1">采信结论</div>
            <div class="flex gap-1">
              <button
                class="p-1.5 rounded hover:bg-moss/10 transition-colors"
                :class="{
                  'bg-moss/20': variant.acceptance === 'accepted',
                }"
                title="采信"
                @click="setAcceptance(variant, 'accepted')"
              >
                <CheckCircle class="w-4 h-4 text-moss" />
              </button>
              <button
                class="p-1.5 rounded hover:bg-carmine/10 transition-colors"
                :class="{
                  'bg-carmine/20': variant.acceptance === 'rejected',
                }"
                title="不采信"
                @click="setAcceptance(variant, 'rejected')"
              >
                <XCircle class="w-4 h-4 text-carmine" />
              </button>
              <button
                class="p-1.5 rounded hover:bg-azure/10 transition-colors"
                :class="{
                  'bg-azure/20': variant.acceptance === 'tentative',
                }"
                title="暂定"
                @click="setAcceptance(variant, 'tentative')"
              >
                <Clock class="w-4 h-4 text-azure" />
              </button>
              <button
                class="p-1.5 rounded hover:bg-rattan/10 transition-colors"
                :class="{
                  'bg-rattan/20': variant.acceptance === 'needs_review',
                }"
                title="待复核"
                @click="setAcceptance(variant, 'needs_review')"
              >
                <AlertTriangle class="w-4 h-4 text-rattan-dark" />
              </button>
            </div>

            <div class="text-xs font-serif text-ink-muted mb-1 mt-3">分类</div>
            <select
              :value="variant.category"
              class="input-xs"
              @change="
                setCategory(
                  variant,
                  ($event.target as HTMLSelectElement).value as VariantCategory
                )
              "
            >
              <option
                v-for="(meta, key) in VARIANT_CATEGORY_META"
                :key="key"
                :value="key"
              >
                {{ meta.label }}
              </option>
            </select>

            <div class="flex gap-1 mt-3">
              <button
                class="btn-xs btn-secondary"
                @click="openEvolutionModal(variant)"
              >
                <GitBranch class="w-3 h-3 mr-1" />
                演变
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="selectedVariantId === variant.id"
          class="mt-4 pt-4 border-t border-ink/10"
          @click.stop
        >
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-serif text-ink-muted mb-1">
                研究备注
              </label>
              <textarea
                :value="variant.researcherNote || ''"
                placeholder="记录对该异文的研究心得、考辨依据..."
                class="input w-full"
                rows="2"
                @blur="updateNote(variant, ($event.target as HTMLTextAreaElement).value)"
              />
            </div>

            <div
              v-if="variant.evolutionPath"
              class="bg-paper-50 p-3 rounded-lg border border-ink/10"
            >
              <div class="text-xs font-serif text-ink-muted mb-2 flex items-center gap-1">
                <GitBranch class="w-3.5 h-3.5 text-vermilion" />
                演变路径
                <span class="ml-auto text-[10px]">
                  置信度 {{ (variant.evolutionPath.confidence * 100).toFixed(0) }}%
                </span>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <template
                  v-for="(step, idx) in variant.evolutionPath.steps"
                  :key="idx"
                >
                  <div
                    class="inline-flex items-center gap-1 px-2 py-1 rounded bg-paper-100 border border-ink/10"
                  >
                    <span class="text-xs font-serif text-ink">
                      {{ step.text }}
                    </span>
                    <span class="text-[10px] text-ink-muted">
                      {{ step.versionName }}
                    </span>
                  </div>
                  <ArrowRight
                    v-if="idx < variant.evolutionPath.steps.length - 1"
                    class="w-3 h-3 text-ink-pale"
                  />
                </template>
              </div>
              <div
                v-if="variant.evolutionPath.evidence"
                class="mt-2 text-xs text-ink-muted font-serif"
              >
                依据：{{ variant.evolutionPath.evidence }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="filteredVariants.length === 0"
        class="card p-8 text-center"
      >
        <ScrollText class="w-12 h-12 text-ink-pale mx-auto mb-3" />
        <div class="font-serif text-ink-muted mb-2">暂无异文记录</div>
        <p class="text-sm text-ink-pale font-serif">
          {{
            variantStore.variants.length === 0
              ? '请点击「扫描异文」按钮开始跨版本比对'
              : '当前筛选条件下没有匹配的异文，请调整筛选条件'
          }}
        </p>
      </div>
    </div>

    <div v-if="activeTab === 'parallel'" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="version in [baseVersion, ...comparingVersions].filter(
            (v): v is NonNullable<typeof v> => v !== null
          )"
          :key="version.id"
          class="card p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-serif"
                :class="VERSION_TYPE_META[version.versionType].cls"
              >
                {{ VERSION_TYPE_META[version.versionType].label }}
              </span>
              <span class="font-serif font-medium text-ink">{{ version.name }}</span>
              <span class="text-xs text-ink-muted font-serif">
                {{ version.shortName }}
              </span>
            </div>
            <span
              v-if="version.dynasty"
              class="text-xs text-ink-muted font-serif"
            >
              {{ version.dynasty }}
            </span>
          </div>
          <div
            class="font-serif text-ink leading-loose whitespace-pre-wrap max-h-[500px] overflow-y-auto text-sm border border-ink/10 rounded p-3 bg-paper-50"
          >
            {{ getParallelText(version.id) }}
          </div>
          <div class="mt-2 text-xs text-ink-muted font-serif">
            字数：{{ getParallelText(version.id).length }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper-50 px-4 py-2 rounded-md shadow-lg font-serif text-sm animate-fade-in"
    >
      {{ toast }}
    </div>

    <Teleport to="body">
      <div
        v-if="showAutoAcceptModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          @click="showAutoAcceptModal = false"
        />
        <div class="relative card p-6 w-full max-w-md">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-title text-ink flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-vermilion" />
              自动采信高置信度异文
            </h3>
            <button
              class="p-1 hover:bg-paper-200 rounded"
              @click="showAutoAcceptModal = false"
            >
              <X class="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-serif text-ink mb-1">
                最低置信度阈值
              </label>
              <input
                v-model.number="autoAcceptForm.minConfidence"
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                class="w-full"
              />
              <div class="text-xs text-ink-muted font-serif text-center">
                {{ (autoAcceptForm.minConfidence * 100).toFixed(0) }}%
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="autoAcceptForm.preferEarlierVersions"
                type="checkbox"
                class="checkbox"
              />
              <span class="text-sm font-serif text-ink">优先采信较早版本</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <input
                v-model="autoAcceptForm.preferMajorityReading"
                type="checkbox"
                class="checkbox"
              />
              <span class="text-sm font-serif text-ink">优先采信多数版本读法</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button
              class="btn-secondary"
              @click="showAutoAcceptModal = false"
            >
              取消
            </button>
            <button class="btn-primary" @click="runAutoAccept">
              <Check class="w-4 h-4 mr-1" />
              执行自动采信
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showEvolutionModal"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          @click="showEvolutionModal = false"
        />
        <div class="relative card p-6 w-full max-w-2xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-title text-ink flex items-center gap-2">
              <GitBranch class="w-5 h-5 text-vermilion" />
              编辑演变路径
            </h3>
            <button
              class="p-1 hover:bg-paper-200 rounded"
              @click="showEvolutionModal = false"
            >
              <X class="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-serif text-ink mb-1">
                  演变方向
                </label>
                <select v-model="evolutionForm.direction" class="input">
                  <option value="earlier_to_later">由早到晚</option>
                  <option value="later_to_earlier">由晚到早</option>
                  <option value="undetermined">方向未定</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-serif text-ink mb-1">
                  置信度
                </label>
                <input
                  v-model.number="evolutionForm.confidence"
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  class="w-full mt-2"
                />
                <div class="text-xs text-ink-muted font-serif text-center">
                  {{ (evolutionForm.confidence * 100).toFixed(0) }}%
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-serif text-ink mb-1">
                证据依据
              </label>
              <textarea
                v-model="evolutionForm.evidence"
                placeholder="描述判断演变方向的依据..."
                class="input w-full"
                rows="2"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-sm font-serif text-ink">演变步骤</label>
                <button class="btn-xs btn-secondary" @click="addEvolutionStep">
                  <Plus class="w-3 h-3 mr-1" />
                  添加步骤
                </button>
              </div>
              <div class="space-y-2">
                <div
                  v-for="(step, idx) in evolutionForm.steps"
                  :key="idx"
                  class="flex items-center gap-2 p-3 bg-paper-50 rounded-lg border border-ink/10"
                >
                  <span class="text-xs text-ink-muted font-serif w-6">
                    {{ idx + 1 }}
                  </span>
                  <select
                    v-model="step.versionId"
                    class="input-sm flex-1"
                    @change="
                      step.versionName =
                        getVersionById(step.versionId)?.name || ''
                    "
                  >
                    <option value="">选择版本</option>
                    <option
                      v-for="v in projectVersions"
                      :key="v.id"
                      :value="v.id"
                    >
                      {{ v.name }}
                    </option>
                  </select>
                  <input
                    v-model="step.text"
                    type="text"
                    placeholder="异文"
                    class="input-sm flex-1"
                  />
                  <select
                    v-model="step.changeType"
                    class="input-sm w-28"
                  >
                    <option value="modification">改字</option>
                    <option value="addition">增字</option>
                    <option value="deletion">删字</option>
                    <option value="taboo">避讳</option>
                    <option value="correction">校正</option>
                  </select>
                  <button
                    class="p-1.5 hover:bg-carmine/10 rounded"
                    title="删除"
                    @click="removeEvolutionStep(idx)"
                  >
                    <X class="w-4 h-4 text-carmine" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button
              class="btn-secondary"
              @click="showEvolutionModal = false"
            >
              取消
            </button>
            <button class="btn-primary" @click="saveEvolutionPath">
              <Check class="w-4 h-4 mr-1" />
              保存演变路径
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
