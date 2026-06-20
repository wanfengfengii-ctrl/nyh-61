<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  X,
  Check,
  Link2,
  Unlink,
  Filter,
  ScrollText,
  Tag,
  ShieldCheck,
  BookMarked,
  FileText,
  Image,
  GitCompare,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  CornerDownRight,
} from 'lucide-vue-next';
import { useCitationStore } from '@/stores/citationStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useDiffStore } from '@/stores/diffStore';
import type { CitationEntry, CitationType, CitationCredibility } from '@/types';
import { CITATION_TYPE_META, CREDIBILITY_META } from '@/types';
import { formatDate } from '@/utils/exportEngine';

const citationStore = useCitationStore();
const auditStore = useAuditStore();
const projectStore = useProjectStore();
const diffStore = useDiffStore();

const search = ref('');
const filterType = ref<CitationType | ''>('');
const filterCredibility = ref<CitationCredibility | ''>('');
const filterProject = ref('');
const sortBy = ref<'updatedAt' | 'createdAt' | 'credibility' | 'title'>('updatedAt');
const sortOrder = ref<'asc' | 'desc'>('desc');

const showModal = ref(false);
const editingId = ref<string | null>(null);
const showCompareModal = ref(false);
const compareCitationId = ref<string | null>(null);
const quickLinkDiffId = ref<string | null>(null);
const showQuickCreateModal = ref(false);

const form = reactive({
  title: '',
  citationType: 'taboo_literature' as CitationType,
  source: '',
  author: '',
  dynasty: '',
  volume: '',
  page: '',
  content: '',
  credibility: 'secondary' as CitationCredibility,
  tags: '',
  projectId: '',
  linkToDiffEntryId: '',
  linkRelevanceNote: '',
});

const formError = ref('');

const filteredCitations = computed(() => {
  let results = citationStore.searchCitations(search.value, {
    citationType: filterType.value || undefined,
    credibility: filterCredibility.value || undefined,
    projectId: filterProject.value || undefined,
  });

  const credOrder: Record<CitationCredibility, number> = { primary: 0, secondary: 1, tertiary: 2 };

  results = [...results].sort((a, b) => {
    let cmp = 0;
    switch (sortBy.value) {
      case 'createdAt':
        cmp = a.createdAt - b.createdAt;
        break;
      case 'credibility':
        cmp = credOrder[a.credibility] - credOrder[b.credibility];
        break;
      case 'title':
        cmp = a.title.localeCompare(b.title, 'zh-CN');
        break;
      case 'updatedAt':
      default:
        cmp = a.updatedAt - b.updatedAt;
        break;
    }
    return sortOrder.value === 'asc' ? cmp : -cmp;
  });

  return results;
});

const stats = computed(() => citationStore.buildCitationSummary(filterProject.value || undefined));

function openCreate() {
  editingId.value = null;
  form.title = '';
  form.citationType = 'taboo_literature';
  form.source = '';
  form.author = '';
  form.dynasty = '';
  form.volume = '';
  form.page = '';
  form.content = '';
  form.credibility = 'secondary';
  form.tags = '';
  form.projectId = projectStore.currentProjectId || '';
  form.linkToDiffEntryId = '';
  form.linkRelevanceNote = '';
  formError.value = '';
  showModal.value = true;
}

function openCreateAndLink(diffEntryId: string) {
  editingId.value = null;
  form.title = '';
  form.citationType = 'taboo_literature';
  form.source = '';
  form.author = '';
  form.dynasty = '';
  form.volume = '';
  form.page = '';
  form.content = '';
  form.credibility = 'secondary';
  form.tags = '';
  form.projectId = projectStore.currentProjectId || '';
  form.linkToDiffEntryId = diffEntryId;
  form.linkRelevanceNote = '';
  formError.value = '';
  showModal.value = true;
}

