<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  GitBranch,
  BarChart3,
  BookOpen,
  ScrollText,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Settings,
  RefreshCw,
} from 'lucide-vue-next';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useVersionStore } from '@/stores/versionStore';
import { useVariantStore } from '@/stores/variantStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useCitationStore } from '@/stores/citationStore';
import type { CollationReport, VariantEntry } from '@/types';
import {
  VARIANT_CATEGORY_META,
  ACCEPTANCE_META,
  VERSION_TYPE_META,
} from '@/types';
import {
  generateCollationReport,
  generateCollationReportJSON,
  generateCollationReportTXT,
  downloadFile,
} from '@/utils/collationReportEngine';
import { formatDate } from '@/utils/exportEngine';

const versionStore = useVersionStore();
const variantStore = useVariantStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const citationStore = useCitationStore();
const router = useRouter();
const route = useRoute();

const toast = ref('');
const report = ref<CollationReport | null>(null);
const activeSection = ref<'summary' | 'versions' | 'tree' | 'statistics' | 'variants' | 'appendices'>('summary');
const expandedVariants = ref<Set<string>>(new Set());
const showPrinciplesModal = ref(false);
const showExportModal = ref(false);

const collationPrinciples = ref(`一、校勘底本
本次校勘以最早或最善之本为底本，参校各传世版本。

二、异文判断原则
1. 凡避讳改字，依当时避讳制度判断其年代层级
2. 凡传抄异文，择其义长者从之，或并存备考
3. 凡后出改字，审慎考辨其改动原因，非必误者不辄改
4. 凡字形变异，标注异体关系，不强行统一

三、采择标准
1. 优先采信较早版本的读法
2. 多数版本一致的读法优先考虑
3. 符合上下文语境、文义贯通者优先
4. 有文献佐证者优先

四、标识体例
1. [采信] 表示确定从某本
2. [暂定] 表示暂时从某本，容后再考
3. [待复核] 表示异文性质有待进一步研究
4. [不采信] 表示确定不从某本`);

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

onMounted(() => {
  if (!versionStore.initialized) versionStore.load();
  if (!variantStore.initialized) variantStore.load();
  if (!projectStore.initialized) projectStore.load();
  if (!citationStore.initialized) citationStore.load();

  generateReport();
});

const project = computed(() => projectStore.currentProject);

const projectVersions = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.getVersionsByProject(projectStore.currentProjectId);
});

const versionTree = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.buildVersionTree(projectStore.currentProjectId);
});

const versionRelations = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.getRelationsByProject(projectStore.currentProjectId);
});

const projectVariants = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return variantStore.getVariantsByProject(projectStore.currentProjectId);
});

const projectCitations = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return citationStore.citations.filter((c) => c.projectId === projectStore.currentProjectId);
});

function generateReport() {
  if (!project.value) {
    flashToast('请先选择项目');
    return;
  }
  if (projectVariants.value.length === 0) {
    flashToast('请先完成异文扫描');
    return;
  }

  report.value = generateCollationReport({
    projectId: project.value.id,
    projectName: project.value.name,
    projectDynasty: project.value.dynasty,
    projectBookTitle: project.value.bookTitle,
    projectVolume: project.value.volume,
    versions: projectVersions.value,
    versionTree: versionTree.value,
    versionRelations: versionRelations.value,
    variants: projectVariants.value,
    statistics: variantStore.statistics,
    generatedBy: '本地用户',
    collationPrinciples: collationPrinciples.value,
    citations: projectCitations.value,
  });

  auditStore.addLog({
    actionType: 'collation_report_generate',
    actor: '本地用户',
    projectId: project.value.id,
    description: `生成校勘报告：${report.value.title}`,
  });

  flashToast('校勘报告已生成');
}

function toggleVariant(id: string) {
  if (expandedVariants.value.has(id)) {
    expandedVariants.value.delete(id);
  } else {
    expandedVariants.value.add(id);
  }
  expandedVariants.value = new Set(expandedVariants.value);
}

function exportJSON() {
  if (!report.value) return;
  const json = generateCollationReportJSON(report.value);
  downloadFile(json, `校勘报告_${formatDate(Date.now())}.json`, 'application/json');
  flashToast('JSON 格式报告已导出');

  auditStore.addLog({
    actionType: 'collation_report_export',
    actor: '本地用户',
    projectId: project.value?.id,
    description: `导出校勘报告（JSON格式）：${report.value.title}`,
  });
}

