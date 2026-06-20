<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  X,
  Check,
  Filter,
  Tag,
  ShieldCheck,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Image,
  Upload,
  GitBranch,
  Link2,
  Unlink,
  Star,
  ListTree,
  Layers,
  History,
  Type,
  Palette,
  BookMarked,
} from 'lucide-vue-next';
import { useGlyphStore } from '@/stores/glyphStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useDiffStore } from '@/stores/diffStore';
import type {
  GlyphEntry,
  GlyphVariant,
  GlyphSourceType,
  GlyphVariantType,
  GlyphComponent,
  GlyphEvolutionStep,
} from '@/types';
import {
  GLYPH_SOURCE_TYPE_META,
  GLYPH_VARIANT_TYPE_META,
  DYNASTY_OPTIONS,
  CREDIBILITY_META,
} from '@/types';
import { formatDate } from '@/utils/exportEngine';

const glyphStore = useGlyphStore();
const auditStore = useAuditStore();
const projectStore = useProjectStore();
const diffStore = useDiffStore();

const search = ref('');
const filterDynasty = ref('');
const filterSourceType = ref<GlyphSourceType | ''>('');
const filterVariantType = ref<GlyphVariantType | ''>('');
const filterProject = ref('');
const sortBy = ref<'updatedAt' | 'createdAt' | 'headChar'>('updatedAt');
const sortOrder = ref<'asc' | 'desc'>('desc');

const showGlyphModal = ref(false);
const editingGlyphId = ref<string | null>(null);
const showVariantModal = ref(false);
const editingVariantId = ref<string | null>(null);
const showEvolutionModal = ref(false);
const editingStepId = ref<string | null>(null);
const showLinkModal = ref(false);
const linkingGlyphId = ref<string | null>(null);
const selectedGlyphDetail = ref<GlyphEntry | null>(null);

const glyphForm = reactive({
  headChar: '',
  pinyin: '',
  radical: '',
  strokeCount: '',
  definition: '',
  category: '',
  researchNotes: '',
  tags: '',
  projectId: '',
});

const variantForm = reactive({
  variantChar: '',
  variantType: 'structural' as GlyphVariantType,
  dynasty: '',
  era: '',
  sourceType: 'manuscript' as GlyphSourceType,
  sourceTitle: '',
  sourceDetail: '',
  pageRef: '',
  imageData: '',
  imageName: '',
  missingStrokes: '',
  addedStrokes: '',
  strokeCount: '',
  useContext: '',
  usageNotes: '',
  isHeadVariant: false,
  credibility: 'secondary' as 'primary' | 'secondary' | 'tertiary',
  tags: '',
});

const evolutionForm = reactive({
  fromVariantId: '',
  toVariantId: '',
  changeType: 'simplification' as GlyphEvolutionStep['changeType'],
  dynasty: '',
  evidence: '',
  confidence: 0.7,
  order: 0,
});

const linkForm = reactive({
  diffEntryId: '',
  variantId: '',
  relevanceNote: '',
});

const formError = ref('');
const toast = ref('');

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

onMounted(() => {
  if (!glyphStore.initialized) {
    glyphStore.load();
  }
});

