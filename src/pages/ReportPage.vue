<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
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
  Settings,
  Copy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  Folder,
  BookOpen,
  MessageSquare,
  CheckSquare,
  History,
  Link,
  ShieldCheck,
  Link2,
  Image,
  Type,
} from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useDiffStore } from '@/stores/diffStore';
import { useTextStore } from '@/stores/textStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAnnotationStore } from '@/stores/annotationStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useRuleVersionStore } from '@/stores/ruleVersionStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useCitationStore } from '@/stores/citationStore';
import { useGlyphStore } from '@/stores/glyphStore';
import type { VerificationReport, ReportTemplate, ReportSection, EvidenceChainItem } from '@/types';
import { CITATION_TYPE_META, CREDIBILITY_META, GLYPH_VARIANT_TYPE_META, GLYPH_SOURCE_TYPE_META } from '@/types';
import {
  generateReportJSON,
  generateReportTXT,
  downloadFile,
  formatDate,
  judgmentLabel,
  judgmentTagCls,
} from '@/utils/exportEngine';
import { JUDGMENT_META, REVIEW_STATUS_META } from '@/types';

const diffStore = useDiffStore();
const textStore = useTextStore();
const templateStore = useTemplateStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const annotationStore = useAnnotationStore();
const reviewStore = useReviewStore();
const ruleVersionStore = useRuleVersionStore();
const ruleStore = useRuleStore();
const citationStore = useCitationStore();
const glyphStore = useGlyphStore();
const router = useRouter();

const report = ref<VerificationReport | null>(null);
const toast = ref('');
const showTemplateModal = ref(false);
const showEvidenceModal = ref(false);
const selectedTemplateId = ref<string | null>(null);
const editingTemplate = ref<ReportTemplate | null>(null);
const editingSection = ref<ReportSection | null>(null);
const newTemplateName = ref('');
const newTemplateDesc = ref('');
const showNewTemplateForm = ref(false);

function guard() {
  if (diffStore.scanStatus !== 'done' || diffStore.entries.length === 0) {
    router.replace({ path: '/import', query: { reason: 'nodiff' } });
    return false;
  }
  return true;
}

onMounted(() => {
  if (!templateStore.initialized) templateStore.load();
  if (templateStore.defaultTemplate) {
    selectedTemplateId.value = templateStore.defaultTemplate.id;
  }
  if (guard()) buildReport();
});

watch(
  [() => diffStore.scanStatus, () => diffStore.entries.length],
  () => {
    if (!guard()) return;
    buildReport();
  },
);

watch(
  () => templateStore.templates.length,
  () => {
    if (!selectedTemplateId.value && templateStore.defaultTemplate) {
      selectedTemplateId.value = templateStore.defaultTemplate.id;
    }
  },
);

function buildReport() {
  const baseReport = diffStore.buildReport();
  if (baseReport) {
    const summary = citationStore.buildCitationSummary(projectStore.currentProjectId || undefined);
    baseReport.citations = summary.citations;
    baseReport.citationLinks = summary.links;
    const glyphSummary = glyphStore.buildGlyphSummary(projectStore.currentProjectId || undefined);
    baseReport.glyphs = glyphSummary.glyphs;
    baseReport.glyphLinks = glyphSummary.links;
  }
  report.value = baseReport;
}

const currentTemplate = computed(() => {
  if (!selectedTemplateId.value) return templateStore.defaultTemplate;
  return templateStore.getTemplateById(selectedTemplateId.value) || templateStore.defaultTemplate;
});

const visibleSections = computed(() => {
  if (!currentTemplate.value) return [];
  return currentTemplate.value.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);
});

const unjudged = computed(() => diffStore.statistics.unjudged);

