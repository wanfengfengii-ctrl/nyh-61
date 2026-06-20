<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import {
  Download,
  FileJson,
  FileText,
  BookMarked,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Printer,
  Calendar,
  Hash,
} from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import { useDiffStore } from '@/stores/diffStore';
import { useTextStore } from '@/stores/textStore';
import type { VerificationReport } from '@/types';
import {
  generateReportJSON,
  generateReportTXT,
  downloadFile,
  formatDate,
  judgmentLabel,
  judgmentTagCls,
} from '@/utils/exportEngine';
import { JUDGMENT_META } from '@/types';

const diffStore = useDiffStore();
const textStore = useTextStore();

const report = ref<VerificationReport | null>(null);
const toast = ref('');

onMounted(() => {
  buildReport();
});

function buildReport() {
  report.value = diffStore.buildReport();
}

const unjudged = computed(() => diffStore.statistics.unjudged);

function downloadJSON() {
  if (!report.value) return;
  const json = generateReportJSON(report.value);
  const filename = `古籍避讳校验报告_${formatDate(report.value.generatedAt).replace(/[: ]/g, '-')}.json`;
  downloadFile(json, filename, 'application/json;charset=utf-8');
  flashToast('JSON 报告已导出');
}

function downloadTXT() {
  if (!report.value) return;
  const txt = generateReportTXT(report.value);
  const filename = `古籍避讳校验报告_${formatDate(report.value.generatedAt).replace(/[: ]/g, '-')}.txt`;
  downloadFile('\uFEFF' + txt, filename, 'text/plain;charset=utf-8');
  flashToast('TXT 报告已导出');
}

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2000);
}

function previewJSON() {
  if (!report.value) return;
  const json = generateReportJSON(report.value);
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(
      `<html><head><title>JSON 报告预览</title><style>body{font-family:monospace;padding:20px;background:#f5f0e6;color:#1c1c1c;}pre{white-space:pre-wrap;}</style></head><body><pre>${json.replace(/</g, '&lt;')}</pre></body></html>`,
    );
    w.document.close();
  }
}

