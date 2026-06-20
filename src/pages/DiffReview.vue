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
  Link2,
  Unlink,
  BookOpen,
  ShieldCheck,
  Search,
  Plus,
  Image,
  Upload,
  Type,
  ListTree,
  Sparkles as SparklesIcon,
} from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useDiffStore } from '@/stores/diffStore';
import { useTextStore } from '@/stores/textStore';
import { useAnnotationStore } from '@/stores/annotationStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useCitationStore } from '@/stores/citationStore';
import { useGlyphStore } from '@/stores/glyphStore';
import TextHighlightViewer from '@/components/TextHighlightViewer.vue';
import type { DiffEntry, JudgmentType, ReviewFlow, Annotation, CitationType, CitationCredibility } from '@/types';
import { CITATION_TYPE_META, CREDIBILITY_META } from '@/types';
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
const citationStore = useCitationStore();
const glyphStore = useGlyphStore();
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
const activeTab = ref<'judgment' | 'annotation' | 'review' | 'evidence' | 'glyph'>('judgment');
const glyphSearch = ref('');
const glyphLinkRelevanceNote = ref('');
const showGlyphLinkModal = ref(false);
const linkTargetGlyphId = ref<string | null>(null);
const newAnnotation = ref('');
const reviewComment = ref('');
const showReviewHistory = ref(false);
const evidenceSearch = ref('');
const linkRelevanceNote = ref('');
const showLinkModal = ref(false);
const linkTargetCitationId = ref<string | null>(null);
const showCreateCitationModal = ref(false);

const quickCitationForm = reactive({
  title: '',
  citationType: 'taboo_literature' as CitationType,
  source: '',
  author: '',
  dynasty: '',
  volume: '',
  page: '',
  content: '',
  imageData: '',
  imageName: '',
  credibility: 'secondary' as CitationCredibility,
  tags: '',
  relevanceNote: '',
});

const quickCitationError = ref('');
const toast = ref('');
const quickCitationImageInput = ref<HTMLInputElement | null>(null);

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

function handleQuickCitationImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    flashToast('请选择图片文件');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    flashToast('图片大小不能超过 5MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    quickCitationForm.imageData = e.target?.result as string;
    quickCitationForm.imageName = file.name;
  };
  reader.readAsDataURL(file);
}

function clearQuickCitationImage() {
  quickCitationForm.imageData = '';
  quickCitationForm.imageName = '';
  if (quickCitationImageInput.value) {
    quickCitationImageInput.value.value = '';
  }
}

function openImage(imageData: string) {
  window.open(imageData, '_blank');
}

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

const currentEvidenceList = computed(() => {
  if (!diffStore.selectedId) return [];
  return citationStore.getCitationsByDiffEntry(diffStore.selectedId);
});

const currentEvidenceGrouped = computed(() => {
  if (!diffStore.selectedId) return { primary: [], secondary: [], tertiary: [] };
  return citationStore.getCitationsByDiffAndCredibility(diffStore.selectedId);
});

const currentEvidenceWithLinks = computed(() => {
  if (!diffStore.selectedId) return [];
  return citationStore.getCitationsWithLinksByDiffEntry(diffStore.selectedId);
});

const availableCitationsForLink = computed(() => {
  if (!diffStore.selectedId) return [];
  const linked = citationStore.getCitationsByDiffEntry(diffStore.selectedId);
  const linkedIds = new Set(linked.map((c) => c.id));
  return citationStore.searchCitations(evidenceSearch.value, {
    projectId: projectStore.currentProjectId || undefined,
  }).filter((c) => !linkedIds.has(c.id));
});

function openLinkModal(citationId: string) {
  linkTargetCitationId.value = citationId;
  linkRelevanceNote.value = '';
  showLinkModal.value = true;
}