const evidenceChain = computed<EvidenceChainItem[]>(() => {
  const items: EvidenceChainItem[] = [];

  if (projectStore.currentProject) {
    items.push({
      id: 'proj_' + projectStore.currentProject.id,
      type: 'document',
      title: '项目信息',
      content: `${projectStore.currentProject.dynasty} · ${projectStore.currentProject.bookTitle} · 卷${projectStore.currentProject.volume}`,
      timestamp: projectStore.currentProject.createdAt,
      author: projectStore.currentProject.createdBy,
      metadata: { project: projectStore.currentProject },
    });
  }

  ruleStore.rules.forEach((rule) => {
    items.push({
      id: 'rule_' + rule.id,
      type: 'rule',
      title: `避讳规则：${rule.originalChar} → ${rule.replacedChar}`,
      content: rule.note || '无备注',
      timestamp: rule.updatedAt,
      metadata: { rule, dynasty: rule.dynasty },
    });
  });

  diffStore.entries.forEach((entry) => {
    items.push({
      id: 'diff_' + entry.id,
      type: 'diff',
      title: `差异条目：${entry.originalText || '（空）'} → ${entry.revisedText || '（空）'}`,
      content: `判断：${judgmentLabel(entry.judgment)}｜${entry.judgmentNote || '无判断依据'}`,
      timestamp: diffStore.scannedAt || Date.now(),
      metadata: { entry },
    });
  });

  if (projectStore.currentProject) {
    const annotations = annotationStore.getByProject(projectStore.currentProject.id);
    annotations.forEach((ann) => {
      items.push({
        id: 'ann_' + ann.id,
        type: 'annotation',
        title: `批注：${ann.author}`,
        content: ann.content,
        timestamp: ann.createdAt,
        author: ann.author,
        metadata: { annotation: ann, resolved: ann.resolved },
      });
    });
  }

  if (projectStore.currentProject) {
    const flows = reviewStore.getFlowsByProject(projectStore.currentProject.id);
    flows.forEach((flow) => {
      flow.reviewHistory.forEach((action) => {
        items.push({
          id: 'rev_' + action.id,
          type: 'review',
          title: `复核操作：${action.actor}`,
          content: action.comment || `${REVIEW_STATUS_META[action.fromStatus].label} → ${REVIEW_STATUS_META[action.toStatus].label}`,
          timestamp: action.timestamp,
          author: action.actor,
          metadata: { action, flowId: flow.id },
        });
      });
    });
  }

  if (projectStore.currentProject) {
    const projectCitations = citationStore.getCitationsByProject(projectStore.currentProject.id);
    projectCitations.forEach((c) => {
      items.push({
        id: 'cit_' + c.id,
        type: 'document',
        title: `典籍依据：${c.title}`,
        content: `${CITATION_TYPE_META[c.citationType].label}｜${CREDIBILITY_META[c.credibility].label}｜${c.source}${c.page ? ' 第' + c.page + '页' : ''}`,
        timestamp: c.updatedAt,
        author: c.createdBy,
        metadata: { citation: c },
      });
    });
  }

  if (projectStore.currentProject) {
    const projectGlyphs = glyphStore.searchGlyphs('', { projectId: projectStore.currentProject.id });
    projectGlyphs.forEach((g) => {
      items.push({
        id: 'glyph_' + g.id,
        type: 'document',
        title: `字形谱系：${g.headChar}`,
        content: `${g.variants.length} 个异体字｜${g.evolutionChain?.length || 0} 阶演化链｜${g.pinyin || '拼音未录'}`,
        timestamp: g.updatedAt,
        author: g.createdBy,
        metadata: { glyph: g },
      });
    });
  }

  return items.sort((a, b) => a.timestamp - b.timestamp);
});

const projectAnnotations = computed(() => {
  if (!projectStore.currentProject) return [];
  return annotationStore.getByProject(projectStore.currentProject.id);
});

const projectReviewFlows = computed(() => {
  if (!projectStore.currentProject) return [];
  return reviewStore.getFlowsByProject(projectStore.currentProject.id);
});

const citationSummary = computed(() => {
  return citationStore.buildCitationSummary(projectStore.currentProjectId || undefined);
});

function getDiffCitations(diffEntryId: string) {
  return citationStore.getCitationsWithLinksByDiffEntry(diffEntryId);
}

function getDiffGlyphs(diffEntryId: string) {
  return glyphStore.getGlyphsByDiffEntry(diffEntryId);
}

function getDiffGlyphLinks(diffEntryId: string) {
  return glyphStore.getLinksByDiffEntry(diffEntryId);
}

function getGlyphLink(diffEntryId: string, glyphId: string) {
  return glyphStore.getLinksByDiffEntry(diffEntryId).find(l => l.glyphEntryId === glyphId);
}

function getCredibilityShield(cred: string) {
  if (cred === 'primary') return '★★★';
  if (cred === 'secondary') return '★★☆';
  return '★☆☆';
}

function openImage(imageData: string) {
  window.open(imageData, '_blank');
}

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2000);
}

function downloadJSON() {
  if (!report.value) return;
  const json = generateReportJSON(report.value);
  const filename = `古籍避讳校验报告_${formatDate(report.value.generatedAt).replace(/[: ]/g, '-')}.json`;
  downloadFile(json, filename, 'application/json;charset=utf-8');
  auditStore.addLog({
    actionType: 'report_export',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    description: '导出 JSON 格式校验报告',
  });
  flashToast('JSON 报告已导出');
}

function downloadTXT() {
  if (!report.value) return;
  const txt = generateReportTXT(report.value);
  const filename = `古籍避讳校验报告_${formatDate(report.value.generatedAt).replace(/[: ]/g, '-')}.txt`;
  downloadFile('\uFEFF' + txt, filename, 'text/plain;charset=utf-8');
  auditStore.addLog({
    actionType: 'report_export',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    description: '导出 TXT 格式校验报告',
  });
  flashToast('TXT 报告已导出');
}