const statsList = computed(() => [
  { key: 'taboo' as const, title: '避  讳', desc: '因避讳制度产生的改字' },
  { key: 'variant' as const, title: '异  体', desc: '异体字/通用字/古今字替换' },
  { key: 'error' as const, title: '误  改', desc: '明显讹误或过度改字' },
  { key: 'pending' as const, title: '待  定', desc: '存疑待进一步考证' },
]);
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="toast"
      class="fixed top-20 right-6 z-50 rounded-sm border border-moss/40 bg-moss/90 text-paper-50 px-4 py-2 text-sm font-serif shadow-lg animate-fade-in"
    >
      {{ toast }}
    </div>

    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷四">校验报告</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          所有差异条目均已完成最终判断。下方为结构化的校验报告，可分别导出为 JSON（便于后续程序处理）或 TXT（便于阅读归档），
          <span class="text-vermilion">报告包含每条差异的完整上下文、判断结果、判断依据与匹配到的避讳规则。</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/review" class="btn-secondary">
          <ArrowLeft class="w-4 h-4" />
          返回差异审核
        </RouterLink>
        <button class="btn-secondary" :disabled="!diffStore.allJudged" @click="previewJSON">
          <Printer class="w-4 h-4" />
          预览 JSON
        </button>
        <button class="btn-secondary" :disabled="!diffStore.allJudged" @click="downloadTXT">
          <FileText class="w-4 h-4" />
          导出 TXT
        </button>
        <button class="btn-primary" :disabled="!diffStore.allJudged" @click="downloadJSON">
          <FileJson class="w-4 h-4" />
          导出 JSON
        </button>
      </div>
    </div>

    <div
      v-if="unjudged > 0"
      class="rounded-sm border border-carmine/40 bg-carmine/10 p-4 text-sm font-serif text-carmine flex items-start gap-3"
    >
      <AlertTriangle class="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div>
        <div class="font-bold mb-1">报告未就绪</div>
        <div>
          尚有 <strong>{{ unjudged }}</strong> 处差异未作出最终判断。根据业务规则，未判断差异存在时不能生成最终校验报告。
          请先前往
          <RouterLink to="/review" class="underline mx-1 font-bold">差异审核</RouterLink>
          完成全部判断。
        </div>
      </div>
    </div>

    <template v-if="report">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="s in statsList"
          :key="s.key"
          class="relative card-scroll p-5 overflow-hidden frame-corners"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="font-title text-sm text-ink-muted mb-1">{{ s.title }}</div>
              <div class="font-title text-4xl text-ink leading-tight">
                {{ report.statistics[s.key] }}
              </div>
              <div class="text-xs text-ink-muted mt-2 font-serif">{{ s.desc }}</div>
            </div>
            <div
              class="seal-badge px-3 py-1.5 text-base"
              :class="{
                'bg-rattan text-ink border-rattan': s.key === 'taboo',
                'bg-azure text-paper-50 border-azure': s.key === 'variant',
                'bg-carmine text-paper-50 border-carmine': s.key === 'error',
                'bg-moss text-paper-50 border-moss': s.key === 'pending',
              }"
            >
              {{ JUDGMENT_META[s.key].label }}
            </div>
          </div>
          <div class="mt-4 h-1.5 rounded-full bg-paper-200 overflow-hidden">
            <div
              class="h-full transition-all duration-700"
              :class="{
                'bg-rattan': s.key === 'taboo',
                'bg-azure': s.key === 'variant',
                'bg-carmine': s.key === 'error',
                'bg-moss': s.key === 'pending',
              }"
              :style="{
                width: `${
                  report.totalDiffs
                    ? Math.round((report.statistics[s.key] / report.totalDiffs) * 100)
                    : 0
                }%`,
              }"
            />
          </div>
          <div class="mt-1 text-right text-xs font-mono text-ink-muted">
            {{ report.totalDiffs ? Math.round((report.statistics[s.key] / report.totalDiffs) * 100) : 0 }}%
          </div>
        </div>
      </div>

      <!-- 摘要信息 -->
      <div class="card-scroll p-5">
        <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
          <BookMarked class="w-5 h-5 text-vermilion" />
          校 验 报 告 · 摘 要
        </h3>
        <div class="scroll-divider mb-5" />
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-serif">
          <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
            <div class="flex items-center gap-2 text-ink-muted mb-2">
              <Calendar class="w-4 h-4" />
              生成时间
            </div>
            <div class="text-ink font-mono text-base">
              {{ formatDate(report.generatedAt) }}
            </div>
          </div>
          <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
            <div class="flex items-center gap-2 text-ink-muted mb-2">
              <Hash class="w-4 h-4" />
              差异总数
            </div>
            <div class="text-ink font-title text-2xl">
              {{ report.totalDiffs }}
              <span class="text-sm font-serif text-ink-muted ml-1">处</span>
            </div>
          </div>
          <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
            <div class="flex items-center gap-2 text-ink-muted mb-2">
              <CheckCircle class="w-4 h-4 text-moss" />
              完成度
            </div>
            <div class="text-moss font-title text-2xl">
              100
              <span class="text-sm font-serif text-ink-muted ml-1">% 已判断</span>
            </div>
          </div>
        </div>
        <div class="scroll-divider my-5" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-serif">
          <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
            <div class="text-ink-muted mb-2 text-xs">原文摘要（前 30 字）</div>
            <div class="text-ink font-serif leading-7">……{{ report.originalSummary }}……</div>
            <div class="mt-2 text-xs text-ink-muted">共 {{ textStore.originalCharCount }} 字</div>
          </div>
          <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
            <div class="text-ink-muted mb-2 text-xs">校改文摘要（前 30 字）</div>
            <div class="text-ink font-serif leading-7">……{{ report.revisedSummary }}……</div>
            <div class="mt-2 text-xs text-ink-muted">共 {{ textStore.revisedCharCount }} 字</div>
          </div>
        </div>
      </div>

      <!-- 差异条目详情 -->
      <div class="card-scroll p-5">
        <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
          <Download class="w-5 h-5 text-vermilion" />
          差 异 条 目 详 情 · 共 {{ report.judgments.length }} 条
        </h3>
        <div class="scroll-divider mb-5" />
        <div class="space-y-4">
          <div
            v-for="(d, idx) in report.judgments"
            :key="d.id"
            class="rounded-sm border border-ink/15 p-4 hover:border-vermilion/40 transition-all bg-paper-50"
          >
            <div class="flex items-start justify-between gap-4 mb-3 flex-wrap">
              <div class="flex items-center gap-3">
                <span
                  class="seal-badge w-9 h-9 text-base flex items-center justify-center"
                  >{{ String(idx + 1).padStart(2, '0') }}</span
                >
                <div>
                  <div class="flex items-center gap-2">
                    <span
                      :class="judgmentTagCls(d.judgment)"
                      class="!text-sm px-2.5 py-0.5"
                    >
                      {{ judgmentLabel(d.judgment) }}
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
                  <div class="text-xs text-ink-muted mt-1 font-mono">
                    原文位置 [{{ d.startInOriginal + 1 }}, {{ d.endInOriginal }}) ·
                    校改文位置 [{{ d.startInRevised + 1 }}, {{ d.endInRevised }})
                  </div>
                </div>
              </div>
              <div
                v-if="d.matchedRule"
                class="rounded-sm border border-rattan/50 bg-rattan/15 px-3 py-1.5 text-xs font-serif text-ink flex items-center gap-2"
              >
                <BookMarked class="w-3.5 h-3.5 text-vermilion" />
                <span class="font-title text-base">
                  {{ d.matchedRule.originalChar }} → {{ d.matchedRule.replacedChar }}
                </span>
                <span v-if="d.matchedRule.dynasty" class="text-ink-muted">（{{ d.matchedRule.dynasty }}）</span>
              </div>
            </div>

            <div
              class="rounded-sm border border-ink/10 bg-[#FBF7EE] p-4 font-serif text-sm leading-7"
            >
              <div class="text-ink-muted text-xs mb-2">上下 文 对 照</div>
              <div class="mb-2">
                <span class="text-ink-pale mr-1">……</span>
                <span class="text-ink-muted">{{ d.contextBefore }}</span>
                <span
                  class="hl-raw font-title mx-0.5 text-base"
                  v-if="d.diffType !== 'insert'"
                  >{{ d.originalText || '（空）' }}</span
                >
                <span v-else class="mx-0.5 italic text-ink-pale text-xs">【插入】</span>
                <span class="text-ink-muted">{{ d.contextAfter }}</span>
                <span class="text-ink-pale ml-1">……</span>
                <div class="text-[10px] text-ink-pale mt-0.5">· 原 文</div>
              </div>
              <div>
                <span class="text-ink-pale mr-1">……</span>
                <span class="text-ink-muted">{{ d.contextBefore }}</span>
                <span
                  class="hl-new font-title mx-0.5 text-base"
                  v-if="d.diffType !== 'delete'"
                  >{{ d.revisedText || '（空）' }}</span
                >
                <span v-else class="mx-0.5 italic text-ink-pale text-xs">【删除】</span>
                <span class="text-ink-muted">{{ d.contextAfter }}</span>
                <span class="text-ink-pale ml-1">……</span>
                <div class="text-[10px] text-ink-pale mt-0.5">· 校 改 文</div>
              </div>
            </div>

            <div
              v-if="d.matchedRule?.note"
              class="mt-3 rounded-sm border border-ink/10 bg-paper-100/60 px-3 py-2 text-xs font-serif text-ink-soft"
            >
              <span class="text-vermilion mr-2">匹配规则备注：</span>
              {{ d.matchedRule.note }}
            </div>
            <div
              class="mt-3 rounded-sm border border-vermilion/30 bg-vermilion/5 px-3 py-2 text-sm font-serif text-ink"
            >
              <div class="text-vermilion text-xs mb-1 font-bold flex items-center gap-1">
                <CheckCircle class="w-3 h-3" />
                最终判断 · {{ judgmentLabel(d.judgment) }} · 依据 / 备注
              </div>
              <div>{{ d.judgmentNote?.trim() || '（未填写判断依据）' }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