function doLinkCitation() {
  if (!diffStore.selectedId || !linkTargetCitationId.value) return;
  const link = citationStore.linkToDiff(
    linkTargetCitationId.value,
    diffStore.selectedId,
    linkRelevanceNote.value || undefined,
  );
  if (link) {
    auditStore.addLog({
      actionType: 'citation_link',
      actor: '本地用户',
      projectId: projectStore.currentProjectId || undefined,
      targetId: diffStore.selectedId,
      description: `关联典籍依据到差异条目`,
      details: { citationId: linkTargetCitationId.value, relevanceNote: linkRelevanceNote.value },
    });
    flashToast('已成功关联典籍依据');
  } else {
    flashToast('该差异条目已关联此典籍依据，无需重复关联');
  }
  showLinkModal.value = false;
  linkTargetCitationId.value = null;
  linkRelevanceNote.value = '';
}

function doUnlinkCitation(citationId: string) {
  if (!diffStore.selectedId) return;
  citationStore.unlinkFromDiff(citationId, diffStore.selectedId);
  auditStore.addLog({
    actionType: 'citation_unlink',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: '解除典籍依据关联',
    details: { citationId },
  });
}

const currentGlyphList = computed(() => {
  if (!diffStore.selectedId) return [];
  return glyphStore.getGlyphsByDiffEntry(diffStore.selectedId);
});

const currentGlyphLinks = computed(() => {
  if (!diffStore.selectedId) return [];
  return glyphStore.getLinksByDiffEntry(diffStore.selectedId);
});

const suggestedGlyphs = computed(() => {
  if (!diffStore.selectedEntry) return [];
  const chars = new Set<string>();
  const original = diffStore.selectedEntry.originalText || '';
  const revised = diffStore.selectedEntry.revisedText || '';
  for (const ch of original) chars.add(ch);
  for (const ch of revised) chars.add(ch);
  
  const results: Array<{ entry: any; variant?: any }> = [];
  for (const ch of chars) {
    const similar = glyphStore.findSimilarVariants(ch);
    results.push(...similar);
  }
  const uniqueIds = new Set<string>();
  const uniqueResults = results.filter(r => {
    if (uniqueIds.has(r.entry.id)) return false;
    uniqueIds.add(r.entry.id);
    return true;
  });
  return uniqueResults;
});

const availableGlyphsForLink = computed(() => {
  if (!diffStore.selectedId) return [];
  const linked = glyphStore.getGlyphsByDiffEntry(diffStore.selectedId);
  const linkedIds = new Set(linked.map((g) => g.id));
  return glyphStore.searchGlyphs(glyphSearch.value, {
    projectId: projectStore.currentProjectId || undefined,
  }).filter((g) => !linkedIds.has(g.id));
});

function openGlyphLinkModal(glyphId: string) {
  linkTargetGlyphId.value = glyphId;
  glyphLinkRelevanceNote.value = '';
  showGlyphLinkModal.value = true;
}

function doLinkGlyph() {
  if (!diffStore.selectedId || !linkTargetGlyphId.value) return;
  const link = glyphStore.linkToDiff(
    linkTargetGlyphId.value,
    diffStore.selectedId,
    undefined,
    glyphLinkRelevanceNote.value || undefined,
  );
  if (link) {
    auditStore.addLog({
      actionType: 'glyph_link',
      actor: '本地用户',
      projectId: projectStore.currentProjectId || undefined,
      targetId: diffStore.selectedId,
      description: '关联字形证据到差异条目',
      details: { glyphId: linkTargetGlyphId.value },
    });
    flashToast('已成功关联字形证据');
  } else {
    flashToast('该差异条目已关联此字形，无需重复关联');
  }
  showGlyphLinkModal.value = false;
  linkTargetGlyphId.value = null;
  glyphLinkRelevanceNote.value = '';
}

function doUnlinkGlyph(glyphId: string) {
  if (!diffStore.selectedId) return;
  glyphStore.unlinkFromDiff(glyphId, diffStore.selectedId);
  auditStore.addLog({
    actionType: 'glyph_unlink',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: diffStore.selectedId,
    description: '解除字形证据关联',
    details: { glyphId },
  });
}