function downloadEvidenceChain() {
  if (!projectStore.currentProject) {
    flashToast('请先选择项目');
    return;
  }
  const evidenceData = {
    project: projectStore.currentProject,
    scan: {
      scannedAt: diffStore.scannedAt,
      statistics: diffStore.statistics,
      entries: diffStore.entries,
    },
    rules: ruleStore.rules,
    ruleVersions: ruleVersionStore.versions,
    annotations: projectAnnotations.value,
    reviewFlows: projectReviewFlows.value,
    citations: citationSummary.value.citations,
    citationLinks: citationSummary.value.links,
    evidenceChain: evidenceChain.value,
    auditLogs: auditStore.getLogsByProject(projectStore.currentProject.id),
    generatedAt: Date.now(),
    generatedBy: '本地用户',
  };
  const json = JSON.stringify(evidenceData, null, 2);
  const filename = `证据链_${projectStore.currentProject.name}_${formatDate(Date.now()).replace(/[: ]/g, '-')}.json`;
  downloadFile(json, filename, 'application/json;charset=utf-8');
  auditStore.addLog({
    actionType: 'report_export',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    description: '导出完整证据链',
  });
  flashToast('证据链已导出');
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

function openTemplateModal() {
  showTemplateModal.value = true;
  showNewTemplateForm.value = false;
  editingTemplate.value = null;
  editingSection.value = null;
}

function closeTemplateModal() {
  showTemplateModal.value = false;
  editingTemplate.value = null;
  editingSection.value = null;
  showNewTemplateForm.value = false;
  newTemplateName.value = '';
  newTemplateDesc.value = '';
}

function selectTemplate(id: string) {
  selectedTemplateId.value = id;
  flashToast('已切换模板');
}

function editTemplate(template: ReportTemplate) {
  editingTemplate.value = { ...template, sections: template.sections.map((s) => ({ ...s })) };
  editingSection.value = null;
}

function saveTemplateEdit() {
  if (!editingTemplate.value) return;
  const result = templateStore.updateTemplate(editingTemplate.value.id, {
    name: editingTemplate.value.name,
    description: editingTemplate.value.description,
    sections: editingTemplate.value.sections,
  });
  if (result.ok) {
    auditStore.addLog({
      actionType: 'template_update',
      actor: '本地用户',
      description: `更新报告模板：${editingTemplate.value.name}`,
    });
    flashToast('模板已保存');
    editingTemplate.value = null;
  } else {
    flashToast(result.error || '保存失败');
  }
}

function toggleSectionVisibility(sectionId: string) {
  if (!editingTemplate.value) return;
  const section = editingTemplate.value.sections.find((s) => s.id === sectionId);
  if (section) {
    section.visible = !section.visible;
  }
}

function moveSection(sectionId: string, direction: 'up' | 'down') {
  if (!editingTemplate.value) return;
  const sections = editingTemplate.value.sections;
  const idx = sections.findIndex((s) => s.id === sectionId);
  if (idx === -1) return;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= sections.length) return;
  const temp = sections[idx].order;
  sections[idx].order = sections[targetIdx].order;
  sections[targetIdx].order = temp;
  editingTemplate.value.sections = [...sections].sort((a, b) => a.order - b.order);
}

function setDefaultTemplate(id: string) {
  templateStore.updateTemplate(id, { isDefault: true });
  flashToast('已设为默认模板');
}

function duplicateTemplate(id: string) {
  const tpl = templateStore.getTemplateById(id);
  if (!tpl) return;
  const newName = tpl.name + ' 副本';
  const result = templateStore.duplicateTemplate(id, newName);
  if (result.ok) {
    auditStore.addLog({
      actionType: 'template_create',
      actor: '本地用户',
      description: `复制报告模板：${newName}`,
    });
    flashToast('模板已复制');
  } else {
    flashToast(result.error || '复制失败');
  }
}

function deleteTemplate(id: string) {
  if (!confirm('确定要删除此模板吗？')) return;
  const result = templateStore.deleteTemplate(id);
  if (result.ok) {
    if (selectedTemplateId.value === id) {
      selectedTemplateId.value = templateStore.defaultTemplate?.id || null;
    }
    flashToast('模板已删除');
  } else {
    flashToast(result.error || '删除失败');
  }
}

function createNewTemplate() {
  if (!newTemplateName.value.trim()) {
    flashToast('请输入模板名称');
    return;
  }
  const result = templateStore.createTemplate({
    name: newTemplateName.value,
    description: newTemplateDesc.value,
    createdBy: '本地用户',
  });
  if (result.ok) {
    auditStore.addLog({
      actionType: 'template_create',
      actor: '本地用户',
      description: `创建报告模板：${newTemplateName.value}`,
    });
    newTemplateName.value = '';
    newTemplateDesc.value = '';
    showNewTemplateForm.value = false;
    flashToast('模板已创建');
  } else {
    flashToast(result.error || '创建失败');
  }
}

function editSection(section: ReportSection) {
  editingSection.value = { ...section };
}

function saveSectionEdit() {
  if (!editingTemplate.value || !editingSection.value) return;
  const idx = editingTemplate.value.sections.findIndex((s) => s.id === editingSection.value!.id);
  if (idx !== -1) {
    editingTemplate.value.sections[idx] = { ...editingSection.value };
  }
  editingSection.value = null;
}

function cancelSectionEdit() {
  editingSection.value = null;
}

