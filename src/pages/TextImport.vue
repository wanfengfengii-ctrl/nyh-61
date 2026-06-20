<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  FileText,
  Upload,
  ScanSearch,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Sparkles,
  FileScan,
  ArrowRight,
  BookOpenCheck,
  Eraser,
} from 'lucide-vue-next';
import { RouterLink, useRoute } from 'vue-router';
import { useTextStore } from '@/stores/textStore';
import { useDiffStore } from '@/stores/diffStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { formatDate } from '@/utils/exportEngine';

const textStore = useTextStore();
const diffStore = useDiffStore();
const ruleStore = useRuleStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const route = useRoute();

const originalLocal = ref(textStore.originalText);
const revisedLocal = ref(textStore.revisedText);
const scanError = ref('');
const showSuccess = ref(false);
const reasonToast = ref('');

const reasonMap: Record<string, string> = {
  needtext: '请先填写原文与校改文本后再执行扫描。',
  nodiff: '尚未检测到任何差异，请先执行差异扫描。',
};

onMounted(() => {
  const r = route.query.reason as string | undefined;
  if (r && reasonMap[r]) {
    reasonToast.value = reasonMap[r];
    setTimeout(() => (reasonToast.value = ''), 4000);
  }
});

watch(
  [originalLocal, revisedLocal],
  () => {
    textStore.setTexts(originalLocal.value, revisedLocal.value);
  },
);

const originalEmpty = computed(() => originalLocal.value.trim().length === 0);
const revisedEmpty = computed(() => revisedLocal.value.trim().length === 0);
const canScan = computed(() => !originalEmpty.value && !revisedEmpty.value);

async function handleScan() {
  scanError.value = '';
  showSuccess.value = false;
  if (!canScan.value) {
    scanError.value = '原文和校改文本不能为空，请先粘贴或上传文本。';
    return;
  }
  textStore.setTexts(originalLocal.value, revisedLocal.value);
  const res = await diffStore.runScan();
  if (!res.ok) {
    scanError.value = res.error || '扫描失败';
    return;
  }

  if (projectStore.currentProject && diffStore.scannedAt) {
    projectStore.addScanHistory({
      projectId: projectStore.currentProject.id,
      scannedAt: diffStore.scannedAt,
      scannedBy: '本地用户',
      ruleVersionTag: projectStore.currentProject.ruleVersionTag,
      totalDiffs: diffStore.statistics.total,
      statistics: {
        taboo: diffStore.statistics.taboo,
        error: diffStore.statistics.error,
        variant: diffStore.statistics.variant,
        pending: diffStore.statistics.pending,
        unjudged: diffStore.statistics.unjudged,
      },
      originalText: textStore.originalText,
      revisedText: textStore.revisedText,
      entries: diffStore.entries.map((e) => ({ ...e })),
    });
  }

  auditStore.addLog({
    actionType: 'scan_run',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    description: `执行差异扫描，共检出 ${diffStore.statistics.total} 处差异`,
    details: {
      total: diffStore.statistics.total,
      matched: diffStore.matchedCount,
      taboo: diffStore.statistics.taboo,
      variant: diffStore.statistics.variant,
      error: diffStore.statistics.error,
      pending: diffStore.statistics.pending,
    },
  });

  showSuccess.value = true;
  setTimeout(() => (showSuccess.value = false), 2500);
}

function readFile(ref: 'ori' | 'rev', file: File) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt') && file.type && !file.type.startsWith('text/')) {
    scanError.value = '仅支持 .txt 文本文件。';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = (e.target?.result as string) || '';
    if (ref === 'ori') originalLocal.value = text;
    else revisedLocal.value = text;
  };
  reader.onerror = () => (scanError.value = '文件读取失败。');
  reader.readAsText(file, 'UTF-8');
}

function onDrop(e: DragEvent, target: 'ori' | 'rev') {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) readFile(target, file);
}

function loadSample() {
  textStore.loadSample();
  originalLocal.value = textStore.originalText;
  revisedLocal.value = textStore.revisedText;
}

function clearAll() {
  if (confirm('将清空两段文本并清除已有扫描结果，确认吗？')) {
    originalLocal.value = '';
    revisedLocal.value = '';
    textStore.clearTexts();
    diffStore.clearDiffs();
  }
}