function exportTXT() {
  if (!report.value) return;
  const txt = generateCollationReportTXT(report.value);
  downloadFile(txt, `校勘报告_${formatDate(Date.now())}.txt`, 'text/plain');
  flashToast('TXT 格式报告已导出');

  auditStore.addLog({
    actionType: 'collation_report_export',
    actor: '本地用户',
    projectId: project.value?.id,
    description: `导出校勘报告（TXT格式）：${report.value.title}`,
  });
}

async function copyToClipboard() {
  if (!report.value) return;
  const txt = generateCollationReportTXT(report.value);
  try {
    await navigator.clipboard.writeText(txt);
    flashToast('报告内容已复制到剪贴板');
  } catch {
    flashToast('复制失败，请手动选择复制');
  }
}

function printReport() {
  window.print();
}

function getVersionById(id: string) {
  return versionStore.versions.find((v) => v.id === id);
}

function getReadingVersions(variant: VariantEntry, reading: { versionIds: string[] }): string {
  return reading.versionIds
    .map((id) => getVersionById(id)?.shortName || id)
    .join('、');
}

const sections = [
  { key: 'summary', label: '摘要', icon: FileText },
  { key: 'versions', label: '版本目录', icon: BookOpen },
  { key: 'tree', label: '版本谱系', icon: GitBranch },
  { key: 'statistics', label: '异文统计', icon: BarChart3 },
  { key: 'variants', label: '异文考辨', icon: ListChecks },
  { key: 'appendices', label: '附录', icon: ScrollText },
] as const;
</script>