const sectionTypeLabels: Record<string, string> = {
  title: '报告标题',
  summary: '摘要信息',
  statistics: '统计数据',
  project_info: '项目信息',
  rule_info: '规则版本',
  diff_list: '差异条目详情',
  evidence_chain: '证据链',
  citation_summary: '引用清单',
  custom: '自定义',
};
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
        <button class="btn-secondary" @click="openTemplateModal">
          <Settings class="w-4 h-4" />
          报告模板
        </button>
        <button class="btn-secondary" @click="showEvidenceModal = true">
          <Link class="w-4 h-4" />
          证据链
        </button>
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
        <button
          class="btn-primary"
          :disabled="!projectStore.currentProject"
          @click="downloadEvidenceChain"
        >
          <Download class="w-4 h-4" />
          导出证据链
        </button>
      </div>
    </div>

    <div
      v-if="currentTemplate"
      class="card-scroll p-4 flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <FileText class="w-5 h-5 text-vermilion" />
        <div>
          <div class="font-serif text-sm text-ink">
            当前模板：<strong>{{ currentTemplate.name }}</strong>
            <span v-if="currentTemplate.isDefault" class="text-[10px] px-1.5 py-0.5 ml-2 rounded-sm bg-rattan/30 text-ink border border-rattan/50">默认</span>
          </div>
          <div class="text-xs text-ink-muted font-serif">{{ currentTemplate.description || '无描述' }}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedTemplateId"
          class="input-field text-sm py-1.5"
          style="width: auto; min-width: 180px"
          @change="selectTemplate(selectedTemplateId!)"
        >
          <option v-for="t in templateStore.sortedTemplates" :key="t.id" :value="t.id">
            {{ t.name }}{{ t.isDefault ? '（默认）' : '' }}
          </option>
        </select>
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
      <template v-for="section in visibleSections" :key="section.id">
        <!-- 报告标题 -->
        <div v-if="section.type === 'title'" class="text-center py-8">
          <h1 class="font-title text-3xl md:text-4xl text-ink tracking-widest">古籍文本避讳校验报告</h1>
          <div class="mt-4 text-ink-muted font-serif text-sm">
            {{ formatDate(report.generatedAt) }}
          </div>
        </div>

        <!-- 项目信息 -->
        <div v-else-if="section.type === 'project_info'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <Folder class="w-5 h-5 text-vermilion" />
            {{ section.title }}
          </h3>
          <div class="scroll-divider mb-5" />
          <div v-if="projectStore.currentProject" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm font-serif">
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
              <div class="text-ink-muted text-xs mb-2">朝代</div>
              <div class="text-ink font-title text-lg">{{ projectStore.currentProject.dynasty }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
              <div class="text-ink-muted text-xs mb-2">书名</div>
              <div class="text-ink font-title text-lg">{{ projectStore.currentProject.bookTitle }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
              <div class="text-ink-muted text-xs mb-2">卷次</div>
              <div class="text-ink font-title text-lg">卷{{ projectStore.currentProject.volume }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-4">
              <div class="text-ink-muted text-xs mb-2">创建者</div>
              <div class="text-ink font-title text-lg">{{ projectStore.currentProject.createdBy }}</div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-ink-muted font-serif text-sm">
            未选择项目，<RouterLink to="/projects" class="text-vermilion underline">前往创建项目 →</RouterLink>
          </div>
        </div>

        <!-- 摘要信息 -->
        <div v-else-if="section.type === 'summary'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <BookMarked class="w-5 h-5 text-vermilion" />
            {{ section.title }}
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

        <!-- 统计数据 -->
        <div v-else-if="section.type === 'statistics'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <!-- 规则版本 -->
        <div v-else-if="section.type === 'rule_info'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <BookOpen class="w-5 h-5 text-vermilion" />
            {{ section.title }}
          </h3>
          <div class="scroll-divider mb-5" />
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-serif mb-4">
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">规则总数</div>
              <div class="text-ink font-title text-xl">{{ ruleStore.rules.length }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">启用规则</div>
              <div class="text-moss font-title text-xl">{{ ruleStore.enabledRules.length }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">版本记录</div>
              <div class="text-azure font-title text-xl">{{ ruleVersionStore.totalVersions }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">匹配规则</div>
              <div class="text-rattan-dark font-title text-xl">{{ diffStore.matchedCount }}</div>
            </div>
          </div>
          <div class="text-xs text-ink-muted font-serif">
            本次扫描共使用 {{ ruleStore.enabledRules.length }} 条启用的避讳规则，其中 {{ diffStore.matchedCount }} 条规则在文本中找到了匹配项。
          </div>
        </div>

        <!-- 差异条目详情 -->
        <div v-else-if="section.type === 'diff_list'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <Download class="w-5 h-5 text-vermilion" />
            {{ section.title }} · 共 {{ report.judgments.length }} 条
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

              <div v-if="getDiffCitations(d.id).length > 0" class="mt-3 space-y-2">
                <div class="text-xs text-ink-muted flex items-center gap-1 font-bold">
                  <BookMarked class="w-3 h-3 text-vermilion" />
                  典籍依据（{{ getDiffCitations(d.id).length }} 条）
                </div>
                <div
                  v-for="item in getDiffCitations(d.id)"
                  :key="item.citation.id"
                  class="rounded-sm border border-ink/10 bg-paper-50 px-3 py-2"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                      :class="CREDIBILITY_META[item.citation.credibility].cls"
                    >
                      {{ CREDIBILITY_META[item.citation.credibility].label }}
                    </span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                      :class="CITATION_TYPE_META[item.citation.citationType].cls"
                    >
                      {{ CITATION_TYPE_META[item.citation.citationType].label }}
                    </span>
                    <span class="text-sm font-serif font-medium text-ink truncate">{{ item.citation.title }}</span>
                  </div>
                  <div class="text-[11px] text-ink-muted font-serif mb-1">
                    {{ item.citation.source }}
                    <span v-if="item.citation.author"> · {{ item.citation.author }}</span>
                    <span v-if="item.citation.dynasty"> · {{ item.citation.dynasty }}</span>
                    <span v-if="item.citation.volume"> · {{ item.citation.volume }}</span>
                    <span v-if="item.citation.page"> · 第{{ item.citation.page }}页</span>
                  </div>
                  <div class="text-xs font-serif text-ink-soft whitespace-pre-wrap leading-relaxed border-l-2 border-ink/15 pl-2 ml-1">
                    {{ item.citation.content }}
                  </div>
                  <div v-if="item.citation.imageData" class="mt-2 rounded-sm border border-ink/10 overflow-hidden bg-paper-100">
                    <div class="text-[10px] text-ink-muted px-2 py-1 border-b border-ink/10 flex items-center gap-1">
                      <Image class="w-3 h-3" />
                      图像页码 <span class="text-ink-pale ml-1">{{ item.citation.imageName }}</span>
                    </div>
                    <img
                      :src="item.citation.imageData"
                      :alt="item.citation.title"
                      class="w-full max-h-48 object-contain p-2"
                      @click="openImage(item.citation.imageData)"
                      style="cursor: pointer;"
                    />
                  </div>
                  <div v-if="item.link?.relevanceNote" class="text-[11px] text-vermilion/80 font-serif mt-1.5 italic">
                    ▸ {{ item.link.relevanceNote }}
                  </div>
                </div>
              </div>

              <div v-if="getDiffGlyphs(d.id).length > 0" class="mt-3 space-y-2">
                <div class="text-xs text-ink-muted flex items-center gap-1 font-bold">
                  <Type class="w-3 h-3 text-rattan" />
                  字形证据（{{ getDiffGlyphs(d.id).length }} 条）
                </div>
                <div
                  v-for="glyph in getDiffGlyphs(d.id)"
                  :key="glyph.id"
                  class="rounded-sm border border-ink/10 bg-paper-50 px-3 py-2"
                >
                  <div class="flex items-start gap-3 mb-2">
                    <div class="w-10 h-10 rounded-sm bg-paper-100 border border-ink/10 flex items-center justify-center font-title text-xl text-ink flex-shrink-0">
                      {{ glyph.headChar }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-serif font-medium text-ink">
                        {{ glyph.headChar }}
                        <span class="text-ink-muted font-normal text-xs ml-1">{{ glyph.pinyin || '' }}</span>
                      </div>
                      <div class="text-[11px] text-ink-muted font-serif">
                        部首：{{ glyph.radical || '—' }} · 笔画：{{ glyph.strokeCount || '—' }}
                      </div>
                    </div>
                  </div>
                  <div v-if="glyph.definition" class="text-xs font-serif text-ink-soft leading-relaxed mb-2">
                    {{ glyph.definition }}
                  </div>
                  <div v-if="glyph.variants.length > 0" class="mb-2">
                    <div class="text-[10px] text-ink-muted mb-1 font-serif">异体字形（{{ glyph.variants.length }} 个）</div>
                    <div class="flex flex-wrap gap-1.5">
                      <div
                        v-for="v in glyph.variants.slice(0, 8)"
                        :key="v.id"
                        class="px-1.5 py-0.5 rounded-sm border border-ink/10 bg-paper-100 font-title text-sm"
                        :title="`${v.dynasty || '不详'} · ${v.sourceTitle || '出处不详'} · ${GLYPH_VARIANT_TYPE_META[v.variantType]?.label || ''}`"
                      >
                        {{ v.variantChar }}
                      </div>
                      <div v-if="glyph.variants.length > 8" class="px-1.5 py-0.5 text-xs text-ink-muted">
                        +{{ glyph.variants.length - 8 }}
                      </div>
                    </div>
                  </div>
                  <div v-if="glyph.evolutionChain && glyph.evolutionChain.length > 0">
                    <div class="text-[10px] text-ink-muted mb-1 font-serif">演化链</div>
                    <div class="flex items-center gap-1 flex-wrap">
                      <template v-for="(step, idx) in glyph.evolutionChain" :key="step.id">
                        <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-rattan/10 text-rattan font-serif">
                          {{ step.dynasty || '—' }}
                        </span>
                        <span v-if="idx < glyph.evolutionChain.length - 1" class="text-ink-pale text-xs">→</span>
                      </template>
                    </div>
                  </div>
                  <div v-if="getGlyphLink(d.id, glyph.id)?.relevanceNote" class="text-[11px] text-vermilion/80 font-serif mt-1.5 italic">
                    ▸ {{ getGlyphLink(d.id, glyph.id)?.relevanceNote }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 证据链 -->
        <div v-else-if="section.type === 'evidence_chain'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <Link class="w-5 h-5 text-vermilion" />
            {{ section.title }}
          </h3>
          <div class="scroll-divider mb-5" />
          <div class="space-y-3">
            <div
              v-for="item in evidenceChain.slice(0, 20)"
              :key="item.id"
              class="flex items-start gap-3 p-3 rounded-sm border border-ink/10 bg-paper-50/50 hover:bg-paper-100/70 transition-colors"
            >
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                :class="{
                  'bg-rattan/20 text-vermilion': item.type === 'rule',
                  'bg-azure/20 text-azure': item.type === 'diff',
                  'bg-moss/20 text-moss': item.type === 'annotation',
                  'bg-carmine/20 text-carmine': item.type === 'review',
                  'bg-ink/10 text-ink-muted': item.type === 'document',
                }"
              >
                <BookOpen v-if="item.type === 'rule'" class="w-4 h-4" />
                <Hash v-else-if="item.type === 'diff'" class="w-4 h-4" />
                <MessageSquare v-else-if="item.type === 'annotation'" class="w-4 h-4" />
                <CheckSquare v-else-if="item.type === 'review'" class="w-4 h-4" />
                <Folder v-else class="w-4 h-4" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-serif text-sm text-ink font-medium truncate">{{ item.title }}</div>
                <div class="text-xs text-ink-muted font-serif mt-0.5 line-clamp-1">{{ item.content }}</div>
                <div class="text-[10px] text-ink-pale font-mono mt-1">
                  {{ formatDate(item.timestamp) }}
                  <span v-if="item.author"> · {{ item.author }}</span>
                </div>
              </div>
            </div>
            <div v-if="evidenceChain.length > 20" class="text-center text-xs text-ink-muted font-serif py-2">
              共 {{ evidenceChain.length }} 条证据，仅显示前 20 条。导出完整证据链可查看全部内容。
            </div>
            <div v-if="evidenceChain.length === 0" class="text-center py-8 text-ink-muted font-serif text-sm">
              暂无证据链数据
            </div>
          </div>
        </div>

        <!-- 引用清单 -->
        <div v-else-if="section.type === 'citation_summary'" class="card-scroll p-5">
          <h3 class="font-title text-lg text-ink mb-4 flex items-center gap-2">
            <BookMarked class="w-5 h-5 text-vermilion" />
            {{ section.title }}
          </h3>
          <div class="scroll-divider mb-5" />
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">引用总数</div>
              <div class="text-ink font-title text-xl">{{ citationSummary.stats.total }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">一级证据</div>
              <div class="text-vermilion font-title text-xl">{{ citationSummary.stats.byCredibility.primary }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">关联差异条目</div>
              <div class="text-azure font-title text-xl">{{ citationSummary.stats.linkedDiffEntries }}</div>
            </div>
            <div class="rounded-sm bg-paper-100/70 border border-ink/10 p-3">
              <div class="text-ink-muted text-xs mb-1">关联链接</div>
              <div class="text-moss font-title text-xl">{{ citationSummary.links.length }}</div>
            </div>
          </div>

          <div v-if="citationSummary.citations.length > 0" class="space-y-3">
            <div
              v-for="c in citationSummary.citations"
              :key="c.id"
              class="rounded-sm border border-ink/15 p-4 bg-paper-50"
            >
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <BookOpen class="w-4 h-4 text-vermilion flex-shrink-0" />
                  <span class="font-serif text-sm text-ink font-medium truncate">{{ c.title }}</span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-sm border flex-shrink-0"
                    :class="CITATION_TYPE_META[c.citationType].cls"
                  >
                    {{ CITATION_TYPE_META[c.citationType].label }}
                  </span>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-sm border flex-shrink-0"
                    :class="CREDIBILITY_META[c.credibility].cls"
                  >
                    {{ getCredibilityShield(c.credibility) }} {{ CREDIBILITY_META[c.credibility].label }}
                  </span>
                </div>
                <span v-if="c.diffEntryIds.length > 0" class="text-[10px] text-azure flex items-center gap-1 flex-shrink-0">
                  <Link2 class="w-3 h-3" />
                  关联 {{ c.diffEntryIds.length }} 条差异
                </span>
              </div>
              <div class="text-xs font-serif text-ink-soft leading-relaxed pl-6 mb-2 line-clamp-3">
                {{ c.content }}
              </div>
              <div v-if="c.imageData" class="mb-2 ml-6 rounded-sm border border-ink/10 overflow-hidden bg-paper-100">
                <div class="text-[10px] text-ink-muted px-2 py-1 border-b border-ink/10 flex items-center gap-1">
                  <Image class="w-3 h-3" />
                  图像页码 <span class="text-ink-pale ml-1">{{ c.imageName }}</span>
                </div>
                <img
                  :src="c.imageData"
                  :alt="c.title"
                  class="w-full max-h-32 object-contain p-2"
                  @click="openImage(c.imageData)"
                  style="cursor: pointer;"
                />
              </div>
              <div class="text-[10px] text-ink-pale font-serif pl-6 flex flex-wrap gap-3">
                <span>来源：{{ c.source }}</span>
                <span v-if="c.author">作者：{{ c.author }}</span>
                <span v-if="c.dynasty">朝代：{{ c.dynasty }}</span>
                <span v-if="c.volume">卷次：{{ c.volume }}</span>
                <span v-if="c.page">页码：{{ c.page }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-ink-muted font-serif text-sm">
            暂无引用数据
          </div>
        </div>
      </template>
    </template>

    <!-- 模板管理弹窗 -->
    <div v-if="showTemplateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div class="p-5 border-b border-ink/10 flex items-center justify-between">
          <h3 class="font-title text-xl text-ink">报告模板管理</h3>
          <button class="btn-ghost !p-2" @click="closeTemplateModal">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <!-- 新建模板表单 -->
          <div v-if="showNewTemplateForm" class="mb-6 p-4 rounded-sm border border-ink/15 bg-paper-50">
            <h4 class="font-serif text-sm font-bold text-ink mb-3">新建模板</h4>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-ink-muted font-serif mb-1">模板名称</label>
                <input v-model="newTemplateName" type="text" class="input-field text-sm" placeholder="输入模板名称" />
              </div>
              <div>
                <label class="block text-xs text-ink-muted font-serif mb-1">模板描述</label>
                <input v-model="newTemplateDesc" type="text" class="input-field text-sm" placeholder="输入模板描述（可选）" />
              </div>
              <div class="flex gap-2">
                <button class="btn-primary !py-1.5 text-sm" @click="createNewTemplate">
                  <Plus class="w-4 h-4" />
                  创建
                </button>
                <button class="btn-secondary !py-1.5 text-sm" @click="showNewTemplateForm = false">
                  取消
                </button>
              </div>
            </div>
          </div>

          <div v-else class="flex items-center justify-between mb-4">
            <div class="text-sm font-serif text-ink-muted">
              共 {{ templateStore.templates.length }} 个模板
            </div>
            <button class="btn-secondary !py-1.5 text-sm" @click="showNewTemplateForm = true">
              <Plus class="w-4 h-4" />
              新建模板
            </button>
          </div>

          <!-- 模板列表 -->
          <div v-if="!editingTemplate" class="space-y-3">
            <div
              v-for="tpl in templateStore.sortedTemplates"
              :key="tpl.id"
              class="p-4 rounded-sm border border-ink/15 bg-paper-50 hover:border-vermilion/40 transition-all"
              :class="{ 'border-vermilion/50 bg-vermilion/5': selectedTemplateId === tpl.id }"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-serif text-ink font-medium">{{ tpl.name }}</span>
                    <span v-if="tpl.isDefault" class="text-[10px] px-1.5 py-0.5 rounded-sm bg-rattan/30 text-ink border border-rattan/50">默认</span>
                    <span v-if="selectedTemplateId === tpl.id" class="text-[10px] px-1.5 py-0.5 rounded-sm bg-vermilion/20 text-vermilion border border-vermilion/30">使用中</span>
                  </div>
                  <div class="text-xs text-ink-muted font-serif mt-1">{{ tpl.description || '无描述' }}</div>
                  <div class="text-[10px] text-ink-pale font-mono mt-1">
                    {{ tpl.sections.length }} 个模块 · 更新于 {{ formatDate(tpl.updatedAt) }}
                  </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <button
                    class="btn-ghost !p-1.5"
                    title="使用此模板"
                    @click="selectTemplate(tpl.id)"
                  >
                    <CheckCircle class="w-4 h-4" />
                  </button>
                  <button
                    class="btn-ghost !p-1.5"
                    title="复制模板"
                    @click="duplicateTemplate(tpl.id)"
                  >
                    <Copy class="w-4 h-4" />
                  </button>
                  <button
                    class="btn-ghost !p-1.5"
                    title="编辑模板"
                    @click="editTemplate(tpl)"
                  >
                    <Settings class="w-4 h-4" />
                  </button>
                  <button
                    v-if="!tpl.isDefault"
                    class="btn-ghost !p-1.5 text-carmine hover:bg-carmine/10"
                    title="删除模板"
                    @click="deleteTemplate(tpl.id)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 编辑模板 -->
          <div v-else>
            <div class="flex items-center justify-between mb-4">
              <button class="text-sm text-vermilion font-serif flex items-center gap-1" @click="editingTemplate = null">
                <ArrowLeft class="w-4 h-4" />
                返回模板列表
              </button>
              <div class="flex gap-2">
                <button
                  v-if="!editingTemplate.isDefault"
                  class="btn-secondary !py-1.5 text-sm"
                  @click="setDefaultTemplate(editingTemplate.id)"
                >
                  设为默认
                </button>
                <button class="btn-primary !py-1.5 text-sm" @click="saveTemplateEdit">
                  <Save class="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>

            <div class="space-y-3 mb-4">
              <div>
                <label class="block text-xs text-ink-muted font-serif mb-1">模板名称</label>
                <input v-model="editingTemplate.name" type="text" class="input-field text-sm" />
              </div>
              <div>
                <label class="block text-xs text-ink-muted font-serif mb-1">模板描述</label>
                <input v-model="editingTemplate.description" type="text" class="input-field text-sm" />
              </div>
            </div>

            <div class="text-sm font-serif text-ink mb-2">模块列表（拖拽排序）</div>
            <div class="space-y-2">
              <div
                v-for="sec in editingTemplate.sections"
                :key="sec.id"
                class="p-3 rounded-sm border border-ink/15 bg-paper-50 flex items-center gap-3"
                :class="{ 'opacity-50': !sec.visible }"
              >
                <button
                  class="btn-ghost !p-1"
                  @click="toggleSectionVisibility(sec.id)"
                  :title="sec.visible ? '隐藏' : '显示'"
                >
                  <Eye v-if="sec.visible" class="w-4 h-4 text-ink" />
                  <EyeOff v-else class="w-4 h-4 text-ink-muted" />
                </button>
                <div class="flex-1 min-w-0">
                  <div class="font-serif text-sm text-ink">{{ sec.title }}</div>
                  <div class="text-[10px] text-ink-muted font-mono">{{ sectionTypeLabels[sec.type] || sec.type }}</div>
                </div>
                <div class="flex items-center gap-1">
                  <button class="btn-ghost !p-1" @click="moveSection(sec.id, 'up')">
                    <ChevronUp class="w-4 h-4" />
                  </button>
                  <button class="btn-ghost !p-1" @click="moveSection(sec.id, 'down')">
                    <ChevronDown class="w-4 h-4" />
                  </button>
                  <button class="btn-ghost !p-1" @click="editSection(sec)">
                    <Settings class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 编辑模块弹窗（内嵌） -->
          <div v-if="editingSection" class="fixed inset-0 z-60 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <div class="card-scroll w-full max-w-md p-5">
              <h4 class="font-title text-lg text-ink mb-4">编辑模块</h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs text-ink-muted font-serif mb-1">模块标题</label>
                  <input v-model="editingSection.title" type="text" class="input-field text-sm" />
                </div>
                <div>
                  <label class="block text-xs text-ink-muted font-serif mb-1">模块类型</label>
                  <input :value="sectionTypeLabels[editingSection.type] || editingSection.type" type="text" class="input-field text-sm bg-paper-100" disabled />
                </div>
              </div>
              <div class="flex justify-end gap-2 mt-5">
                <button class="btn-secondary !py-1.5 text-sm" @click="cancelSectionEdit">
                  取消
                </button>
                <button class="btn-primary !py-1.5 text-sm" @click="saveSectionEdit">
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 证据链弹窗 -->
    <div v-if="showEvidenceModal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div class="p-5 border-b border-ink/10 flex items-center justify-between">
          <h3 class="font-title text-xl text-ink flex items-center gap-2">
            <Link class="w-5 h-5 text-vermilion" />
            完整证据链
          </h3>
          <div class="flex items-center gap-2">
            <button class="btn-primary !py-1.5 text-sm" @click="downloadEvidenceChain">
              <Download class="w-4 h-4" />
              导出证据链
            </button>
            <button class="btn-ghost !p-2" @click="showEvidenceModal = false">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div class="p-3 rounded-sm border border-ink/10 bg-paper-50">
              <div class="text-xs text-ink-muted font-serif">项目信息</div>
              <div class="font-title text-lg text-ink mt-1">{{ projectStore.currentProject ? 1 : 0 }}</div>
            </div>
            <div class="p-3 rounded-sm border border-ink/10 bg-paper-50">
              <div class="text-xs text-ink-muted font-serif">规则条目</div>
              <div class="font-title text-lg text-rattan-dark mt-1">{{ ruleStore.rules.length }}</div>
            </div>
            <div class="p-3 rounded-sm border border-ink/10 bg-paper-50">
              <div class="text-xs text-ink-muted font-serif">差异条目</div>
              <div class="font-title text-lg text-azure mt-1">{{ diffStore.entries.length }}</div>
            </div>
            <div class="p-3 rounded-sm border border-ink/10 bg-paper-50">
              <div class="text-xs text-ink-muted font-serif">批注/复核记录</div>
              <div class="font-title text-lg text-moss mt-1">{{ projectAnnotations.length + projectReviewFlows.length }}</div>
            </div>
          </div>

          <div class="text-sm font-serif text-ink mb-3">时间线视图</div>
          <div class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-px bg-ink/20" />
            <div class="space-y-4">
              <div
                v-for="(item, idx) in evidenceChain"
                :key="item.id"
                class="relative flex items-start gap-4 pl-10"
              >
                <div
                  class="absolute left-2 w-5 h-5 rounded-full border-2 border-paper-50 flex items-center justify-center"
                  :class="{
                    'bg-rattan': item.type === 'rule',
                    'bg-azure': item.type === 'diff',
                    'bg-moss': item.type === 'annotation',
                    'bg-carmine': item.type === 'review',
                    'bg-ink/30': item.type === 'document',
                  }"
                >
                  <BookOpen v-if="item.type === 'rule'" class="w-2.5 h-2.5 text-paper-50" />
                  <Hash v-else-if="item.type === 'diff'" class="w-2.5 h-2.5 text-paper-50" />
                  <MessageSquare v-else-if="item.type === 'annotation'" class="w-2.5 h-2.5 text-paper-50" />
                  <CheckSquare v-else-if="item.type === 'review'" class="w-2.5 h-2.5 text-paper-50" />
                  <Folder v-else class="w-2.5 h-2.5 text-paper-50" />
                </div>
                <div class="flex-1 p-3 rounded-sm border border-ink/10 bg-paper-50">
                  <div class="flex items-start justify-between gap-2">
                    <div class="font-serif text-sm text-ink font-medium">{{ item.title }}</div>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-sm flex-shrink-0"
                      :class="{
                        'bg-rattan/20 text-rattan-dark border border-rattan/30': item.type === 'rule',
                        'bg-azure/10 text-azure border border-azure/30': item.type === 'diff',
                        'bg-moss/10 text-moss border border-moss/30': item.type === 'annotation',
                        'bg-carmine/10 text-carmine border border-carmine/30': item.type === 'review',
                        'bg-ink/10 text-ink-muted border border-ink/20': item.type === 'document',
                      }"
                    >
                      {{ item.type === 'rule' ? '规则' : item.type === 'diff' ? '差异' : item.type === 'annotation' ? '批注' : item.type === 'review' ? '复核' : '文档' }}
                    </span>
                  </div>
                  <div class="text-xs text-ink font-serif mt-1.5 leading-relaxed">{{ item.content }}</div>
                  <div class="text-[10px] text-ink-pale font-mono mt-2">
                    {{ formatDate(item.timestamp) }}
                    <span v-if="item.author"> · {{ item.author }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="evidenceChain.length === 0" class="text-center py-12 text-ink-muted font-serif">
            <History class="w-12 h-12 mx-auto mb-3 opacity-30" />
            <div>暂无证据链数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