const sortedGlyphs = computed(() => {
  let results = glyphStore.searchGlyphs(search.value, {
    dynasty: filterDynasty.value || undefined,
    sourceType: filterSourceType.value || undefined,
    variantType: filterVariantType.value || undefined,
    projectId: filterProject.value || undefined,
  });

  results = [...results].sort((a, b) => {
    let cmp = 0;
    switch (sortBy.value) {
      case 'headChar':
        cmp = a.headChar.localeCompare(b.headChar, 'zh-CN');
        break;
      case 'createdAt':
        cmp = a.createdAt - b.createdAt;
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

const stats = computed(() => ({
  total: glyphStore.totalCount,
  totalVariants: glyphStore.totalVariants,
  avgVariants: glyphStore.totalCount > 0
    ? (glyphStore.totalVariants / glyphStore.totalCount).toFixed(1)
    : '0',
  withEvolution: glyphStore.glyphEntries.filter((g) => g.evolutionChain.length > 0).length,
}));

const sourceTypeOptions: { value: GlyphSourceType; label: string }[] = [
  { value: 'manuscript', label: '写本' },
  { value: 'engraved', label: '刻本' },
  { value: 'rubbing', label: '拓本' },
  { value: 'seal', label: '玺印' },
  { value: 'bronze', label: '金文' },
  { value: 'bamboo', label: '简牍' },
  { value: 'silk', label: '帛书' },
  { value: 'other', label: '其他' },
];

const variantTypeOptions: { value: GlyphVariantType; label: string; desc: string }[] = [
  { value: 'structural', label: '结构差异', desc: '整体字形结构不同' },
  { value: 'component', label: '构件差异', desc: '偏旁构件不同' },
  { value: 'stroke_missing', label: '缺笔', desc: '笔画减少或缺笔' },
  { value: 'stroke_added', label: '增笔', desc: '笔画增加' },
  { value: 'stroke_variant', label: '笔形变异', desc: '笔画形态不同' },
  { value: 'simplified', label: '简体', desc: '简化字形' },
  { value: 'traditional', label: '繁体', desc: '繁化字形' },
  { value: 'vulgar', label: '俗字', desc: '民间俗写字形' },
  { value: 'phonetic_loan', label: '假借', desc: '音近假借字' },
  { value: 'interchangeable', label: '通用', desc: '可通用的异体' },
];

const changeTypeOptions: { value: GlyphEvolutionStep['changeType']; label: string }[] = [
  { value: 'simplification', label: '简化' },
  { value: 'complication', label: '繁化' },
  { value: 'component_substitution', label: '构件替换' },
  { value: 'stroke_change', label: '笔画变化' },
  { value: 'structural_rearrangement', label: '结构重构' },
  { value: 'taboo_modification', label: '避讳改字' },
];

const credibilityOptions = [
  { value: 'primary' as const, label: '一级', desc: '原始典籍、善本原书、出土文献等一手资料' },
  { value: 'secondary' as const, label: '二级', desc: '后人的校勘记、注疏、影印本等间接依据' },
  { value: 'tertiary' as const, label: '三级', desc: '今人研究论文、网络资料等参考性文献' },
];

function openCreateGlyph() {
  editingGlyphId.value = null;
  glyphForm.headChar = '';
  glyphForm.pinyin = '';
  glyphForm.radical = '';
  glyphForm.strokeCount = '';
  glyphForm.definition = '';
  glyphForm.category = '';
  glyphForm.researchNotes = '';
  glyphForm.tags = '';
  glyphForm.projectId = projectStore.currentProjectId || '';
  formError.value = '';
  showGlyphModal.value = true;
}

function openEditGlyph(g: GlyphEntry) {
  editingGlyphId.value = g.id;
  glyphForm.headChar = g.headChar;
  glyphForm.pinyin = g.pinyin || '';
  glyphForm.radical = g.radical || '';
  glyphForm.strokeCount = g.strokeCount?.toString() || '';
  glyphForm.definition = g.definition || '';
  glyphForm.category = g.category || '';
  glyphForm.researchNotes = g.researchNotes || '';
  glyphForm.tags = g.tags.join('、');
  glyphForm.projectId = g.projectId || '';
  formError.value = '';
  showGlyphModal.value = true;
}

function submitGlyphForm() {
  if (!glyphForm.headChar.trim()) {
    formError.value = '字头不能为空';
    return;
  }

  const tagsArr = glyphForm.tags
    .split(/[,，、;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const data = {
    headChar: glyphForm.headChar.trim(),
    pinyin: glyphForm.pinyin.trim() || undefined,
    radical: glyphForm.radical.trim() || undefined,
    strokeCount: glyphForm.strokeCount ? parseInt(glyphForm.strokeCount) : undefined,
    definition: glyphForm.definition.trim() || undefined,
    category: glyphForm.category.trim() || undefined,
    researchNotes: glyphForm.researchNotes.trim() || undefined,
    tags: tagsArr,
    projectId: glyphForm.projectId || undefined,
  };

  if (editingGlyphId.value) {
    glyphStore.updateGlyphEntry(editingGlyphId.value, data);
    auditStore.addLog({
      actionType: 'glyph_update',
      actor: '本地用户',
      projectId: glyphForm.projectId || undefined,
      targetId: editingGlyphId.value,
      description: `更新字形条目：${glyphForm.headChar}`,
    });
  } else {
    const entry = glyphStore.addGlyphEntry(data);
    auditStore.addLog({
      actionType: 'glyph_create',
      actor: '本地用户',
      projectId: glyphForm.projectId || undefined,
      targetId: entry.id,
      description: `新增字形条目：${glyphForm.headChar}`,
    });
  }

  showGlyphModal.value = false;
}

function confirmDeleteGlyph(g: GlyphEntry) {
  if (!confirm(`确定删除字形条目「${g.headChar}」？此操作将同时删除其所有异体字形和演化链。`)) return;
  glyphStore.deleteGlyphEntry(g.id);
  auditStore.addLog({
    actionType: 'glyph_delete',
    actor: '本地用户',
    projectId: g.projectId,
    targetId: g.id,
    description: `删除字形条目：${g.headChar}`,
  });
}

const imageFileInput = ref<HTMLInputElement | null>(null);

function handleImageUpload(event: Event) {
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
    variantForm.imageData = e.target?.result as string;
    variantForm.imageName = file.name;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  variantForm.imageData = '';
  variantForm.imageName = '';
  if (imageFileInput.value) {
    imageFileInput.value.value = '';
  }
}

function openCreateVariant(glyphId: string) {
  editingVariantId.value = null;
  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  variantForm.variantChar = '';
  variantForm.variantType = 'structural';
  variantForm.dynasty = '';
  variantForm.era = '';
  variantForm.sourceType = 'manuscript';
  variantForm.sourceTitle = '';
  variantForm.sourceDetail = '';
  variantForm.pageRef = '';
  variantForm.imageData = '';
  variantForm.imageName = '';
  variantForm.missingStrokes = '';
  variantForm.addedStrokes = '';
  variantForm.strokeCount = '';
  variantForm.useContext = '';
  variantForm.usageNotes = '';
  variantForm.isHeadVariant = false;
  variantForm.credibility = 'secondary';
  variantForm.tags = '';
  formError.value = '';
  showVariantModal.value = true;
}

function openEditVariant(glyphId: string, variant: GlyphVariant) {
  editingVariantId.value = variant.id;
  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  variantForm.variantChar = variant.variantChar;
  variantForm.variantType = variant.variantType;
  variantForm.dynasty = variant.dynasty || '';
  variantForm.era = variant.era || '';
  variantForm.sourceType = variant.sourceType;
  variantForm.sourceTitle = variant.sourceTitle;
  variantForm.sourceDetail = variant.sourceDetail || '';
  variantForm.pageRef = variant.pageRef || '';
  variantForm.imageData = variant.imageData || '';
  variantForm.imageName = variant.imageName || '';
  variantForm.missingStrokes = variant.missingStrokes?.join('、') || '';
  variantForm.addedStrokes = variant.addedStrokes?.join('、') || '';
  variantForm.strokeCount = variant.strokeCount?.toString() || '';
  variantForm.useContext = variant.useContext || '';
  variantForm.usageNotes = variant.usageNotes || '';
  variantForm.isHeadVariant = variant.isHeadVariant || false;
  variantForm.credibility = variant.credibility;
  variantForm.tags = variant.tags.join('、');
  formError.value = '';
  showVariantModal.value = true;
}

function submitVariantForm() {
  if (!selectedGlyphDetail.value) return;
  if (!variantForm.variantChar.trim()) {
    formError.value = '异体字形不能为空';
    return;
  }
  if (!variantForm.sourceTitle.trim()) {
    formError.value = '出处名称不能为空';
    return;
  }

  const tagsArr = variantForm.tags
    .split(/[,，、;\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const missingStrokesArr = variantForm.missingStrokes
    ? variantForm.missingStrokes.split(/[,，、;\s]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  const addedStrokesArr = variantForm.addedStrokes
    ? variantForm.addedStrokes.split(/[,，、;\s]+/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  const data = {
    variantChar: variantForm.variantChar.trim(),
    variantType: variantForm.variantType,
    dynasty: variantForm.dynasty || undefined,
    era: variantForm.era.trim() || undefined,
    sourceType: variantForm.sourceType,
    sourceTitle: variantForm.sourceTitle.trim(),
    sourceDetail: variantForm.sourceDetail.trim() || undefined,
    pageRef: variantForm.pageRef.trim() || undefined,
    imageData: variantForm.imageData || undefined,
    imageName: variantForm.imageName || undefined,
    components: [] as GlyphComponent[],
    missingStrokes: missingStrokesArr,
    addedStrokes: addedStrokesArr,
    strokeCount: variantForm.strokeCount ? parseInt(variantForm.strokeCount) : undefined,
    useContext: variantForm.useContext.trim() || undefined,
    usageNotes: variantForm.usageNotes.trim() || undefined,
    isHeadVariant: variantForm.isHeadVariant,
    credibility: variantForm.credibility,
    tags: tagsArr,
  };

  const glyphId = selectedGlyphDetail.value.id;

  if (editingVariantId.value) {
    glyphStore.updateGlyphVariant(glyphId, editingVariantId.value, data);
    auditStore.addLog({
      actionType: 'glyph_variant_update',
      actor: '本地用户',
      projectId: selectedGlyphDetail.value.projectId,
      targetId: editingVariantId.value,
      description: `更新异体字形：${variantForm.variantChar}`,
    });
  } else {
    glyphStore.addGlyphVariant(glyphId, data);
    auditStore.addLog({
      actionType: 'glyph_variant_add',
      actor: '本地用户',
      projectId: selectedGlyphDetail.value.projectId,
      targetId: glyphId,
      description: `新增异体字形：${variantForm.variantChar}（${glyphForm.headChar}）`,
    });
  }

  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  showVariantModal.value = false;
}

function confirmDeleteVariant(glyphId: string, variant: GlyphVariant) {
  if (!confirm(`确定删除异体字形「${variant.variantChar}」？`)) return;
  glyphStore.deleteGlyphVariant(glyphId, variant.id);
  auditStore.addLog({
    actionType: 'glyph_variant_delete',
    actor: '本地用户',
    targetId: variant.id,
    description: `删除异体字形：${variant.variantChar}`,
  });
  if (selectedGlyphDetail.value?.id === glyphId) {
    selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  }
}

function openCreateEvolution(glyphId: string) {
  editingStepId.value = null;
  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  evolutionForm.fromVariantId = '';
  evolutionForm.toVariantId = '';
  evolutionForm.changeType = 'simplification';
  evolutionForm.dynasty = '';
  evolutionForm.evidence = '';
  evolutionForm.confidence = 0.7;
  evolutionForm.order = selectedGlyphDetail.value?.evolutionChain.length || 0;
  formError.value = '';
  showEvolutionModal.value = true;
}

function openEditEvolution(glyphId: string, step: GlyphEvolutionStep) {
  editingStepId.value = step.id;
  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  evolutionForm.fromVariantId = step.fromVariantId || '';
  evolutionForm.toVariantId = step.toVariantId || '';
  evolutionForm.changeType = step.changeType;
  evolutionForm.dynasty = step.dynasty || '';
  evolutionForm.evidence = step.evidence || '';
  evolutionForm.confidence = step.confidence;
  evolutionForm.order = step.order;
  formError.value = '';
  showEvolutionModal.value = true;
}

function submitEvolutionForm() {
  if (!selectedGlyphDetail.value) return;

  const glyphId = selectedGlyphDetail.value.id;
  const data = {
    fromVariantId: evolutionForm.fromVariantId || null,
    toVariantId: evolutionForm.toVariantId || null,
    changeType: evolutionForm.changeType,
    dynasty: evolutionForm.dynasty || undefined,
    evidence: evolutionForm.evidence || undefined,
    confidence: evolutionForm.confidence,
    order: evolutionForm.order,
  };

  if (editingStepId.value) {
    glyphStore.updateEvolutionStep(glyphId, editingStepId.value, data);
    auditStore.addLog({
      actionType: 'glyph_evolution_update',
      actor: '本地用户',
      targetId: editingStepId.value,
      description: '更新字形演化步骤',
    });
  } else {
    glyphStore.addEvolutionStep(glyphId, data);
    auditStore.addLog({
      actionType: 'glyph_evolution_create',
      actor: '本地用户',
      targetId: glyphId,
      description: '建立字形演化步骤',
    });
  }

  selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  showEvolutionModal.value = false;
}

function confirmDeleteEvolution(glyphId: string, stepId: string) {
  if (!confirm('确定删除此演化步骤？')) return;
  glyphStore.deleteEvolutionStep(glyphId, stepId);
  if (selectedGlyphDetail.value?.id === glyphId) {
    selectedGlyphDetail.value = glyphStore.getGlyphById(glyphId) || null;
  }
}

function openLinkToDiff(glyphId: string) {
  linkingGlyphId.value = glyphId;
  linkForm.diffEntryId = '';
  linkForm.variantId = '';
  linkForm.relevanceNote = '';
  showLinkModal.value = true;
}

function doLinkToDiff() {
  if (!linkingGlyphId.value || !linkForm.diffEntryId) return;

  const link = glyphStore.linkToDiff(
    linkingGlyphId.value,
    linkForm.diffEntryId,
    linkForm.variantId || undefined,
    linkForm.relevanceNote || undefined
  );

  if (link) {
    auditStore.addLog({
      actionType: 'glyph_link',
      actor: '本地用户',
      targetId: linkForm.diffEntryId,
      description: '关联字形证据到差异条目',
    });
    flashToast('已成功关联到差异条目');
  } else {
    flashToast('该差异条目已关联此字形，无需重复关联');
  }

  showLinkModal.value = false;
  linkingGlyphId.value = null;
}

function viewGlyphDetail(g: GlyphEntry) {
  selectedGlyphDetail.value = g;
}

function closeDetail() {
  selectedGlyphDetail.value = null;
}

function getCredibilityShield(cred: 'primary' | 'secondary' | 'tertiary') {
  if (cred === 'primary') return '★★★';
  if (cred === 'secondary') return '★★☆';
  return '★☆☆';
}

const changeTypeLabels: Record<GlyphEvolutionStep['changeType'], string> = {
  simplification: '简化',
  complication: '繁化',
  component_substitution: '构件替换',
  stroke_change: '笔画变化',
  structural_rearrangement: '结构重构',
  taboo_modification: '避讳改字',
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
        <h2 class="juan-title" data-juan="卷十">字形谱系与异体演化</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          录入同一字在不同朝代、写本、刻本中的异体字形、构件差异、缺笔样式与使用场景，建立可检索的字形谱系库；
          <span class="text-vermilion">在差异审核时自动提示相关字形演化链、同类异体分布和历史用例，为校勘判断提供字形学证据支撑。</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="openCreateGlyph">
          <Plus class="w-4 h-4" />
          新增字形条目
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <Type class="w-4 h-4 text-vermilion" />
          字形总数
        </div>
        <div class="font-title text-2xl text-ink">{{ stats.total }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <Layers class="w-4 h-4 text-azure" />
          异体字形
        </div>
        <div class="font-title text-2xl text-azure">{{ stats.totalVariants }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <GitBranch class="w-4 h-4 text-moss" />
          平均异体数
        </div>
        <div class="font-title text-2xl text-moss">{{ stats.avgVariants }}</div>
      </div>
      <div class="card-scroll p-4">
        <div class="flex items-center gap-2 text-ink-muted text-xs font-serif mb-2">
          <ListTree class="w-4 h-4 text-rattan-dark" />
          有演化链
        </div>
        <div class="font-title text-2xl text-rattan-dark">{{ stats.withEvolution }}</div>
      </div>
    </div>

    <div class="card-scroll p-4 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      <div class="flex flex-col sm:flex-row gap-3 flex-1 w-full">
        <div class="relative w-full sm:w-80">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
          <input
            v-model="search"
            placeholder="搜索字头、异体字、拼音、释义、出处或标签……"
            class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
          />
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <Filter class="w-4 h-4 text-ink-muted" />
          <select
            v-model="filterDynasty"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部朝代</option>
            <option v-for="d in DYNASTY_OPTIONS" :key="d" :value="d">{{ d }}</option>
          </select>
          <select
            v-model="filterSourceType"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部载体</option>
            <option v-for="s in sourceTypeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <select
            v-model="filterVariantType"
            class="rounded-md border border-ink/20 bg-paper-50 px-2 py-1.5 font-serif text-xs focus:border-vermilion focus:outline-none"
          >
            <option value="">全部类型</option>
            <option v-for="v in variantTypeOptions" :key="v.value" :value="v.value">{{ v.label }}</option>
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
          <option value="headChar">字头</option>
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

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        <div
          v-for="g in sortedGlyphs"
          :key="g.id"
          class="card-scroll p-4 cursor-pointer hover:border-vermilion/40 transition-all"
          :class="{ 'border-vermilion/60 bg-vermilion/5': selectedGlyphDetail?.id === g.id }"
          @click="viewGlyphDetail(g)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-sm border border-ink/15 bg-paper-50 flex items-center justify-center text-2xl font-serif text-ink">
                {{ g.headChar }}
              </div>
              <div>
                <div class="font-title text-lg text-ink">{{ g.headChar }}</div>
                <div v-if="g.pinyin" class="text-xs text-ink-muted font-serif">{{ g.pinyin }}</div>
              </div>
            </div>
            <div class="flex gap-1">
              <button
                class="btn-ghost !p-1"
                @click.stop="openLinkToDiff(g.id)"
                title="关联到差异"
              >
                <Link2 class="w-3.5 h-3.5" />
              </button>
              <button
                class="btn-ghost !p-1"
                @click.stop="openEditGlyph(g)"
                title="编辑"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button
                class="btn-ghost !p-1 hover:!text-carmine"
                @click.stop="confirmDeleteGlyph(g)"
                title="删除"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div v-if="g.definition" class="mt-2 text-xs text-ink-muted font-serif line-clamp-2">
            {{ g.definition }}
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5 items-center">
            <span
              v-for="v in g.variants.slice(0, 4)"
              :key="v.id"
              class="text-sm px-2 py-0.5 rounded-sm border bg-paper-50"
              :class="GLYPH_VARIANT_TYPE_META[v.variantType].cls"
            >
              {{ v.variantChar }}
            </span>
            <span v-if="g.variants.length > 4" class="text-xs text-ink-muted">
              +{{ g.variants.length - 4 }}
            </span>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-ink-muted font-mono">
            <span>{{ g.variants.length }} 异体</span>
            <span>{{ formatDate(g.updatedAt) }}</span>
          </div>
        </div>

        <div
          v-if="sortedGlyphs.length === 0"
          class="card-scroll p-12 text-center"
        >
          <Type class="w-12 h-12 mx-auto text-ink-pale mb-3" />
          <div class="font-serif text-ink-muted">
            {{ search || filterDynasty || filterSourceType || filterVariantType ? '没有找到匹配的字形' : '还没有字形条目，点击「新增字形条目」开始录入字形谱系' }}
          </div>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div v-if="selectedGlyphDetail" class="space-y-4">
          <div class="card-scroll p-5">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-4">
                <div class="w-20 h-20 rounded-sm border-2 border-vermilion/30 bg-paper-50 flex items-center justify-center text-5xl font-serif text-vermilion">
                  {{ selectedGlyphDetail.headChar }}
                </div>
                <div>
                  <h3 class="font-title text-2xl text-ink">{{ selectedGlyphDetail.headChar }}</h3>
                  <div v-if="selectedGlyphDetail.pinyin" class="text-sm text-ink-muted font-serif mt-1">
                    拼音：{{ selectedGlyphDetail.pinyin }}
                  </div>
                  <div class="flex gap-4 mt-2 text-xs text-ink-muted font-serif">
                    <span v-if="selectedGlyphDetail.radical">部首：{{ selectedGlyphDetail.radical }}</span>
                    <span v-if="selectedGlyphDetail.strokeCount">笔画：{{ selectedGlyphDetail.strokeCount }} 画</span>
                  </div>
                </div>
              </div>
              <button class="btn-ghost" @click="closeDetail">
                <X class="w-4 h-4" />
              </button>
            </div>
            <div v-if="selectedGlyphDetail.definition" class="mt-3 rounded-sm border border-ink/10 bg-paper-50/50 p-3">
              <div class="text-xs text-ink-muted mb-1 font-serif">释义</div>
              <div class="text-sm font-serif text-ink leading-7">{{ selectedGlyphDetail.definition }}</div>
            </div>
            <div v-if="selectedGlyphDetail.researchNotes" class="mt-3 rounded-sm border border-rattan/20 bg-rattan/5 p-3">
              <div class="text-xs text-rattan-dark mb-1 font-serif flex items-center gap-1">
                <BookMarked class="w-3 h-3" />
                研究备注
              </div>
              <div class="text-sm font-serif text-ink leading-7">{{ selectedGlyphDetail.researchNotes }}</div>
            </div>
            <div v-if="selectedGlyphDetail.tags.length > 0" class="mt-3 flex flex-wrap gap-1.5">
              <Tag class="w-3 h-3 text-ink-pale" />
              <span
                v-for="tag in selectedGlyphDetail.tags"
                :key="tag"
                class="text-[10px] px-1.5 py-0.5 rounded-sm bg-ink/5 border border-ink/10 text-ink-muted"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="card-scroll p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <Layers class="w-5 h-5 text-azure" />
                <h4 class="font-title text-lg text-ink">异体字形</h4>
                <span class="text-xs text-ink-muted font-mono">{{ selectedGlyphDetail.variants.length }} 个</span>
              </div>
              <button class="btn-secondary !py-1 !px-3 text-xs" @click="openCreateVariant(selectedGlyphDetail.id)">
                <Plus class="w-3.5 h-3.5" />
                新增异体
              </button>
            </div>
            <div class="scroll-divider mb-4" />

            <div v-if="selectedGlyphDetail.variants.length === 0" class="text-center py-8 text-ink-muted font-serif text-sm">
              还没有异体字形，点击「新增异体」开始录入。
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="variant in selectedGlyphDetail.variants"
                :key="variant.id"
                class="rounded-sm border border-ink/15 bg-paper-50 p-4 hover:border-azure/40 transition-all"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-sm border border-ink/15 bg-paper-100 flex items-center justify-center text-2xl font-serif text-ink">
                      {{ variant.variantChar }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-serif text-base text-ink">{{ variant.variantChar }}</span>
                        <Star
                          v-if="variant.isHeadVariant"
                          class="w-3.5 h-3.5 text-amber fill-amber"
                        />
                      </div>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                        :class="GLYPH_VARIANT_TYPE_META[variant.variantType].cls"
                      >
                        {{ GLYPH_VARIANT_TYPE_META[variant.variantType].label }}
                      </span>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <button
                      class="btn-ghost !p-1"
                      @click="openEditVariant(selectedGlyphDetail.id, variant)"
                      title="编辑"
                    >
                      <Pencil class="w-3 h-3" />
                    </button>
                    <button
                      class="btn-ghost !p-1 hover:!text-carmine"
                      @click="confirmDeleteVariant(selectedGlyphDetail.id, variant)"
                      title="删除"
                    >
                      <Trash2 class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div class="space-y-2 text-xs font-serif">
                  <div class="flex gap-3">
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                      :class="GLYPH_SOURCE_TYPE_META[variant.sourceType].cls"
                    >
                      {{ GLYPH_SOURCE_TYPE_META[variant.sourceType].label }}
                    </span>
                    <span
                      class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                      :class="CREDIBILITY_META[variant.credibility].cls"
                    >
                      {{ getCredibilityShield(variant.credibility) }} {{ CREDIBILITY_META[variant.credibility].label }}
                    </span>
                  </div>

                  <div class="text-ink-soft">
                    <span class="text-ink-muted">出处：</span>
                    {{ variant.sourceTitle }}
                    <span v-if="variant.sourceDetail">（{{ variant.sourceDetail }}）</span>
                  </div>

                  <div class="flex flex-wrap gap-3 text-ink-soft">
                    <span v-if="variant.dynasty">朝代：{{ variant.dynasty }}</span>
                    <span v-if="variant.era">年代：{{ variant.era }}</span>
                    <span v-if="variant.pageRef">页码：{{ variant.pageRef }}</span>
                  </div>

                  <div v-if="variant.missingStrokes && variant.missingStrokes.length > 0" class="text-carmine">
                    缺笔：{{ variant.missingStrokes.join('、') }}
                  </div>
                  <div v-if="variant.addedStrokes && variant.addedStrokes.length > 0" class="text-azure">
                    增笔：{{ variant.addedStrokes.join('、') }}
                  </div>

                  <div v-if="variant.useContext" class="text-ink-soft">
                    <span class="text-ink-muted">使用场景：</span>{{ variant.useContext }}
                  </div>

                  <div v-if="variant.usageNotes" class="text-ink-soft">
                    <span class="text-ink-muted">说明：</span>{{ variant.usageNotes }}
                  </div>

                  <div v-if="variant.imageData" class="pt-2">
                    <img :src="variant.imageData" :alt="variant.variantChar" class="w-full max-h-32 object-contain border border-ink/10 rounded-sm bg-paper-100" />
                  </div>

                  <div v-if="variant.tags.length > 0" class="flex flex-wrap gap-1 pt-1">
                    <span
                      v-for="tag in variant.tags"
                      :key="tag"
                      class="text-[10px] px-1 py-0.5 rounded-sm bg-ink/5 border border-ink/10 text-ink-muted"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card-scroll p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <ListTree class="w-5 h-5 text-rattan-dark" />
                <h4 class="font-title text-lg text-ink">字形演化链</h4>
                <span class="text-xs text-ink-muted font-mono">{{ selectedGlyphDetail.evolutionChain.length }} 步</span>
              </div>
              <button class="btn-secondary !py-1 !px-3 text-xs" @click="openCreateEvolution(selectedGlyphDetail.id)">
                <Plus class="w-3.5 h-3.5" />
                添加演化步骤
              </button>
            </div>
            <div class="scroll-divider mb-4" />

            <div v-if="selectedGlyphDetail.evolutionChain.length === 0" class="text-center py-8 text-ink-muted font-serif text-sm">
              还没有建立演化链，点击「添加演化步骤」开始构建字形演化路径。
            </div>

            <div v-else class="relative">
              <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-ink/10" />
              <div class="space-y-4">
                <div
                  v-for="(step, index) in selectedGlyphDetail.evolutionChain"
                  :key="step.id"
                  class="relative pl-14"
                >
                  <div class="absolute left-4 w-5 h-5 rounded-full border-2 border-rattan bg-paper-50 flex items-center justify-center text-[10px] font-serif text-rattan-dark">
                    {{ index + 1 }}
                  </div>
                  <div class="rounded-sm border border-ink/15 bg-paper-50 p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-3">
                        <span class="text-lg font-serif text-ink">
                          {{ step.fromVariantChar || '（起源）' }}
                        </span>
                        <ChevronRight class="w-4 h-4 text-ink-muted" />
                        <span class="text-lg font-serif text-vermilion">
                          {{ step.toVariantChar || '（演变中）' }}
                        </span>
                      </div>
                      <div class="flex gap-1">
                        <button
                          class="btn-ghost !p-1"
                          @click="openEditEvolution(selectedGlyphDetail.id, step)"
                          title="编辑"
                        >
                          <Pencil class="w-3 h-3" />
                        </button>
                        <button
                          class="btn-ghost !p-1 hover:!text-carmine"
                          @click="confirmDeleteEvolution(selectedGlyphDetail.id, step.id)"
                          title="删除"
                        >
                          <Trash2 class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2 text-xs font-serif">
                      <span class="px-1.5 py-0.5 rounded-sm border border-ink/10 bg-ink/5 text-ink-soft">
                        {{ changeTypeLabels[step.changeType] }}
                      </span>
                      <span v-if="step.dynasty" class="px-1.5 py-0.5 rounded-sm border border-rattan/30 bg-rattan/10 text-rattan-dark">
                        {{ step.dynasty }}
                      </span>
                      <span class="text-ink-muted">
                        置信度：{{ Math.round(step.confidence * 100) }}%
                      </span>
                    </div>
                    <div v-if="step.evidence" class="mt-2 text-xs font-serif text-ink-soft bg-paper-100/60 border border-ink/5 rounded-sm p-2">
                      <span class="text-ink-muted">证据：</span>{{ step.evidence }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="card-scroll p-12 text-center h-64 flex items-center justify-center">
          <div>
            <Palette class="w-12 h-12 mx-auto text-ink-pale mb-3" />
            <div class="font-serif text-ink-muted">
              从左侧选择一个字形查看详细信息，或点击「新增字形条目」开始录入
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showGlyphModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" @click.self="showGlyphModal = false">
        <div class="card-scroll w-full max-w-xl p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingGlyphId ? '编辑字形条目' : '新增字形条目' }}
            </h3>
            <button class="btn-ghost" @click="showGlyphModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">字头 <span class="text-carmine">*</span></label>
                <input
                  v-model="glyphForm.headChar"
                  placeholder="如：民"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-lg focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20 text-center"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">拼音</label>
                <input
                  v-model="glyphForm.pinyin"
                  placeholder="如：mín"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">部首</label>
                <input
                  v-model="glyphForm.radical"
                  placeholder="如：氏"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">笔画数</label>
                <input
                  v-model="glyphForm.strokeCount"
                  type="number"
                  placeholder="如：5"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">释义</label>
              <textarea
                v-model="glyphForm.definition"
                rows="2"
                placeholder="简要释义……"
                class="text-area-paper text-sm"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">研究备注</label>
              <textarea
                v-model="glyphForm.researchNotes"
                rows="3"
                placeholder="字形学研究相关的备注……"
                class="text-area-paper text-sm"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">分类</label>
                <input
                  v-model="glyphForm.category"
                  placeholder="如：形声字、会意字"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">所属项目</label>
                <select
                  v-model="glyphForm.projectId"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">不限项目（全局可用）</option>
                  <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">标签</label>
              <input
                v-model="glyphForm.tags"
                placeholder="用逗号或顿号分隔，如：避讳字、缺笔、唐刻本"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>
          </div>

          <div v-if="formError" class="mt-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine">
            {{ formError }}
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showGlyphModal = false">取消</button>
            <button class="btn-primary" @click="submitGlyphForm">
              <Check class="w-4 h-4" />
              {{ editingGlyphId ? '保存修改' : '创建字形条目' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showVariantModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" @click.self="showVariantModal = false">
        <div class="card-scroll w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingVariantId ? '编辑异体字形' : '新增异体字形' }}
              <span v-if="selectedGlyphDetail" class="text-base text-ink-muted ml-2">（{{ selectedGlyphDetail.headChar }}）</span>
            </h3>
            <button class="btn-ghost" @click="showVariantModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">异体字形 <span class="text-carmine">*</span></label>
                <input
                  v-model="variantForm.variantChar"
                  placeholder="如：𠘨"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-lg focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20 text-center"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">异体类型 <span class="text-carmine">*</span></label>
                <select
                  v-model="variantForm.variantType"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="v in variantTypeOptions" :key="v.value" :value="v.value">
                    {{ v.label }} — {{ v.desc }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">载体类型</label>
                <select
                  v-model="variantForm.sourceType"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="s in sourceTypeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">可信度</label>
                <select
                  v-model="variantForm.credibility"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="c in credibilityOptions" :key="c.value" :value="c.value">
                    {{ c.label }} — {{ c.desc }}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">出处名称 <span class="text-carmine">*</span></label>
              <input
                v-model="variantForm.sourceTitle"
                placeholder="如：敦煌写本 P.2536"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">朝代</label>
                <select
                  v-model="variantForm.dynasty"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">不详</option>
                  <option v-for="d in DYNASTY_OPTIONS" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">年代</label>
                <input
                  v-model="variantForm.era"
                  placeholder="如：贞观年间"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">出处详情</label>
                <input
                  v-model="variantForm.sourceDetail"
                  placeholder="如：卷三、第十二页"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">页码/行号</label>
                <input
                  v-model="variantForm.pageRef"
                  placeholder="如：P.5v 第3行"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">缺笔笔画</label>
                <input
                  v-model="variantForm.missingStrokes"
                  placeholder="如：斜钩、撇"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">增笔笔画</label>
                <input
                  v-model="variantForm.addedStrokes"
                  placeholder="如：点、横"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">字形图像</label>
              <div v-if="variantForm.imageData" class="mb-3">
                <div class="relative rounded-sm border border-ink/20 overflow-hidden bg-paper-100 inline-block">
                  <img :src="variantForm.imageData" :alt="variantForm.imageName" class="max-h-40 max-w-full object-contain p-2" />
                  <button
                    type="button"
                    @click="clearImage"
                    class="absolute top-2 right-2 bg-paper-50/90 text-carmine px-2 py-1 text-xs rounded-sm border border-carmine/30 hover:bg-carmine/10 transition-colors"
                  >
                    <X class="w-3 h-3 inline mr-1" />
                    移除
                  </button>
                </div>
                <div class="text-xs text-ink-muted mt-1 font-serif">{{ variantForm.imageName }}</div>
              </div>
              <div v-else>
                <input ref="imageFileInput" type="file" accept="image/*" @change="handleImageUpload" class="hidden" />
                <button
                  type="button"
                  @click="imageFileInput?.click()"
                  class="w-full border-2 border-dashed border-ink/20 rounded-sm py-4 text-center hover:border-azure/40 hover:bg-azure/5 transition-colors"
                >
                  <Upload class="w-5 h-5 mx-auto text-ink-muted mb-2" />
                  <div class="text-sm text-ink-soft font-serif">点击上传字形图像</div>
                  <div class="text-xs text-ink-muted mt-1">支持 JPG、PNG 格式，大小不超过 5MB</div>
                </button>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">使用场景</label>
              <textarea
                v-model="variantForm.useContext"
                rows="2"
                placeholder="该字形的使用场景、出现语境……"
                class="text-area-paper text-sm"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">字形说明</label>
              <textarea
                v-model="variantForm.usageNotes"
                rows="2"
                placeholder="关于该字形的补充说明……"
                class="text-area-paper text-sm"
              />
            </div>

            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                v-model="variantForm.isHeadVariant"
                id="isHeadVariant"
                class="w-4 h-4 rounded border-ink/30 text-vermilion focus:ring-vermilion"
              />
              <label for="isHeadVariant" class="text-sm font-serif text-ink-soft">设为标准异体（字头）</label>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">标签</label>
              <input
                v-model="variantForm.tags"
                placeholder="用逗号或顿号分隔"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>
          </div>

          <div v-if="formError" class="mt-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine">
            {{ formError }}
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showVariantModal = false">取消</button>
            <button class="btn-primary" @click="submitVariantForm">
              <Check class="w-4 h-4" />
              {{ editingVariantId ? '保存修改' : '添加异体字形' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showEvolutionModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" @click.self="showEvolutionModal = false">
        <div class="card-scroll w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingStepId ? '编辑演化步骤' : '添加演化步骤' }}
              <span v-if="selectedGlyphDetail" class="text-base text-ink-muted ml-2">（{{ selectedGlyphDetail.headChar }}）</span>
            </h3>
            <button class="btn-ghost" @click="showEvolutionModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">起始字形</label>
                <select
                  v-model="evolutionForm.fromVariantId"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">（起源/未知）</option>
                  <option
                    v-for="v in selectedGlyphDetail?.variants || []"
                    :key="v.id"
                    :value="v.id"
                  >
                    {{ v.variantChar }} — {{ v.sourceTitle }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">结果字形</label>
                <select
                  v-model="evolutionForm.toVariantId"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">（演变中/未知）</option>
                  <option
                    v-for="v in selectedGlyphDetail?.variants || []"
                    :key="v.id"
                    :value="v.id"
                  >
                    {{ v.variantChar }} — {{ v.sourceTitle }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">变化类型</label>
                <select
                  v-model="evolutionForm.changeType"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option v-for="c in changeTypeOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">朝代</label>
                <select
                  v-model="evolutionForm.dynasty"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">不详</option>
                  <option v-for="d in DYNASTY_OPTIONS" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">
                置信度：{{ Math.round(evolutionForm.confidence * 100) }}%
              </label>
              <input
                v-model.number="evolutionForm.confidence"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-vermilion"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">排序</label>
              <input
                v-model.number="evolutionForm.order"
                type="number"
                min="0"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">证据说明</label>
              <textarea
                v-model="evolutionForm.evidence"
                rows="3"
                placeholder="说明该演化步骤的文献证据或研究依据……"
                class="text-area-paper text-sm"
              />
            </div>
          </div>

          <div v-if="formError" class="mt-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine">
            {{ formError }}
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showEvolutionModal = false">取消</button>
            <button class="btn-primary" @click="submitEvolutionForm">
              <Check class="w-4 h-4" />
              {{ editingStepId ? '保存修改' : '添加演化步骤' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showLinkModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40" @click.self="showLinkModal = false">
        <div class="card-scroll w-full max-w-md p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">关联字形到差异条目</h3>
            <button class="btn-ghost" @click="showLinkModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />

          <div class="space-y-4">
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">选择差异条目</label>
              <select
                v-model="linkForm.diffEntryId"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none"
              >
                <option value="">请选择差异条目</option>
                <option v-for="d in diffStore.entries.slice(0, 50)" :key="d.id" :value="d.id">
                  {{ String(diffStore.entries.findIndex((x) => x.id === d.id) + 1).padStart(2, '0') }} · {{ d.originalText || '（空）' }} → {{ d.revisedText || '（空）' }}
                </option>
              </select>
            </div>

            <div v-if="linkingGlyphId && glyphStore.getGlyphById(linkingGlyphId)?.variants.length">
              <label class="block font-serif text-sm text-ink-soft mb-1">关联具体异体（可选）</label>
              <select
                v-model="linkForm.variantId"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none"
              >
                <option value="">整个字形条目</option>
                <option
                  v-for="v in glyphStore.getGlyphById(linkingGlyphId)?.variants || []"
                  :key="v.id"
                  :value="v.id"
                >
                  {{ v.variantChar }} — {{ v.sourceTitle }}
                </option>
              </select>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">相关性说明（可选）</label>
              <textarea
                v-model="linkForm.relevanceNote"
                rows="2"
                placeholder="说明此字形证据与该差异条目的关联……"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-xs focus:border-vermilion focus:outline-none resize-none"
              />
            </div>
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showLinkModal = false">取消</button>
            <button class="btn-primary" @click="doLinkToDiff">
              <Link2 class="w-4 h-4" />
              关联
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