const scanStatusLabel = computed(() => {
  switch (diffStore.scanStatus) {
    case 'scanning':
      return '扫描中…';
    case 'done':
      return '已完成扫描';
    case 'stale':
      return '结果已失效，请重新扫描';
    default:
      return '未扫描';
  }
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷二">文本导入与差异扫描</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          将待校验的古籍原文与校改文本分别粘贴或上传，系统基于字符级 LCS 算法逐字比对，
          结合避讳字规则表自动高亮疑似替换位置。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" @click="loadSample">
          <Sparkles class="w-4 h-4" />
          载入示例文本
        </button>
        <button class="btn-secondary" @click="clearAll">
          <Eraser class="w-4 h-4" />
          清空全部
        </button>
      </div>
    </div>

    <div
      v-if="reasonToast"
      class="rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine flex items-start gap-2"
    >
      <AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
      {{ reasonToast }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div
        class="card-scroll p-5 relative"
        @dragover.prevent
        @drop="onDrop($event, 'ori')"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <FileText class="w-4 h-4 text-vermilion" />
            <h3 class="font-title text-lg text-ink">原 始 文 本</h3>
          </div>
          <div class="flex items-center gap-2 text-xs font-serif">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-sm border"
              :class="
                originalEmpty
                  ? 'border-carmine/40 bg-carmine/10 text-carmine'
                  : 'border-moss/40 bg-moss/10 text-moss'
              "
            >
              <CheckCircle v-if="!originalEmpty" class="w-3 h-3 mr-1" />
              <AlertCircle v-else class="w-3 h-3 mr-1" />
              {{ originalEmpty ? '为空' : '已填写' }}
            </span>
            <span class="text-ink-muted">{{ textStore.originalCharCount }} 字</span>
            <label class="cursor-pointer inline-flex items-center gap-1 text-ink-muted hover:text-vermilion transition">
              <Upload class="w-3.5 h-3.5" />
              <span>上传 .txt</span>
              <input
                type="file"
                accept=".txt,text/plain"
                class="hidden"
                @change="readFile('ori', ($event.target as HTMLInputElement).files![0])"
              />
            </label>
          </div>
        </div>
        <textarea
          v-model="originalLocal"
          rows="18"
          placeholder="将古籍底本原文粘贴于此……&#10;&#10;支持将 .txt 文件拖入或点击右上角上传。"
          class="text-area-paper resize-y font-serif"
          spellcheck="false"
        />
      </div>

      <div
        class="card-scroll p-5 relative"
        @dragover.prevent
        @drop="onDrop($event, 'rev')"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <FileScan class="w-4 h-4 text-azure" />
            <h3 class="font-title text-lg text-ink">校 改 文 本</h3>
          </div>
          <div class="flex items-center gap-2 text-xs font-serif">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-sm border"
              :class="
                revisedEmpty
                  ? 'border-carmine/40 bg-carmine/10 text-carmine'
                  : 'border-moss/40 bg-moss/10 text-moss'
              "
            >
              <CheckCircle v-if="!revisedEmpty" class="w-3 h-3 mr-1" />
              <AlertCircle v-else class="w-3 h-3 mr-1" />
              {{ revisedEmpty ? '为空' : '已填写' }}
            </span>
            <span class="text-ink-muted">{{ textStore.revisedCharCount }} 字</span>
            <label class="cursor-pointer inline-flex items-center gap-1 text-ink-muted hover:text-vermilion transition">
              <Upload class="w-3.5 h-3.5" />
              <span>上传 .txt</span>
              <input
                type="file"
                accept=".txt,text/plain"
                class="hidden"
                @change="readFile('rev', ($event.target as HTMLInputElement).files![0])"
              />
            </label>
          </div>
        </div>
        <textarea
          v-model="revisedLocal"
          rows="18"
          placeholder="将经过校勘、整理或改字后的文本粘贴于此……"
          class="text-area-paper resize-y font-serif"
          spellcheck="false"
        />
      </div>
    </div>

    <div
      v-if="scanError"
      class="rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine flex items-start gap-2"
    >
      <AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
      {{ scanError }}
    </div>
    <div
      v-if="showSuccess"
      class="rounded-sm border border-moss/40 bg-moss/10 p-3 text-sm font-serif text-moss flex items-start gap-2"
    >
      <CheckCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
      扫描完成，共检出 <strong class="text-ink mx-1">{{ diffStore.statistics.total }}</strong> 处差异，
      其中 <strong class="text-vermilion mx-1">{{ diffStore.matchedCount }}</strong> 处匹配到避讳字规则。
    </div>

    <div class="card-scroll p-5">
      <div class="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div class="flex-1">
          <h4 class="font-title text-base text-ink mb-1">扫描控制区</h4>
          <div class="text-xs font-serif text-ink-muted">
            启用规则：{{ ruleStore.enabledRules.length }} 条 · 扫描状态：
            <span
              :class="{
                'text-ink-muted': diffStore.scanStatus === 'idle',
                'text-azure': diffStore.scanStatus === 'scanning',
                'text-moss': diffStore.scanStatus === 'done',
                'text-carmine': diffStore.scanStatus === 'stale',
              }"
            >
              {{ scanStatusLabel }}
            </span>
            <span v-if="diffStore.scannedAt" class="ml-2">
              · 上次执行：{{ formatDate(diffStore.scannedAt) }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="btn-primary"
            :disabled="!canScan || diffStore.scanStatus === 'scanning'"
            @click="handleScan"
          >
            <ScanSearch class="w-4 h-4" />
            {{ diffStore.scanStatus === 'scanning' ? '扫描中…' : '执行差异扫描' }}
          </button>
          <button
            v-if="diffStore.scanStatus === 'stale' && diffStore.entries.length"
            class="btn-secondary"
            @click="handleScan"
          >
            <RotateCcw class="w-4 h-4" />
            重新扫描
          </button>
          <RouterLink
            to="/review"
            class="btn-secondary"
            :class="{ '!opacity-50 !pointer-events-none': diffStore.entries.length === 0 }"
          >
            <BookOpenCheck class="w-4 h-4" />
            进入差异审核
            <ArrowRight class="w-4 h-4" />
          </RouterLink>
        </div>
      </div>

      <div class="scroll-divider my-5" />

      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          class="rounded-sm border border-ink/15 bg-paper-100/50 p-4 flex flex-col"
        >
          <div class="text-xs font-serif text-ink-muted">差异总数</div>
          <div class="mt-2 font-title text-3xl text-ink">
            {{ diffStore.statistics.total }}
          </div>
        </div>
        <div
          class="rounded-sm border border-ink/15 bg-paper-100/50 p-4 flex flex-col"
        >
          <div class="text-xs font-serif text-ink-muted">匹配避讳规则</div>
          <div class="mt-2 font-title text-3xl text-rattan-dark text-vermilion">
            {{ diffStore.matchedCount }}
          </div>
        </div>
        <div
          class="rounded-sm border border-ink/15 bg-paper-100/50 p-4 flex flex-col"
        >
          <div class="text-xs font-serif text-ink-muted">已判断</div>
          <div class="mt-2 font-title text-3xl text-moss">
            {{ diffStore.statistics.judged }}
          </div>
        </div>
        <div
          class="rounded-sm border border-ink/15 bg-paper-100/50 p-4 flex flex-col"
        >
          <div class="text-xs font-serif text-ink-muted">未判断</div>
          <div class="mt-2 font-title text-3xl" :class="diffStore.statistics.unjudged > 0 ? 'text-carmine' : 'text-moss'">
            {{ diffStore.statistics.unjudged }}
          </div>
        </div>
        <div
          class="rounded-sm border border-ink/15 bg-paper-100/50 p-4 flex flex-col col-span-2 md:col-span-1"
        >
          <div class="text-xs font-serif text-ink-muted">判断进度</div>
          <div class="mt-2 flex items-end gap-2">
            <div class="font-title text-3xl text-vermilion">
              {{
                diffStore.statistics.total
                  ? Math.round(
                      (diffStore.statistics.judged / diffStore.statistics.total) * 100,
                    )
                  : 0
              }}
              <span class="text-base text-ink-muted">%</span>
            </div>
          </div>
          <div class="mt-2 h-2 rounded-full bg-paper-200 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-vermilion to-vermilion-hover transition-all duration-500"
              :style="{
                width: `${
                  diffStore.statistics.total
                    ? (diffStore.statistics.judged / diffStore.statistics.total) * 100
                    : 0
                }%`,
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