function openEdit(c: CitationEntry) {
  editingId.value = c.id;
  form.title = c.title;
  form.citationType = c.citationType;
  form.source = c.source;
  form.author = c.author || '';
  form.dynasty = c.dynasty || '';
  form.volume = c.volume || '';
  form.page = c.page || '';
  form.content = c.content;
  form.credibility = c.credibility;
  form.tags = c.tags.join('、');
  form.projectId = c.projectId || '';
  form.linkToDiffEntryId = '';
  form.linkRelevanceNote = '';
  formError.value = '';
  showModal.value = true;
}

function submitForm() {
  if (!form.title.trim()) {
    formError.value = '典籍名称不能为空';
    return;
  }
  if (!form.source.trim()) {
    formError.value = '来源出处不能为空';
    return;
  }
  if (!form.content.trim()) {
    formError.value = '引文内容不能为空';
    return;
  }

  const tagsArr = form.tags
    .split(/[,，、;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const citationData = {
    title: form.title.trim(),
    citationType: form.citationType,
    source: form.source.trim(),
    author: form.author.trim() || undefined,
    dynasty: form.dynasty.trim() || undefined,
    volume: form.volume.trim() || undefined,
    page: form.page.trim() || undefined,
    content: form.content.trim(),
    credibility: form.credibility,
    tags: tagsArr,
    projectId: form.projectId || undefined,
  };

  if (editingId.value) {
    citationStore.updateCitation(editingId.value, citationData);
    auditStore.addLog({
      actionType: 'citation_update',
      actor: '本地用户',
      projectId: form.projectId || undefined,
      targetId: editingId.value,
      description: `更新典籍依据：${form.title}`,
    });
  } else {
    if (form.linkToDiffEntryId) {
      const result = citationStore.addCitationAndLink(
        citationData,
        form.linkToDiffEntryId,
        form.linkRelevanceNote || undefined,
      );
      auditStore.addLog({
        actionType: 'citation_create',
        actor: '本地用户',
        projectId: form.projectId || undefined,
        targetId: result.citation.id,
        description: `新增典籍依据并关联差异：${form.title}`,
        details: { diffEntryId: form.linkToDiffEntryId },
      });
      if (result.link) {
        auditStore.addLog({
          actionType: 'citation_link',
          actor: '本地用户',
          projectId: form.projectId || undefined,
          targetId: form.linkToDiffEntryId,
          description: '关联典籍依据到差异条目',
          details: { citationId: result.citation.id },
        });
      }
    } else {
      const entry = citationStore.addCitation(citationData);
      auditStore.addLog({
        actionType: 'citation_create',
        actor: '本地用户',
        projectId: form.projectId || undefined,
        targetId: entry.id,
        description: `新增典籍依据：${form.title}`,
      });
    }
  }

  showModal.value = false;
}

function openQuickLinkToDiff(citationId: string) {
  quickLinkDiffId.value = citationId;
  showQuickCreateModal.value = true;
}

function doQuickLink(diffEntryId: string, relevanceNote?: string) {
  if (!quickLinkDiffId.value) return;
  const link = citationStore.linkToDiff(quickLinkDiffId.value, diffEntryId, relevanceNote);
  if (link) {
    auditStore.addLog({
      actionType: 'citation_link',
      actor: '本地用户',
      projectId: projectStore.currentProjectId || undefined,
      targetId: diffEntryId,
      description: '关联典籍依据到差异条目',
      details: { citationId: quickLinkDiffId.value },
    });
  }
  showQuickCreateModal.value = false;
  quickLinkDiffId.value = null;
}

function confirmDelete(c: CitationEntry) {
  if (!confirm(`确定删除典籍依据「${c.title}」？此操作将同时解除其与所有差异条目的关联。`)) return;
  citationStore.deleteCitation(c.id);
  auditStore.addLog({
    actionType: 'citation_delete',
    actor: '本地用户',
    projectId: c.projectId || undefined,
    targetId: c.id,
    description: `删除典籍依据：${c.title}`,
  });
}

function openCompare(citationId: string) {
  compareCitationId.value = citationId;
  showCompareModal.value = true;
}

const compareCitation = computed(() => {
  if (!compareCitationId.value) return null;
  return citationStore.citations.find((c) => c.id === compareCitationId.value) || null;
});

const compareDiffLinks = computed(() => {
  if (!compareCitationId.value) return [];
  return citationStore.getLinksByCitation(compareCitationId.value);
});

const citationTypeOptions: { value: CitationType; label: string }[] = [
  { value: 'taboo_literature', label: '避讳制度文献' },
  { value: 'collation_note', label: '校勘记' },
  { value: 'version_excerpt', label: '历代版本摘录' },
  { value: 'image_page', label: '图像页码' },
];

const credibilityOptions: { value: CitationCredibility; label: string; desc: string }[] = [
  { value: 'primary', label: '一级', desc: '原始典籍、善本原书、出土文献等一手资料' },
  { value: 'secondary', label: '二级', desc: '后人的校勘记、注疏、影印本等间接依据' },
  { value: 'tertiary', label: '三级', desc: '今人研究论文、网络资料等参考性文献' },
];

function getCredibilityShield(cred: CitationCredibility) {
  if (cred === 'primary') return '★★★';
  if (cred === 'secondary') return '★★☆';
  return '★☆☆';
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷五">典籍依据库与引文比证</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          录入避讳制度文献、校勘记、历代版本摘录与图像页码，建立可检索的证据条目，
          <span class="text-vermilion">在差异审核时一键关联典籍依据，提升校勘判断的文献支撑能力与学术规范性。</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="openCreate">
          <Plus class="w-4 h-4" />
          新增典籍依据
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <BookOpen class="w-4 h-4 text-vermilion" />
          证据总数
        </div>
        <div class="font-title text-2xl text-ink">{{ stats.stats.total }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <ShieldCheck class="w-4 h-4 text-vermilion" />
          一级证据
        </div>
        <div class="font-title text-2xl text-vermilion">{{ stats.stats.byCredibility.primary }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <Link2 class="w-4 h-4 text-azure" />
          关联差异条目
        </div>
        <div class="font-title text-2xl text-azure">{{ stats.stats.linkedDiffEntries }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <GitCompare class="w-4 h-4 text-moss" />
          关联链接数
        </div>
        <div class="font-title text-2xl text-moss">{{ stats.links.length }}</div>
      </div>
    </div>

    <div class="card-scroll p-4 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      <div class="flex flex-col sm:flex-row gap-3 flex-1 w-full">
        <div class="relative w-full sm:w-80">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
          <input
            v-model="search"
            placeholder="搜索典籍名称、来源、内容、作者、朝代或标签……"
            class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
          />
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <Filter class="w-4 h-4 text-ink-muted" />
          <select
            v-model="filterType"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部类型</option>
            <option v-for="ct in citationTypeOptions" :key="ct.value" :value="ct.value">{{ ct.label }}</option>
          </select>
          <select
            v-model="filterCredibility"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部可信度</option>
            <option value="primary">一级</option>
            <option value="secondary">二级</option>
            <option value="tertiary">三级</option>
          </select>
          <select
            v-model="filterProject"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部项目</option>
            <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 items-center border-t lg:border-t-0 lg:border-l border-ink/10 pt-2 lg:pt-0 lg:pl-3">
        <ArrowUpDown class="w-4 h-4 text-ink-muted" />
        <select
          v-model="sortBy"
          class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
        >
          <option value="updatedAt">更新时间</option>
          <option value="createdAt">创建时间</option>
          <option value="credibility">可信度</option>
          <option value="title">标题</option>
        </select>
        <button
          class="btn-ghost !p-1.5"
          @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
          :title="sortOrder === 'asc' ? '升序' : '降序'"
        >
          <ChevronUp v-if="sortOrder === 'asc'" class="w-4 h-4" />
          <ChevronDown v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="space-y-4">
      <div
        v-for="c in filteredCitations"
        :key="c.id"
        class="card-scroll p-5 hover:border-vermilion/40 transition-all group"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <BookMarked
                v-if="c.citationType === 'taboo_literature'"
                class="w-5 h-5 text-rattan-dark flex-shrink-0"
              />
              <FileText
                v-else-if="c.citationType === 'collation_note'"
                class="w-5 h-5 text-azure flex-shrink-0"
              />
              <ScrollText
                v-else-if="c.citationType === 'version_excerpt'"
                class="w-5 h-5 text-moss flex-shrink-0"
              />
              <Image
                v-else
                class="w-5 h-5 text-carmine flex-shrink-0"
              />
              <span class="font-title text-lg text-ink truncate">{{ c.title }}</span>
            </div>
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
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
            <button class="btn-ghost !p-1" @click="openQuickLinkToDiff(c.id)" title="快速关联差异">
              <Link2 class="w-4 h-4" />
            </button>
            <button class="btn-ghost !p-1" @click="openCompare(c.id)" title="引文比证">
              <GitCompare class="w-4 h-4" />
            </button>
            <button class="btn-ghost !p-1" @click="openEdit(c)" title="编辑">
              <Pencil class="w-4 h-4" />
            </button>
            <button class="btn-ghost !p-1 hover:!text-carmine" @click="confirmDelete(c)" title="删除">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div class="scroll-divider mb-3" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-serif">
          <div>
            <div class="text-xs text-ink-muted mb-1">来源出处</div>
            <div class="text-ink">{{ c.source }}</div>
          </div>
          <div class="flex flex-wrap gap-4">
            <div v-if="c.author">
              <div class="text-xs text-ink-muted mb-1">作者</div>
              <div class="text-ink">{{ c.author }}</div>
            </div>
            <div v-if="c.dynasty">
              <div class="text-xs text-ink-muted mb-1">朝代</div>
              <div class="text-ink">{{ c.dynasty }}</div>
            </div>
            <div v-if="c.volume">
              <div class="text-xs text-ink-muted mb-1">卷次</div>
              <div class="text-ink">{{ c.volume }}</div>
            </div>
            <div v-if="c.page">
              <div class="text-xs text-ink-muted mb-1">页码</div>
              <div class="text-ink">{{ c.page }}</div>
            </div>
          </div>
        </div>

        <div class="mt-3 rounded-sm border border-ink/10 bg-paper-50/50 p-3">
          <div class="text-xs text-ink-muted mb-1 flex items-center gap-1">
            <BookOpen class="w-3 h-3" />
            引文内容
          </div>
          <div class="text-sm font-serif text-ink leading-7 whitespace-pre-wrap line-clamp-4">{{ c.content }}</div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <div v-if="c.tags.length > 0" class="flex flex-wrap gap-1">
            <Tag class="w-3 h-3 text-ink-pale" />
            <span
              v-for="tag in c.tags"
              :key="tag"
              class="text-[10px] px-1.5 py-0.5 rounded-sm bg-ink/5 border border-ink/10 text-ink-muted"
            >
              {{ tag }}
            </span>
          </div>
          <div class="ml-auto flex items-center gap-3 text-xs text-ink-muted font-serif">
            <span v-if="c.diffEntryIds.length > 0" class="flex items-center gap-1 text-azure">
              <Link2 class="w-3.5 h-3.5" />
              关联 {{ c.diffEntryIds.length }} 条差异
            </span>
            <span class="font-mono text-ink-pale">{{ formatDate(c.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="filteredCitations.length === 0"
        class="card-scroll p-12 text-center"
      >
        <BookOpen class="w-12 h-12 mx-auto text-ink-pale mb-3" />
        <div class="font-serif text-ink-muted">
          {{ search || filterType || filterCredibility || filterProject ? '没有找到匹配的典籍依据' : '还没有典籍依据，点击「新增典籍依据」开始录入文献证据' }}
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showModal = false"
      >
        <div class="card-scroll w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingId ? '编辑典籍依据' : '新增典籍依据' }}
            </h3>
            <button class="btn-ghost" @click="showModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">典籍名称 <span class="text-carmine">*</span></label>
              <input
                v-model="form.title"
                placeholder="如：《史记·高祖本纪》避讳改字考"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">典籍类型 <span class="text-carmine">*</span></label>
                <select
                  v-model="form.citationType"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="ct in citationTypeOptions" :key="ct.value" :value="ct.value">{{ ct.label }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">可信度分级 <span class="text-carmine">*</span></label>
                <select
                  v-model="form.credibility"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="cr in credibilityOptions" :key="cr.value" :value="cr.value">{{ cr.label }} — {{ cr.desc }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">来源出处 <span class="text-carmine">*</span></label>
              <input
                v-model="form.source"
                placeholder="如：中华书局1982年版、四库全书本、敦煌P.2536号写本"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">作者</label>
                <input
                  v-model="form.author"
                  placeholder="如：司马贞"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">朝代</label>
                <input
                  v-model="form.dynasty"
                  placeholder="如：唐代"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">卷次</label>
                <input
                  v-model="form.volume"
                  placeholder="如：卷三"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">页码</label>
                <input
                  v-model="form.page"
                  placeholder="如：第126页、P.5v"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">引文内容 <span class="text-carmine">*</span></label>
              <textarea
                v-model="form.content"
                rows="5"
                placeholder="录入典籍原文或校勘记内容，支持多行……"
                class="text-area-paper text-sm"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">标签</label>
              <input
                v-model="form.tags"
                placeholder="用逗号或顿号分隔，如：唐讳、世民改字、贞观"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">所属项目</label>
              <select
                v-model="form.projectId"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              >
                <option value="">不限项目（全局可用）</option>
                <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>

            <div v-if="!editingId && diffStore.entries.length > 0" class="rounded-sm border border-rattan/30 bg-rattan/10 p-4">
              <div class="font-serif text-sm text-ink mb-3 flex items-center gap-2">
                <Link2 class="w-4 h-4 text-vermilion" />
                立即关联到差异条目（可选）
              </div>
              <div class="space-y-3">
                <div>
                  <label class="block font-serif text-xs text-ink-soft mb-1">选择差异条目</label>
                  <select
                    v-model="form.linkToDiffEntryId"
                    class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-xs focus:border-vermilion focus:outline-none"
                  >
                    <option value="">暂不关联</option>
                    <option v-for="d in diffStore.entries.slice(0, 50)" :key="d.id" :value="d.id">
                      {{ String(diffStore.entries.findIndex((x) => x.id === d.id) + 1).padStart(2, '0') }} · {{ d.originalText || '（空）' }} → {{ d.revisedText || '（空）' }}
                    </option>
                  </select>
                </div>
                <div v-if="form.linkToDiffEntryId">
                  <label class="block font-serif text-xs text-ink-soft mb-1">相关性说明（可选）</label>
                  <textarea
                    v-model="form.linkRelevanceNote"
                    rows="2"
                    placeholder="说明此典籍依据与该差异条目的关联，如：此处避讳改字与该文献记载一致……"
                    class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-xs focus:border-vermilion focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="formError"
            class="mt-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine"
          >
            {{ formError }}
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showModal = false">取消</button>
            <button class="btn-primary" @click="submitForm">
              <Check class="w-4 h-4" />
              {{ editingId ? '保存修改' : (form.linkToDiffEntryId ? '创建并关联' : '创建典籍依据') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showCompareModal && compareCitation"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showCompareModal = false"
      >
        <div class="card-scroll w-full max-w-3xl p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-title text-xl text-ink">引文比证</h3>
              <p class="text-sm text-ink-muted font-serif mt-1">{{ compareCitation.title }}</p>
            </div>
            <button class="btn-ghost" @click="showCompareModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="rounded-sm border border-ink/10 bg-paper-50 p-4 mb-4">
            <div class="grid grid-cols-2 gap-3 text-sm font-serif mb-3">
              <div>
                <div class="text-xs text-ink-muted mb-1">来源出处</div>
                <div class="text-ink">{{ compareCitation.source }}</div>
              </div>
              <div>
                <div class="text-xs text-ink-muted mb-1">可信度</div>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                  :class="CREDIBILITY_META[compareCitation.credibility].cls"
                >
                  {{ getCredibilityShield(compareCitation.credibility) }} {{ CREDIBILITY_META[compareCitation.credibility].label }}
                </span>
              </div>
            </div>
            <div class="text-xs text-ink-muted mb-1 flex items-center gap-1">
              <BookOpen class="w-3 h-3" />
              引文原文
            </div>
            <div class="text-sm font-serif text-ink leading-8 bg-paper-100/60 border border-ink/5 rounded-sm p-3 whitespace-pre-wrap">
              {{ compareCitation.content }}
            </div>
            <div v-if="compareCitation.tags.length > 0" class="mt-3 flex flex-wrap gap-1">
              <Tag class="w-3 h-3 text-ink-pale" />
              <span
                v-for="tag in compareCitation.tags"
                :key="tag"
                class="text-[10px] px-1.5 py-0.5 rounded-sm bg-ink/5 border border-ink/10 text-ink-muted"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="mb-2 font-serif text-sm text-ink-soft flex items-center gap-2">
            <Link2 class="w-4 h-4 text-azure" />
            关联的差异条目 · {{ compareDiffLinks.length }} 条
          </div>

          <div v-if="compareDiffLinks.length > 0" class="space-y-3">
            <div
              v-for="link in compareDiffLinks"
              :key="link.id"
              class="rounded-sm border border-ink/15 bg-paper-50 p-3"
            >
              <template v-if="diffStore.entries.find((d) => d.id === link.diffEntryId)">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-sm font-serif text-ink">
                    差异条目：{{ diffStore.entries.find((d) => d.id === link.diffEntryId)?.originalText || '（空）' }}
                    →
                    {{ diffStore.entries.find((d) => d.id === link.diffEntryId)?.revisedText || '（空）' }}
                  </div>
                  <span class="text-[10px] text-ink-pale font-mono">{{ formatDate(link.linkedAt) }}</span>
                </div>
                <div v-if="link.relevanceNote" class="text-xs font-serif text-ink-soft mt-1 pl-3 border-l-2 border-vermilion/30">
                  相关性说明：{{ link.relevanceNote }}
                </div>
              </template>
              <template v-else>
                <div class="text-sm font-serif text-ink-muted">
                  差异条目 {{ link.diffEntryId }} （当前扫描中不存在）
                </div>
              </template>
            </div>
          </div>
          <div v-else class="text-center py-6 text-ink-muted font-serif text-sm">
            此典籍依据尚未关联任何差异条目。可在差异审核页面中一键关联。
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showQuickCreateModal && quickLinkDiffId"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showQuickCreateModal = false"
      >
        <div class="card-scroll w-full max-w-md p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">快速关联差异条目</h3>
            <button class="btn-ghost" @click="showQuickCreateModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />
          <div class="mb-3 text-xs text-ink-muted font-serif">
            将此典籍依据关联到当前扫描的差异条目
          </div>
          <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="d in diffStore.entries"
              :key="d.id"
              class="rounded-sm border p-3 bg-paper-50 hover:border-vermilion/40 cursor-pointer transition-all"
              @click="doQuickLink(d.id)"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-mono text-xs text-ink-pale">
                  {{ String(diffStore.entries.findIndex((x) => x.id === d.id) + 1).padStart(2, '0') }}
                </span>
                <span
                  v-if="citationStore.getCitationsByDiffEntry(d.id).some((c) => c.id === quickLinkDiffId)"
                  class="text-[10px] text-moss flex items-center gap-1"
                >
                  <Check class="w-3 h-3" />
                  已关联
                </span>
              </div>
              <div class="text-sm font-serif text-ink">
                <span class="hl-raw">{{ d.originalText || '（空）' }}</span>
                <span class="mx-1 text-ink-muted">→</span>
                <span class="hl-new">{{ d.revisedText || '（空）' }}</span>
              </div>
              <div class="mt-1 text-[10px] text-ink-pale font-mono">
                位置 [{{ d.startInOriginal + 1 }}-{{ d.endInOriginal }}]
              </div>
            </div>
            <div v-if="diffStore.entries.length === 0" class="text-center py-4 text-ink-muted font-serif text-sm">
              当前没有差异条目，请先进行文本扫描
            </div>
          </div>
          <div class="scroll-divider my-4" />
          <div class="flex justify-end">
            <button class="btn-secondary" @click="showQuickCreateModal = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