<template>
  <div class="print-container">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print-hidden">
      <div>
        <h1 class="text-2xl font-title text-ink flex items-center gap-2">
          <ScrollText class="w-6 h-6 text-vermilion" />
          校勘报告
        </h1>
        <p class="text-sm text-ink-muted font-serif mt-1">
          版本谱系 · 异文统计 · 采择依据
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          class="btn-secondary !py-1.5"
          @click="showPrinciplesModal = true"
        >
          <Settings class="w-4 h-4 mr-1" />
          校勘凡例
        </button>
        <button
          class="btn-secondary !py-1.5"
          @click="generateReport"
        >
          <RefreshCw class="w-4 h-4 mr-1" />
          重新生成
        </button>
        <button
          class="btn-secondary !py-1.5"
          @click="showExportModal = true"
          :disabled="!report"
        >
          <Download class="w-4 h-4 mr-1" />
          导出
        </button>
        <button
          class="btn-secondary !py-1.5"
          @click="copyToClipboard"
          :disabled="!report"
        >
          <Copy class="w-4 h-4 mr-1" />
          复制
        </button>
        <button
          class="btn-primary !py-1.5"
          @click="printReport"
          :disabled="!report"
        >
          <Printer class="w-4 h-4 mr-1" />
          打印
        </button>
      </div>
    </div>

    <div v-if="!report" class="card p-12 text-center">
      <ScrollText class="w-16 h-16 text-ink-pale mx-auto mb-4" />
      <div class="font-serif text-ink text-lg mb-2">暂无可生成的报告</div>
      <p class="text-sm text-ink-muted font-serif mb-4">
        请先在版本对读页面完成异文扫描和采信判断
      </p>
      <RouterLink to="/collation" class="btn-primary">
        <ArrowRight class="w-4 h-4 mr-1" />
        前往版本对读
      </RouterLink>
    </div>

    <div v-else class="space-y-6">
      <div class="card p-6 text-center border-2 border-vermilion/30 bg-vermilion/5">
        <h2 class="text-3xl font-title text-ink tracking-wider mb-2">
          {{ report.title }}
        </h2>
        <div class="text-sm text-ink-muted font-serif">
          编制者：{{ report.generatedBy }}　｜　生成时间：{{ formatDate(report.generatedAt) }}
        </div>
      </div>

      <div class="flex gap-1 border-b border-ink/10 print-hidden overflow-x-auto">
        <button
          v-for="section in sections"
          :key="section.key"
          class="px-4 py-2 text-sm font-serif whitespace-nowrap transition-colors"
          :class="
            activeSection === section.key
              ? 'text-vermilion border-b-2 border-vermilion -mb-px'
              : 'text-ink-muted hover:text-ink'
          "
          @click="activeSection = section.key"
        >
          <component :is="section.icon" class="w-4 h-4 inline mr-1.5" />
          {{ section.label }}
        </button>
      </div>

      <div v-if="activeSection === 'summary'" class="space-y-6">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-4 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              一
            </span>
            摘　要
          </h3>
          <div class="font-serif text-ink leading-loose whitespace-pre-wrap">
            {{ report.summary }}
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card p-4 text-center">
            <div class="text-3xl font-title text-ink">
              {{ report.variants.length }}
            </div>
            <div class="text-xs text-ink-muted font-serif mt-1">异文总数</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-3xl font-title text-vermilion">
              {{ report.variantStatistics.tabooLayeredCount }}
            </div>
            <div class="text-xs text-ink-muted font-serif mt-1">避讳层累</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-3xl font-title text-carmine">
              {{ report.variantStatistics.laterRevisionCount }}
            </div>
            <div class="text-xs text-ink-muted font-serif mt-1">后出改字</div>
          </div>
          <div class="card p-4 text-center">
            <div class="text-3xl font-title text-moss">
              {{
                report.variantStatistics.byAcceptance.accepted +
                report.variantStatistics.byAcceptance.tentative
              }}
            </div>
            <div class="text-xs text-ink-muted font-serif mt-1">已采信</div>
          </div>
        </div>
      </div>

      <div v-if="activeSection === 'versions'" class="space-y-4">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-6 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              二
            </span>
            版　本　目　录
          </h3>
          <div class="space-y-4">
            <div
              v-for="(version, idx) in report.versions"
              :key="version.id"
              class="p-4 bg-paper-50 rounded-lg border border-ink/10"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg font-title text-ink">
                      版本 {{ idx + 1 }}
                    </span>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-serif"
                      :class="VERSION_TYPE_META[version.versionType].cls"
                    >
                      {{ VERSION_TYPE_META[version.versionType].label }}
                    </span>
                    <span class="font-serif font-medium text-ink text-lg">
                      {{ version.name }}
                    </span>
                    <span class="text-ink-muted font-serif">
                      （{{ version.shortName }}）
                    </span>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm font-serif">
                    <div v-if="version.dynasty">
                      <span class="text-ink-muted">朝代：</span>
                      <span class="text-ink">{{ version.dynasty }}</span>
                    </div>
                    <div v-if="version.era">
                      <span class="text-ink-muted">时代：</span>
                      <span class="text-ink">{{ version.era }}</span>
                    </div>
                    <div v-if="version.provenance">
                      <span class="text-ink-muted">来源：</span>
                      <span class="text-ink">{{ version.provenance }}</span>
                    </div>
                    <div v-if="version.repository">
                      <span class="text-ink-muted">藏馆：</span>
                      <span class="text-ink">{{ version.repository }}</span>
                    </div>
                    <div v-if="version.shelfMark">
                      <span class="text-ink-muted">索书号：</span>
                      <span class="text-ink">{{ version.shelfMark }}</span>
                    </div>
                    <div v-if="version.scribe">
                      <span class="text-ink-muted">抄手：</span>
                      <span class="text-ink">{{ version.scribe }}</span>
                    </div>
                    <div v-if="version.transcriptionYear">
                      <span class="text-ink-muted">刊刻年代：</span>
                      <span class="text-ink">{{ version.transcriptionYear }}</span>
                    </div>
                    <div class="col-span-2 md:col-span-3">
                      <span class="text-ink-muted">篇幅：</span>
                      <span class="text-ink">
                        {{ version.chapters.length }} 章，共 {{ version.fullText.length }} 字
                      </span>
                    </div>
                  </div>
                  <div
                    v-if="version.collationNote"
                    class="mt-2 text-sm font-serif text-ink-muted"
                  >
                    <span class="text-ink-muted">校勘说明：</span>
                    {{ version.collationNote }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeSection === 'tree'" class="space-y-6">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-6 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              三
            </span>
            版　本　谱　系
          </h3>

          <div class="bg-paper-50 p-6 rounded-lg border border-ink/10 overflow-x-auto">
            <svg
              :width="Math.max(800, versionTree.length * 200)"
              :height="Math.max(300, (versionTree.length + 1) * 80)"
              class="mx-auto"
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                </marker>
              </defs>

              <g v-for="node in versionTree" :key="node.id">
                <line
                  v-for="childId in node.children"
                  :key="`line-${node.id}-${childId}`"
                  :x1="node.x + 75"
                  :y1="node.y + 30"
                  :x2="
                    (versionTree.find((n) => n.id === childId)?.x || 0) + 75
                  "
                  :y2="
                    (versionTree.find((n) => n.id === childId)?.y || 0) - 10
                  "
                  stroke="#d1d5db"
                  stroke-width="2"
                  marker-end="url(#arrowhead)"
                />

                <rect
                  :x="node.x"
                  :y="node.y"
                  width="150"
                  height="60"
                  rx="8"
                  :fill="
                    node.version.versionType === 'original'
                      ? '#fef2f2'
                      : node.version.versionType === 'ancestor'
                      ? '#fef9c3'
                      : '#f0f9ff'
                  "
                  :stroke="
                    node.version.versionType === 'original'
                      ? '#ef4444'
                      : node.version.versionType === 'ancestor'
                      ? '#eab308'
                      : '#3b82f6'
                  "
                  stroke-width="2"
                />
                <text
                  :x="node.x + 75"
                  :y="node.y + 25"
                  text-anchor="middle"
                  class="text-sm font-serif font-bold"
                  :fill="
                    node.version.versionType === 'original'
                      ? '#dc2626'
                      : node.version.versionType === 'ancestor'
                      ? '#a16207'
                      : '#2563eb'
                  "
                >
                  {{ node.version.shortName }}
                </text>
                <text
                  :x="node.x + 75"
                  :y="node.y + 42"
                  text-anchor="middle"
                  class="text-[10px] font-serif"
                  fill="#6b7280"
                >
                  {{ VERSION_TYPE_META[node.version.versionType].label }}
                </text>
                <text
                  :x="node.x + 75"
                  :y="node.y + 54"
                  text-anchor="middle"
                  class="text-[9px] font-serif"
                  fill="#9ca3af"
                >
                  {{ node.version.dynasty || '' }}
                </text>
              </g>
            </svg>
          </div>

          <div class="mt-6">
            <h4 class="font-title text-ink mb-3">版本关系说明</h4>
            <div
              v-if="report.versionRelations.length === 0"
              class="text-sm text-ink-muted font-serif"
            >
              暂无版本关系记录
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="rel in report.versionRelations"
                :key="rel.id"
                class="flex items-center gap-2 p-3 bg-paper-50 rounded text-sm font-serif"
              >
                <span class="font-medium text-ink">
                  {{ getVersionById(rel.sourceVersionId)?.shortName }}
                </span>
                <ArrowRight class="w-4 h-4 text-ink-pale" />
                <span class="font-medium text-ink">
                  {{ getVersionById(rel.targetVersionId)?.shortName }}
                </span>
                <span class="text-ink-muted">
                  （{{
                    {
                      parent_child: '直接传承',
                      sibling: '并列关系',
                      derived_from: '间接衍生',
                      collated_with: '参校关系',
                    }[rel.relationType]
                  }}）
                </span>
                <span class="text-ink-pale text-xs ml-auto">
                  置信度 {{ (rel.confidence * 100).toFixed(0) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeSection === 'statistics'" class="space-y-6">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-6 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              四
            </span>
            异　文　统　计
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-title text-ink mb-4 flex items-center gap-2">
                <BarChart3 class="w-4 h-4 text-vermilion" />
                按异文类型
              </h4>
              <div class="space-y-3">
                <div
                  v-for="(meta, key) in VARIANT_CATEGORY_META"
                  :key="key"
                  class="flex items-center gap-3"
                >
                  <span class="w-20 text-sm font-serif text-ink-muted">
                    {{ meta.label }}
                  </span>
                  <div class="flex-1 h-6 bg-paper-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="{
                        'bg-rattan': key === 'transcription',
                        'bg-vermilion': key === 'taboo_layered',
                        'bg-carmine': key === 'later_revision',
                        'bg-azure': key === 'orthographic',
                        'bg-purple': key === 'phonetic',
                        'bg-amber': key === 'missing',
                        'bg-indigo': key === 'added',
                        'bg-ink-pale': key === 'disputed',
                      }"
                      :style="{
                        width: `${
                          report.variants.length > 0
                            ? (report.variantStatistics.byCategory[
                                key as keyof typeof report.variantStatistics.byCategory
                              ] /
                                report.variants.length) *
                              100
                            : 0
                        }%`,
                      }"
                    />
                  </div>
                  <span class="w-12 text-right font-serif text-ink">
                    {{
                      report.variantStatistics.byCategory[
                        key as keyof typeof report.variantStatistics.byCategory
                      ]
                    }}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 class="font-title text-ink mb-4 flex items-center gap-2">
                <ListChecks class="w-4 h-4 text-vermilion" />
                按采信状态
              </h4>
              <div class="space-y-3">
                <div
                  v-for="(meta, key) in ACCEPTANCE_META"
                  :key="key"
                  class="flex items-center gap-3"
                >
                  <span class="w-20 text-sm font-serif text-ink-muted">
                    {{ meta.label }}
                  </span>
                  <div class="flex-1 h-6 bg-paper-100 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="{
                        'bg-moss': key === 'accepted',
                        'bg-carmine': key === 'rejected',
                        'bg-azure': key === 'tentative',
                        'bg-rattan': key === 'needs_review',
                      }"
                      :style="{
                        width: `${
                          report.variants.length > 0
                            ? (report.variantStatistics.byAcceptance[
                                key as keyof typeof report.variantStatistics.byAcceptance
                              ] /
                                report.variants.length) *
                              100
                            : 0
                        }%`,
                      }"
                    />
                  </div>
                  <span class="w-12 text-right font-serif text-ink">
                    {{
                      report.variantStatistics.byAcceptance[
                        key as keyof typeof report.variantStatistics.byAcceptance
                      ]
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 bg-rattan/10 rounded-lg border border-rattan/30 text-center">
              <div class="text-2xl font-title text-rattan-dark">
                {{ report.variantStatistics.tabooLayeredCount }}
              </div>
              <div class="text-xs text-ink-muted font-serif mt-1">
                避讳层累
              </div>
            </div>
            <div class="p-4 bg-carmine/10 rounded-lg border border-carmine/30 text-center">
              <div class="text-2xl font-title text-carmine">
                {{ report.variantStatistics.laterRevisionCount }}
              </div>
              <div class="text-xs text-ink-muted font-serif mt-1">
                后出改字
              </div>
            </div>
            <div class="p-4 bg-azure/10 rounded-lg border border-azure/30 text-center">
              <div class="text-2xl font-title text-azure">
                {{ report.variantStatistics.transcriptionCount }}
              </div>
              <div class="text-xs text-ink-muted font-serif mt-1">
                传抄异文
              </div>
            </div>
            <div class="p-4 bg-ink/5 rounded-lg border border-ink/20 text-center">
              <div class="text-2xl font-title text-ink-muted">
                {{ report.variantStatistics.disputedCount }}
              </div>
              <div class="text-xs text-ink-muted font-serif mt-1">
                存疑待考
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeSection === 'variants'" class="space-y-4">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-6 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              五
            </span>
            异　文　考　辨
          </h3>

          <div class="space-y-3">
            <div
              v-for="(variant, idx) in report.variants"
              :key="variant.id"
              class="border border-ink/10 rounded-lg overflow-hidden"
            >
              <div
                class="p-4 bg-paper-50 cursor-pointer hover:bg-paper-100 transition-colors"
                @click="toggleVariant(variant.id)"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <span class="text-sm font-serif text-ink-muted">
                        【异文 {{ idx + 1 }}】
                      </span>
                      <span
                        v-if="variant.chapterTitle"
                        class="text-xs text-ink-muted font-serif"
                      >
                        <BookOpen class="w-3 h-3 inline mr-1" />
                        {{ variant.chapterTitle }}
                      </span>
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
                      <span class="text-xs text-ink-muted font-serif">
                        置信度 {{ Math.round(variant.categoryConfidence * 100) }}%
                      </span>
                    </div>
                    <div class="font-serif text-ink leading-relaxed">
                      <span class="text-ink-muted">{{ variant.contextBefore }}</span>
                      <span
                        v-for="(reading, ridx) in variant.variants"
                        :key="ridx"
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
                          {{ getReadingVersions(variant, reading) }}
                        </span>
                      </span>
                      <span class="text-ink-muted">{{ variant.contextAfter }}</span>
                    </div>
                  </div>
                  <component
                    :is="
                      expandedVariants.has(variant.id)
                        ? ChevronDown
                        : ChevronRight
                    "
                    class="w-5 h-5 text-ink-pale flex-shrink-0 mt-1"
                  />
                </div>
              </div>

              <div
                v-if="expandedVariants.has(variant.id)"
                class="p-4 border-t border-ink/10 space-y-4 bg-white"
              >
                <div>
                  <h5 class="text-sm font-title text-ink mb-2">各版本读法</h5>
                  <div class="space-y-2">
                    <div
                      v-for="(reading, ridx) in variant.variants"
                      :key="ridx"
                      class="flex items-center gap-2 p-2 bg-paper-50 rounded"
                    >
                      <span class="text-ink-muted font-serif text-sm w-6">
                        {{ ridx + 1 }}.
                      </span>
                      <span
                        class="font-serif text-ink"
                        :class="{
                          'text-vermilion font-bold': reading.isBaseReading,
                        }"
                      >
                        "{{ reading.text }}"
                      </span>
                      <span class="text-ink-muted font-serif text-sm">
                        —— {{ getReadingVersions(variant, reading) }}
                      </span>
                      <span
                        v-if="reading.isBaseReading"
                        class="text-xs text-vermilion font-serif"
                      >
                        （底本读法）
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="variant.acceptedReading">
                  <h5 class="text-sm font-title text-ink mb-2">采择结论</h5>
                  <div class="p-3 bg-moss/10 rounded-lg border border-moss/30">
                    <div class="font-serif text-ink">
                      采信读法：
                      <strong class="text-moss mx-1">
                        "{{ variant.acceptedReading }}"
                      </strong>
                      <span class="text-ink-muted text-sm">
                        （{{
                          getVersionById(variant.acceptedVersionId || '')
                            ?.name || '未定'
                        }}）
                      </span>
                    </div>
                    <div
                      v-if="variant.researcherNote"
                      class="mt-2 text-sm font-serif text-ink-muted"
                    >
                      考辨依据：{{ variant.researcherNote }}
                    </div>
                    <div
                      v-if="variant.collationNote"
                      class="mt-2 text-sm font-serif text-ink-muted"
                    >
                      校勘记：{{ variant.collationNote }}
                    </div>
                  </div>
                </div>

                <div
                  v-if="variant.evolutionPath && variant.evolutionPath.steps.length > 1"
                >
                  <h5 class="text-sm font-title text-ink mb-2 flex items-center gap-2">
                    <GitBranch class="w-4 h-4 text-vermilion" />
                    演变路径
                  </h5>
                  <div class="p-3 bg-paper-50 rounded-lg border border-ink/10">
                    <div class="text-xs text-ink-muted font-serif mb-2">
                      方向：
                      {{
                        variant.evolutionPath.direction === 'earlier_to_later'
                          ? '由早到晚'
                          : variant.evolutionPath.direction ===
                            'later_to_earlier'
                          ? '由晚到早'
                          : '方向未定'
                      }}
                      ｜ 置信度：{{
                        Math.round(variant.evolutionPath.confidence * 100)
                      }}%
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <template
                        v-for="(step, sidx) in variant.evolutionPath.steps"
                        :key="sidx"
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
                          v-if="sidx < variant.evolutionPath.steps.length - 1"
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

                <div v-if="variant.suspectedTaboo">
                  <h5 class="text-sm font-title text-ink mb-2">相关避讳规则</h5>
                  <div class="p-3 bg-rattan/10 rounded-lg border border-rattan/30">
                    <div class="font-serif text-ink">
                      <span class="text-rattan-dark font-bold">
                        {{ variant.suspectedTaboo.originalChar }}
                      </span>
                      <ArrowRight class="w-3 h-3 inline mx-2" />
                      <span class="text-vermilion font-bold">
                        {{ variant.suspectedTaboo.replacedChar }}
                      </span>
                      <span v-if="variant.suspectedTaboo.dynasty" class="text-ink-muted text-sm ml-2">
                        （{{ variant.suspectedTaboo.dynasty }}）
                      </span>
                    </div>
                    <div
                      v-if="variant.suspectedTaboo.note"
                      class="mt-1 text-sm text-ink-muted font-serif"
                    >
                      说明：{{ variant.suspectedTaboo.note }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeSection === 'appendices'" class="space-y-6">
        <div class="card p-6">
          <h3 class="text-lg font-title text-ink mb-6 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-vermilion/10 text-vermilion flex items-center justify-center text-sm font-bold">
              六
            </span>
            校　勘　凡　例
          </h3>
          <div class="font-serif text-ink leading-loose whitespace-pre-wrap bg-paper-50 p-4 rounded-lg border border-ink/10">
            {{ report.collationPrinciples }}
          </div>
        </div>

        <div
          v-for="appendix in report.appendices"
          :key="appendix.id"
          class="card p-6"
        >
          <h3 class="text-lg font-title text-ink mb-4">
            附　录　{{ appendix.title }}
          </h3>
          <div class="font-serif text-ink leading-loose whitespace-pre-wrap bg-paper-50 p-4 rounded-lg border border-ink/10 text-sm">
            {{ appendix.content }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper-50 px-4 py-2 rounded-md shadow-lg font-serif text-sm animate-fade-in print-hidden"
    >
      {{ toast }}
    </div>

    <Teleport to="body">
      <div
        v-if="showPrinciplesModal"
        class="fixed inset-0 z-50 flex items-center justify-center print-hidden"
      >
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          @click="showPrinciplesModal = false"
        />
        <div class="relative card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-title text-ink flex items-center gap-2">
              <Settings class="w-5 h-5 text-vermilion" />
              编辑校勘凡例
            </h3>
            <button
              class="p-1 hover:bg-paper-200 rounded"
              @click="showPrinciplesModal = false"
            >
              <X class="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          <textarea
            v-model="collationPrinciples"
            class="input w-full font-serif"
            rows="15"
            placeholder="请输入校勘凡例..."
          />

          <div class="flex justify-end gap-2 mt-4">
            <button
              class="btn-secondary"
              @click="showPrinciplesModal = false"
            >
              取消
            </button>
            <button
              class="btn-primary"
              @click="generateReport(); showPrinciplesModal = false"
            >
              <Check class="w-4 h-4 mr-1" />
              保存并重新生成
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showExportModal"
        class="fixed inset-0 z-50 flex items-center justify-center print-hidden"
      >
        <div
          class="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          @click="showExportModal = false"
        />
        <div class="relative card p-6 w-full max-w-md">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-title text-ink flex items-center gap-2">
              <Download class="w-5 h-5 text-vermilion" />
              导出校勘报告
            </h3>
            <button
              class="p-1 hover:bg-paper-200 rounded"
              @click="showExportModal = false"
            >
              <X class="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          <div class="space-y-3">
            <button
              class="w-full card p-4 text-left hover:bg-paper-100 transition-colors"
              @click="exportJSON(); showExportModal = false"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-azure/10 flex items-center justify-center">
                  <FileText class="w-5 h-5 text-azure" />
                </div>
                <div>
                  <div class="font-serif text-ink">JSON 格式</div>
                  <div class="text-xs text-ink-muted font-serif">
                    结构化数据，便于程序处理
                  </div>
                </div>
              </div>
            </button>

            <button
              class="w-full card p-4 text-left hover:bg-paper-100 transition-colors"
              @click="exportTXT(); showExportModal = false"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-moss/10 flex items-center justify-center">
                  <ScrollText class="w-5 h-5 text-moss" />
                </div>
                <div>
                  <div class="font-serif text-ink">TXT 格式</div>
                  <div class="text-xs text-ink-muted font-serif">
                    纯文本格式，便于阅读打印
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@media print {
  .print-hidden {
    display: none !important;
  }
  .print-container {
    max-width: 100%;
    padding: 0;
  }
}
</style>