function openCreateCitationModal() {
  quickCitationForm.title = '';
  quickCitationForm.citationType = 'taboo_literature';
  quickCitationForm.source = '';
  quickCitationForm.author = '';
  quickCitationForm.dynasty = '';
  quickCitationForm.volume = '';
  quickCitationForm.page = '';
  quickCitationForm.content = '';
  quickCitationForm.imageData = '';
  quickCitationForm.imageName = '';
  quickCitationForm.credibility = 'secondary';
  quickCitationForm.tags = '';
  quickCitationForm.relevanceNote = '';
  quickCitationError.value = '';
  showCreateCitationModal.value = true;
}

function submitQuickCitation() {
  if (!quickCitationForm.title.trim()) {
    quickCitationError.value = '典籍名称不能为空';
    return;
  }
  if (!quickCitationForm.source.trim()) {
    quickCitationError.value = '来源出处不能为空';
    return;
  }
  if (!quickCitationForm.content.trim()) {
    quickCitationError.value = '引文内容不能为空';
    return;
  }
  if (!diffStore.selectedId) return;

  const tagsArr = quickCitationForm.tags
    .split(/[,，、;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const result = citationStore.addCitationAndLink(
    {
      title: quickCitationForm.title.trim(),
      citationType: quickCitationForm.citationType,
      source: quickCitationForm.source.trim(),
      author: quickCitationForm.author.trim() || undefined,
      dynasty: quickCitationForm.dynasty.trim() || undefined,
      volume: quickCitationForm.volume.trim() || undefined,
      page: quickCitationForm.page.trim() || undefined,
      content: quickCitationForm.content.trim(),
      imageData: quickCitationForm.imageData || undefined,
      imageName: quickCitationForm.imageName || undefined,
      credibility: quickCitationForm.credibility,
      tags: tagsArr,
      projectId: projectStore.currentProjectId || undefined,
    },
    diffStore.selectedId,
    quickCitationForm.relevanceNote || undefined,
  );

  auditStore.addLog({
    actionType: 'citation_create',
    actor: '本地用户',
    projectId: projectStore.currentProjectId || undefined,
    targetId: result.citation.id,
    description: `快速新增典籍依据并关联：${quickCitationForm.title}`,
    details: { diffEntryId: diffStore.selectedId },
  });

  if (result.link) {
    auditStore.addLog({
      actionType: 'citation_link',
      actor: '本地用户',
      projectId: projectStore.currentProjectId || undefined,
      targetId: diffStore.selectedId,
      description: '关联典籍依据到差异条目',
      details: { citationId: result.citation.id },
    });
  }

  flashToast('已创建典籍依据并关联到当前差异条目');
  showCreateCitationModal.value = false;
}

function getCredibilityShield(cred: string) {
  if (cred === 'primary') return '★★★';
  if (cred === 'secondary') return '★★☆';
  return '★☆☆';
}

const quickCitationTypeOptions: { value: CitationType; label: string }[] = [
  { value: 'taboo_literature', label: '避讳制度文献' },
  { value: 'collation_note', label: '校勘记' },
  { value: 'version_excerpt', label: '历代版本摘录' },
  { value: 'image_page', label: '图像页码' },
];

const quickCredibilityOptions: { value: CitationCredibility; label: string; desc: string }[] = [
  { value: 'primary', label: '一级', desc: '原始典籍、善本原书、出土文献等一手资料' },
  { value: 'secondary', label: '二级', desc: '后人的校勘记、注疏、影印本等间接依据' },
  { value: 'tertiary', label: '三级', desc: '今人研究论文、网络资料等参考性文献' },
];
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
              <span v-if="citationStore.getCitationsByDiffEntry(d.id).length > 0" class="flex items-center gap-1 text-rattan-dark">
                <BookOpen class="w-3.5 h-3.5" />
                {{ citationStore.getCitationsByDiffEntry(d.id).length }} 依据
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
                { key: 'evidence', label: '典籍依据', icon: BookOpen },
                { key: 'glyph', label: '字形谱系', icon: Type },
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
              <span
                v-if="tab.key === 'evidence' && diffStore.selectedEntry"
                class="text-xs bg-paper-200 px-1.5 rounded-full"
              >
                {{ currentEvidenceList.length }}
              </span>
              <span
                v-if="tab.key === 'glyph' && diffStore.selectedEntry"
                class="text-xs bg-paper-200 px-1.5 rounded-full"
              >
                {{ currentGlyphList.length }}
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

            <div v-show="activeTab === 'evidence'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-sm font-serif text-ink-soft">
                  典籍依据 · 共 {{ currentEvidenceList.length }} 条关联
                  <span v-if="currentEvidenceList.length > 0" class="text-ink-muted">
                    （按可信度分组展示）
                  </span>
                </div>
                <button class="btn-secondary !py-1 !px-3 text-xs" @click="openCreateCitationModal">
                  <Plus class="w-3.5 h-3.5" />
                  快速新增典籍依据
                </button>
              </div>

              <div v-if="currentEvidenceList.length > 0" class="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                <template v-for="credLevel in (['primary', 'secondary', 'tertiary'] as const)" :key="credLevel">
                  <div v-if="currentEvidenceGrouped[credLevel].length > 0">
                    <div
                      class="text-xs font-serif mb-2 flex items-center gap-2"
                      :class="{
                        'text-vermilion': credLevel === 'primary',
                        'text-azure': credLevel === 'secondary',
                        'text-ink-muted': credLevel === 'tertiary',
                      }"
                    >
                      <ShieldCheck class="w-3.5 h-3.5" />
                      {{ CREDIBILITY_META[credLevel].label }}证据（{{ getCredibilityShield(credLevel) }}）
                      <span class="text-ink-pale font-mono">· {{ currentEvidenceGrouped[credLevel].length }} 条</span>
                      <span class="text-[10px] text-ink-pale font-normal ml-1">{{ CREDIBILITY_META[credLevel].desc }}</span>
                    </div>
                    <div class="space-y-2 ml-3 border-l-2 pl-3"
                      :class="{
                        'border-vermilion/30': credLevel === 'primary',
                        'border-azure/30': credLevel === 'secondary',
                        'border-ink/10': credLevel === 'tertiary',
                      }"
                    >
                      <div
                        v-for="item in currentEvidenceWithLinks.filter(x => x.citation.credibility === credLevel)"
                        :key="item.citation.id"
                        class="rounded-sm border p-3 bg-paper-50"
                        :class="{
                          'border-vermilion/30 bg-vermilion/5': credLevel === 'primary',
                          'border-azure/20 bg-azure/5': credLevel === 'secondary',
                          'border-ink/15': credLevel === 'tertiary',
                        }"
                      >
                        <div class="flex items-start justify-between mb-2">
                          <div class="flex items-center gap-2 flex-1 min-w-0">
                            <BookOpen class="w-4 h-4 text-vermilion flex-shrink-0" />
                            <span class="font-serif text-sm text-ink truncate font-medium">{{ item.citation.title }}</span>
                            <span
                              class="text-[10px] px-1.5 py-0.5 rounded-sm border flex-shrink-0"
                              :class="CITATION_TYPE_META[item.citation.citationType].cls"
                            >
                              {{ CITATION_TYPE_META[item.citation.citationType].label }}
                            </span>
                          </div>
                          <button
                            class="btn-ghost !p-1 hover:!text-carmine flex-shrink-0"
                            @click="doUnlinkCitation(item.citation.id)"
                            title="解除关联"
                          >
                            <Unlink class="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div class="text-xs font-serif text-ink leading-relaxed pl-6 bg-paper-100/50 rounded-sm p-2 whitespace-pre-wrap">
                          {{ item.citation.content }}
                        </div>
                        <div v-if="item.citation.imageData" class="mt-2 ml-6 rounded-sm border border-ink/10 overflow-hidden bg-paper-100">
                          <div class="text-[10px] text-ink-muted px-2 py-1 border-b border-ink/10 flex items-center gap-1">
                            <Image class="w-3 h-3" />
                            图像页码 <span class="text-ink-pale ml-1">{{ item.citation.imageName }}</span>
                          </div>
                          <img
                            :src="item.citation.imageData"
                            :alt="item.citation.title"
                            class="w-full max-h-40 object-contain p-2"
                            @click="openImage(item.citation.imageData)"
                            style="cursor: pointer;"
                          />
                        </div>
                        <div class="mt-2 text-[10px] text-ink-pale font-serif pl-6 flex flex-wrap gap-x-3 gap-y-1">
                          <span>来源：{{ item.citation.source }}</span>
                          <span v-if="item.citation.author">作者：{{ item.citation.author }}</span>
                          <span v-if="item.citation.dynasty">朝代：{{ item.citation.dynasty }}</span>
                          <span v-if="item.citation.volume">卷次：{{ item.citation.volume }}</span>
                          <span v-if="item.citation.page">页码：{{ item.citation.page }}</span>
                        </div>
                        <div
                          v-if="item.link?.relevanceNote"
                          class="mt-2 text-[10px] font-serif text-vermilion pl-6 flex items-start gap-1"
                        >
                          <CornerDownRight class="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>关联说明：{{ item.link.relevanceNote }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <div v-else class="text-center py-6 text-ink-muted font-serif text-sm rounded-sm border border-dashed border-ink/10 bg-paper-50/50">
                <BookOpen class="w-8 h-8 mx-auto text-ink-pale mb-2" />
                <div>暂未关联典籍依据</div>
                <div class="text-xs mt-1">从下方选择典籍关联，或点击右上角「快速新增」创建新依据</div>
              </div>

              <div class="scroll-divider" />

              <div>
                <div class="text-sm font-serif text-ink-soft mb-2 flex items-center gap-2">
                  <Link2 class="w-4 h-4 text-vermilion" />
                  关联已有典籍依据
                </div>
                <div class="relative mb-2">
                  <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
                  <input
                    v-model="evidenceSearch"
                    type="text"
                    placeholder="搜索典籍名称、来源或内容……"
                    class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                  />
                </div>
                <div class="max-h-40 overflow-y-auto space-y-1.5">
                  <div
                    v-for="c in availableCitationsForLink.slice(0, 10)"
                    :key="c.id"
                    class="flex items-center gap-2 rounded-sm border border-ink/10 bg-paper-50 p-2 hover:border-vermilion/30 transition-all cursor-pointer"
                    @click="openLinkModal(c.id)"
                  >
                    <BookOpen class="w-3.5 h-3.5 text-ink-pale flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-serif text-xs text-ink truncate">{{ c.title }}</div>
                      <div class="text-[10px] text-ink-muted truncate">{{ c.source }}</div>
                    </div>
                    <span
                      class="text-[10px] px-1 py-0.5 rounded-sm border flex-shrink-0"
                      :class="CREDIBILITY_META[c.credibility].cls"
                    >
                      {{ CREDIBILITY_META[c.credibility].label }}
                    </span>
                    <Link2 class="w-3.5 h-3.5 text-vermilion flex-shrink-0" />
                  </div>
                  <div
                    v-if="availableCitationsForLink.length === 0"
                    class="text-center py-3 text-ink-muted font-serif text-xs"
                  >
                    {{ evidenceSearch ? '没有找到匹配的典籍依据' : '所有典籍依据已关联，或尚未录入' }}
                  </div>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'glyph'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-sm font-serif text-ink-soft">
                  字形证据 · 共 {{ currentGlyphList.length }} 条关联
                </div>
                <RouterLink to="/glyphs" class="btn-secondary !py-1 !px-3 text-xs">
                  <ListTree class="w-3.5 h-3.5" />
                  打开字形谱系库
                </RouterLink>
              </div>

              <div v-if="suggestedGlyphs.length > 0" class="rounded-sm border border-rattan/30 bg-rattan/5 p-3">
                <div class="text-xs font-serif text-rattan mb-2 flex items-center gap-1.5">
                  <SparklesIcon class="w-3.5 h-3.5" />
                  智能提示 · 发现 {{ suggestedGlyphs.length }} 个相关字形
                </div>
                <div class="space-y-2 max-h-40 overflow-y-auto">
                  <div
                    v-for="sg in suggestedGlyphs"
                    :key="sg.entry.id"
                    class="flex items-center gap-2 rounded-sm border border-ink/10 bg-paper-50 p-2 hover:border-rattan/50 transition-all"
                  >
                    <div class="w-10 h-10 rounded-sm bg-paper-100 border border-ink/10 flex items-center justify-center font-title text-xl text-ink flex-shrink-0">
                      {{ sg.entry.headChar }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-serif text-sm text-ink font-medium">{{ sg.entry.headChar }}
                        <span class="text-ink-muted text-xs font-normal">{{ sg.entry.pinyin || '' }}</span>
                      </div>
                      <div class="text-[10px] text-ink-muted truncate">
                        {{ sg.entry.definition || '暂无释义' }} · {{ sg.entry.variants.length }} 个异体
                      </div>
                    </div>
                    <button
                      class="btn-ghost !p-1.5 hover:!text-vermilion"
                      @click="openGlyphLinkModal(sg.entry.id)"
                      title="关联此字形"
                    >
                      <Link2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="currentGlyphList.length > 0" class="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                <div
                  v-for="glyph in currentGlyphList"
                  :key="glyph.id"
                  class="rounded-sm border border-ink/15 bg-paper-50 p-3"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-12 h-12 rounded-sm bg-paper-100 border border-ink/10 flex items-center justify-center font-title text-2xl text-ink flex-shrink-0">
                        {{ glyph.headChar }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="font-serif text-base text-ink font-medium">
                          {{ glyph.headChar }}
                          <span class="text-ink-muted text-sm font-normal ml-1">{{ glyph.pinyin || '' }}</span>
                        </div>
                        <div class="text-xs text-ink-muted mt-0.5">
                          部首：{{ glyph.radical || '—' }} · 笔画：{{ glyph.strokeCount || '—' }}
                        </div>
                      </div>
                    </div>
                    <button
                      class="btn-ghost !p-1 hover:!text-carmine flex-shrink-0"
                      @click="doUnlinkGlyph(glyph.id)"
                      title="解除关联"
                    >
                      <Unlink class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div v-if="glyph.definition" class="text-xs font-serif text-ink leading-relaxed pl-15 bg-paper-100/50 rounded-sm p-2 mb-2 ml-15">
                    {{ glyph.definition }}
                  </div>

                  <div v-if="glyph.variants.length > 0" class="ml-15">
                    <div class="text-[10px] text-ink-muted mb-1 font-serif">异体字形（{{ glyph.variants.length }} 个）</div>
                    <div class="flex flex-wrap gap-1.5">
                      <div
                        v-for="v in glyph.variants.slice(0, 6)"
                        :key="v.id"
                        class="px-2 py-1 rounded-sm border border-ink/10 bg-paper-100 font-title text-sm"
                        :title="`${v.dynasty || '不详'} · ${v.sourceTitle || '出处不详'}`"
                      >
                        {{ v.variantChar }}
                      </div>
                      <div v-if="glyph.variants.length > 6" class="px-2 py-1 text-xs text-ink-muted">
                        +{{ glyph.variants.length - 6 }}
                      </div>
                    </div>
                  </div>

                  <div v-if="glyph.evolutionChain && glyph.evolutionChain.length > 0" class="ml-15 mt-2">
                    <div class="text-[10px] text-ink-muted mb-1 font-serif">演化链（{{ glyph.evolutionChain.length }} 个阶段）</div>
                    <div class="flex items-center gap-1 flex-wrap">
                      <template v-for="(step, idx) in glyph.evolutionChain.slice(0, 5)" :key="step.id">
                        <span class="text-xs px-1.5 py-0.5 rounded-sm bg-rattan/10 text-rattan font-serif">
                          {{ step.dynasty || '—' }}
                        </span>
                        <span v-if="idx < glyph.evolutionChain.length - 1 && idx < 4" class="text-ink-pale text-xs">→</span>
                      </template>
                    </div>
                  </div>

                  <div
                    v-if="currentGlyphLinks.find(l => l.glyphEntryId === glyph.id)?.relevanceNote"
                    class="mt-2 text-[10px] font-serif text-vermilion pl-15 flex items-start gap-1"
                  >
                    <CornerDownRight class="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>关联说明：{{ currentGlyphLinks.find(l => l.glyphEntryId === glyph.id)?.relevanceNote }}</span>
                  </div>
                </div>
              </div>

              <div v-else-if="suggestedGlyphs.length === 0" class="text-center py-6 text-ink-muted font-serif text-sm rounded-sm border border-dashed border-ink/10 bg-paper-50/50">
                <Type class="w-8 h-8 mx-auto text-ink-pale mb-2" />
                <div>暂未关联字形证据</div>
                <div class="text-xs mt-1">从下方搜索字形并关联，或前往字形谱系库录入</div>
              </div>

              <div class="scroll-divider" />

              <div>
                <div class="text-sm font-serif text-ink-soft mb-2 flex items-center gap-2">
                  <Link2 class="w-4 h-4 text-vermilion" />
                  关联已有字形
                </div>
                <div class="relative mb-2">
                  <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
                  <input
                    v-model="glyphSearch"
                    type="text"
                    placeholder="搜索字头、拼音、释义或异体字……"
                    class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                  />
                </div>
                <div class="max-h-40 overflow-y-auto space-y-1.5">
                  <div
                    v-for="g in availableGlyphsForLink.slice(0, 10)"
                    :key="g.id"
                    class="flex items-center gap-2 rounded-sm border border-ink/10 bg-paper-50 p-2 hover:border-vermilion/30 transition-all cursor-pointer"
                    @click="openGlyphLinkModal(g.id)"
                  >
                    <div class="w-8 h-8 rounded-sm bg-paper-100 border border-ink/10 flex items-center justify-center font-title text-base text-ink flex-shrink-0">
                      {{ g.headChar }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-serif text-xs text-ink">{{ g.headChar }}
                        <span class="text-ink-pale text-[10px]">{{ g.pinyin || '' }}</span>
                      </div>
                      <div class="text-[10px] text-ink-muted truncate">{{ g.definition || '暂无释义' }}</div>
                    </div>
                    <Link2 class="w-3.5 h-3.5 text-vermilion flex-shrink-0" />
                  </div>
                  <div
                    v-if="availableGlyphsForLink.length === 0"
                    class="text-center py-3 text-ink-muted font-serif text-xs"
                  >
                    {{ glyphSearch ? '没有找到匹配的字形' : '所有字形已关联，或尚未录入字形谱系库' }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showLinkModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showLinkModal = false"
      >
        <div class="card-scroll w-full max-w-md p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-lg text-ink">关联典籍依据</h3>
            <button class="btn-ghost" @click="showLinkModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />
          <div class="mb-4">
            <label class="block font-serif text-sm text-ink-soft mb-1">相关性说明（可选）</label>
            <textarea
              v-model="linkRelevanceNote"
              rows="3"
              placeholder="说明此典籍依据与当前差异条目的关联，如：该条校勘记直接论证了此处的避讳改字……"
              class="text-area-paper text-sm"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showLinkModal = false">取消</button>
            <button class="btn-primary" @click="doLinkCitation">
              <Link2 class="w-4 h-4" />
              确认关联
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showGlyphLinkModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showGlyphLinkModal = false"
      >
        <div class="card-scroll w-full max-w-md p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-lg text-ink">关联字形证据</h3>
            <button class="btn-ghost" @click="showGlyphLinkModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />
          <div class="mb-4">
            <label class="block font-serif text-sm text-ink-soft mb-1">相关性说明（可选）</label>
            <textarea
              v-model="glyphLinkRelevanceNote"
              rows="3"
              placeholder="说明此字形证据与当前差异条目的关联，如：该异体字为此处异文提供了字形演化层面的佐证……"
              class="text-area-paper text-sm"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showGlyphLinkModal = false">取消</button>
            <button class="btn-primary" @click="doLinkGlyph">
              <Link2 class="w-4 h-4" />
              确认关联
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showCreateCitationModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showCreateCitationModal = false"
      >
        <div class="card-scroll w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">快速新增典籍依据</h3>
            <button class="btn-ghost" @click="showCreateCitationModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">典籍名称 <span class="text-carmine">*</span></label>
              <input
                v-model="quickCitationForm.title"
                placeholder="如：《史记·高祖本纪》避讳改字考"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">典籍类型 <span class="text-carmine">*</span></label>
                <select
                  v-model="quickCitationForm.citationType"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="ct in quickCitationTypeOptions" :key="ct.value" :value="ct.value">{{ ct.label }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">可信度分级 <span class="text-carmine">*</span></label>
                <select
                  v-model="quickCitationForm.credibility"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="cr in quickCredibilityOptions" :key="cr.value" :value="cr.value">{{ cr.label }} — {{ cr.desc }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">来源出处 <span class="text-carmine">*</span></label>
              <input
                v-model="quickCitationForm.source"
                placeholder="如：中华书局1982年版、四库全书本、敦煌P.2536号写本"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">作者</label>
                <input
                  v-model="quickCitationForm.author"
                  placeholder="如：司马贞"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">朝代</label>
                <input
                  v-model="quickCitationForm.dynasty"
                  placeholder="如：唐代"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">卷次</label>
                <input
                  v-model="quickCitationForm.volume"
                  placeholder="如：卷三"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">页码</label>
                <input
                  v-model="quickCitationForm.page"
                  placeholder="如：第126页、P.5v"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">引文内容 <span class="text-carmine">*</span></label>
              <textarea
                v-model="quickCitationForm.content"
                rows="4"
                placeholder="录入典籍原文或校勘记内容……"
                class="text-area-paper text-sm"
              />
            </div>

            <div v-if="quickCitationForm.citationType === 'image_page'">
              <label class="block font-serif text-sm text-ink-soft mb-1">
                <Image class="w-3.5 h-3.5 inline mr-1" />
                图像页码截图（可选）
              </label>
              <div v-if="quickCitationForm.imageData" class="mb-3">
                <div class="relative rounded-sm border border-ink/20 overflow-hidden bg-paper-100">
                  <img :src="quickCitationForm.imageData" :alt="quickCitationForm.imageName" class="w-full max-h-48 object-contain" />
                  <button
                    type="button"
                    @click="clearQuickCitationImage"
                    class="absolute top-2 right-2 bg-paper-50/90 text-carmine px-2 py-1 text-xs rounded-sm border border-carmine/30 hover:bg-carmine/10 transition-colors"
                  >
                    <X class="w-3 h-3 inline mr-1" />
                    移除图片
                  </button>
                </div>
                <div class="text-xs text-ink-muted mt-1 font-serif">{{ quickCitationForm.imageName }}</div>
              </div>
              <div v-else>
                <input
                  ref="quickCitationImageInput"
                  type="file"
                  accept="image/*"
                  @change="handleQuickCitationImageUpload"
                  class="hidden"
                />
                <button
                  type="button"
                  @click="quickCitationImageInput?.click()"
                  class="w-full border-2 border-dashed border-ink/20 rounded-sm py-5 text-center hover:border-carmine/40 hover:bg-carmine/5 transition-colors"
                >
                  <Upload class="w-5 h-5 mx-auto text-ink-muted mb-1" />
                  <div class="text-sm text-ink-soft font-serif">点击上传古籍页面截图</div>
                  <div class="text-xs text-ink-muted mt-0.5">支持 JPG、PNG 格式，大小不超过 5MB</div>
                </button>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">标签</label>
              <input
                v-model="quickCitationForm.tags"
                placeholder="用逗号或顿号分隔，如：唐讳、世民改字、贞观"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="rounded-sm border border-rattan/30 bg-rattan/10 p-3">
              <label class="block font-serif text-sm text-ink-soft mb-1">相关性说明（可选）</label>
              <textarea
                v-model="quickCitationForm.relevanceNote"
                rows="2"
                placeholder="说明此典籍依据与当前差异条目的关联……"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-xs focus:border-vermilion focus:outline-none resize-none"
              />
            </div>
          </div>

          <div
            v-if="quickCitationError"
            class="mt-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine"
          >
            {{ quickCitationError }}
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showCreateCitationModal = false">取消</button>
            <button class="btn-primary" @click="submitQuickCitation">
              <Check class="w-4 h-4" />
              创建并关联
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
