<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  BookOpen,
  Archive,
  X,
  Check,
  ChevronRight,
  FileText,
  Users,
  GitBranch,
  Link2,
  TreeDeciduous,
  Star,
  GripVertical,
  Eye,
  EyeOff,
  Info,
} from 'lucide-vue-next';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useVersionStore } from '@/stores/versionStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useVariantStore } from '@/stores/variantStore';
import type { TextVersion, VersionType, VersionRelation } from '@/types';
import { VERSION_TYPE_META, DYNASTY_OPTIONS } from '@/types';
import { formatDate } from '@/utils/exportEngine';

const versionStore = useVersionStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const variantStore = useVariantStore();
const router = useRouter();
const route = useRoute();

const toast = ref('');
const showVersionModal = ref(false);
const showRelationModal = ref(false);
const showTreeModal = ref(false);
const editingVersion = ref<TextVersion | null>(null);
const deleteTarget = ref<TextVersion | null>(null);
const activeTab = ref<'list' | 'relations' | 'tree'>('list');
const fileInput = ref<HTMLInputElement | null>(null);

const versionForm = reactive({
  name: '',
  shortName: '',
  versionType: 'descendant' as VersionType,
  dynasty: '',
  era: '',
  provenance: '',
  repository: '',
  shelfMark: '',
  scribe: '',
  transcriptionYear: '',
  collationNote: '',
  fullText: '',
});

const relationForm = reactive({
  sourceVersionId: '',
  targetVersionId: '',
  relationType: 'derived_from' as VersionRelation['relationType'],
  confidence: 0.8,
  evidence: '',
  note: '',
});

const formError = ref('');

onMounted(() => {
  if (!versionStore.initialized) versionStore.load();
  if (!variantStore.initialized) variantStore.load();

  if (route.query.reason === 'needversions') {
    flashToast('请先导入至少两个版本才能进行版本对读');
  }
});

function flashToast(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

const projectVersions = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.getVersionsByProject(projectStore.currentProjectId);
});

const projectRelations = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.getRelationsByProject(projectStore.currentProjectId);
});

const versionTree = computed(() => {
  if (!projectStore.currentProjectId) return [];
  return versionStore.buildVersionTree(projectStore.currentProjectId);
});

function openCreateVersion() {
  if (!projectStore.currentProjectId) {
    flashToast('请先选择项目');
    return;
  }
  editingVersion.value = null;
  versionForm.name = '';
  versionForm.shortName = '';
  versionForm.versionType = 'descendant';
  versionForm.dynasty = projectStore.currentProject?.dynasty || '';
  versionForm.era = '';
  versionForm.provenance = '';
  versionForm.repository = '';
  versionForm.shelfMark = '';
  versionForm.scribe = '';
  versionForm.transcriptionYear = '';
  versionForm.collationNote = '';
  versionForm.fullText = '';
  formError.value = '';
  showVersionModal.value = true;
}

function openEditVersion(version: TextVersion) {
  editingVersion.value = version;
  versionForm.name = version.name;
  versionForm.shortName = version.shortName;
  versionForm.versionType = version.versionType;
  versionForm.dynasty = version.dynasty || '';
  versionForm.era = version.era || '';
  versionForm.provenance = version.provenance || '';
  versionForm.repository = version.repository || '';
  versionForm.shelfMark = version.shelfMark || '';
  versionForm.scribe = version.scribe || '';
  versionForm.transcriptionYear = version.transcriptionYear || '';
  versionForm.collationNote = version.collationNote || '';
  versionForm.fullText = version.fullText;
  formError.value = '';
  showVersionModal.value = true;
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    versionForm.fullText = text;
    if (!versionForm.name) {
      versionForm.name = file.name.replace(/\.[^/.]+$/, '');
    }
    if (!versionForm.shortName) {
      versionForm.shortName = file.name.replace(/\.[^/.]+$/, '').slice(0, 4);
    }
    flashToast('文件已导入，共 ' + text.length + ' 字');
  } catch (e) {
    flashToast('文件读取失败');
  }
}

function submitVersionForm() {
  if (!projectStore.currentProjectId) {
    formError.value = '请先选择项目';
    return;
  }
  if (!versionForm.name.trim()) {
    formError.value = '版本名称不能为空';
    return;
  }
  if (!versionForm.shortName.trim()) {
    formError.value = '版本简称不能为空';
    return;
  }
  if (versionForm.shortName.length > 4) {
    formError.value = '版本简称不能超过4个字符';
    return;
  }
  if (!versionForm.fullText.trim()) {
    formError.value = '版本文本不能为空';
    return;
  }

  let res;
  if (editingVersion.value) {
    res = versionStore.updateVersion(editingVersion.value.id, {
      ...versionForm,
    });
    if (res.ok) {
      auditStore.addLog({
        actionType: 'version_update',
        actor: '本地用户',
        projectId: projectStore.currentProjectId,
        targetId: res.version?.id,
        description: `更新版本：${versionForm.name}`,
      });
      flashToast('版本已更新');
    }
  } else {
    res = versionStore.addVersion({
      ...versionForm,
      projectId: projectStore.currentProjectId,
      createdBy: '本地用户',
    });
    if (res.ok) {
      auditStore.addLog({
        actionType: 'version_create',
        actor: '本地用户',
        projectId: projectStore.currentProjectId,
        targetId: res.version?.id,
        description: `创建版本：${versionForm.name}`,
      });
      flashToast('版本已创建');
    }
  }

  if (res.ok) {
    showVersionModal.value = false;
  } else {
    formError.value = res.error || '保存失败';
  }
}

function confirmDeleteVersion(version: TextVersion) {
  deleteTarget.value = version;
}

function deleteVersion() {
  if (!deleteTarget.value) return;

  const res = versionStore.deleteVersion(deleteTarget.value.id);
  if (res.ok) {
    auditStore.addLog({
      actionType: 'version_delete',
      actor: '本地用户',
      projectId: projectStore.currentProjectId,
      targetId: deleteTarget.value.id,
      description: `删除版本：${deleteTarget.value.name}`,
    });
    flashToast('版本已删除');
  } else {
    flashToast(res.error || '删除失败');
  }
  deleteTarget.value = null;
}

function setAsBaseVersion(version: TextVersion) {
  versionStore.setBaseVersion(version.id);
  flashToast(`已设「${version.shortName}」为底本`);
}

function toggleComparing(version: TextVersion) {
  if (version.id === versionStore.baseVersionId) {
    flashToast('底本默认参与比对');
    return;
  }
  versionStore.toggleComparingVersion(version.id);
}

function openCreateRelation() {
  if (!projectStore.currentProjectId) {
    flashToast('请先选择项目');
    return;
  }
  if (projectVersions.value.length < 2) {
    flashToast('至少需要两个版本才能建立关系');
    return;
  }
  relationForm.sourceVersionId = projectVersions.value[0]?.id || '';
  relationForm.targetVersionId = projectVersions.value[1]?.id || '';
  relationForm.relationType = 'derived_from';
  relationForm.confidence = 0.8;
  relationForm.evidence = '';
  relationForm.note = '';
  formError.value = '';
  showRelationModal.value = true;
}

function submitRelationForm() {
  if (!projectStore.currentProjectId) {
    formError.value = '请先选择项目';
    return;
  }
  if (!relationForm.sourceVersionId || !relationForm.targetVersionId) {
    formError.value = '请选择源版本和目标版本';
    return;
  }
  if (relationForm.sourceVersionId === relationForm.targetVersionId) {
    formError.value = '源版本和目标版本不能相同';
    return;
  }

  const res = versionStore.addRelation({
    ...relationForm,
    projectId: projectStore.currentProjectId,
    establishedBy: '本地用户',
  });

  if (res.ok) {
    auditStore.addLog({
      actionType: 'version_relation_create',
      actor: '本地用户',
      projectId: projectStore.currentProjectId,
      targetId: res.relation?.id,
      description: `建立版本关系：${
        versionStore.getVersionById(relationForm.sourceVersionId)?.shortName
      } → ${versionStore.getVersionById(relationForm.targetVersionId)?.shortName}`,
    });
    flashToast('版本关系已建立');
    showRelationModal.value = false;
  } else {
    formError.value = res.error || '保存失败';
  }
}

function deleteRelation(relationId: string) {
  const res = versionStore.deleteRelation(relationId);
  if (res.ok) {
    auditStore.addLog({
      actionType: 'version_relation_delete',
      actor: '本地用户',
      projectId: projectStore.currentProjectId,
      description: '删除版本关系',
    });
    flashToast('关系已删除');
  }
}

function getVersionName(versionId: string): string {
  const v = versionStore.getVersionById(versionId);
  return v ? v.shortName : '未知版本';
}

const relationTypeLabels: Record<VersionRelation['relationType'], string> = {
  parent_child: '直接传承',
  sibling: '并列版本',
  derived_from: '间接衍生',
  collated_with: '参校本',
};

function goToCollation() {
  if (projectVersions.value.length < 2) {
    flashToast('请先导入至少两个版本');
    return;
  }
  if (!versionStore.baseVersionId) {
    flashToast('请先选择底本');
    return;
  }
  router.push('/collation');
}
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
        <h2 class="juan-title" data-juan="卷七">版本管理</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          导入古籍的多个版本，建立版本之间的传承关系，构建版本谱系树，为版本对读与校勘分析奠定基础。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink to="/projects" class="btn-secondary">
          <ChevronRight class="w-4 h-4 rotate-180" />
          返回项目
        </RouterLink>
        <button class="btn-secondary" @click="openCreateVersion">
          <Plus class="w-4 h-4" />
          导入版本
        </button>
        <button
          class="btn-primary"
          :disabled="projectVersions.length < 2"
          @click="goToCollation"
        >
          <GitBranch class="w-4 h-4" />
          开始版本对读
        </button>
      </div>
    </div>

    <div
      v-if="!projectStore.currentProject"
      class="card-scroll p-8 text-center"
    >
      <BookOpen class="w-12 h-12 text-ink-muted mx-auto mb-4" />
      <p class="text-ink-muted font-serif">请先在项目管理中选择或创建一个项目</p>
      <RouterLink to="/projects" class="btn-primary mt-4">
        前往项目管理
      </RouterLink>
    </div>

    <template v-else>
      <div class="card-scroll p-4 flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="text-ink-muted text-sm font-serif">当前项目：</span>
          <span class="font-title text-lg">{{ projectStore.currentProject.name }}</span>
          <span class="text-ink-muted text-sm">
            · {{ projectStore.currentProject.dynasty }} · 《{{ projectStore.currentProject.bookTitle }}》
          </span>
        </div>
        <div class="flex-1" />
        <div class="flex items-center gap-4 text-sm font-serif">
          <span class="flex items-center gap-1">
            <FileText class="w-4 h-4 text-vermilion" />
            {{ projectVersions.length }} 个版本
          </span>
          <span class="flex items-center gap-1">
            <Link2 class="w-4 h-4 text-azure" />
            {{ projectRelations.length }} 条关系
          </span>
        </div>
      </div>

      <div class="flex gap-1 border-b border-ink/10">
        <button
          class="px-4 py-2 font-serif text-sm border-b-2 transition-colors"
          :class="activeTab === 'list' ? 'border-vermilion text-vermilion' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'list'"
        >
          <span class="flex items-center gap-2">
            <FileText class="w-4 h-4" />
            版本列表
          </span>
        </button>
        <button
          class="px-4 py-2 font-serif text-sm border-b-2 transition-colors"
          :class="activeTab === 'relations' ? 'border-vermilion text-vermilion' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'relations'"
        >
          <span class="flex items-center gap-2">
            <Link2 class="w-4 h-4" />
            版本关系
          </span>
        </button>
        <button
          class="px-4 py-2 font-serif text-sm border-b-2 transition-colors"
          :class="activeTab === 'tree' ? 'border-vermilion text-vermilion' : 'border-transparent text-ink-muted hover:text-ink'"
          @click="activeTab = 'tree'"
        >
          <span class="flex items-center gap-2">
            <TreeDeciduous class="w-4 h-4" />
            版本谱系
          </span>
        </button>
      </div>

      <div v-if="activeTab === 'list'" class="space-y-4">
        <div
          v-if="projectVersions.length === 0"
          class="card-scroll p-12 text-center"
        >
          <BookOpen class="w-16 h-16 text-ink-pale mx-auto mb-4" />
          <p class="text-ink-muted font-serif mb-2">尚未导入任何版本</p>
          <p class="text-ink-pale text-sm font-serif mb-4">
            导入同一典籍的不同版本，以便进行跨版本对读分析
          </p>
          <button class="btn-primary" @click="openCreateVersion">
            <Plus class="w-4 h-4" />
            导入第一个版本
          </button>
        </div>

        <div
          v-for="version in projectVersions"
          :key="version.id"
          class="card-scroll p-4 hover:border-vermilion/40 transition-all"
          :class="{
            'border-vermilion/50 bg-vermilion/5': version.id === versionStore.baseVersionId,
          }"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <div
                class="w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0 border"
                :class="VERSION_TYPE_META[version.versionType].cls"
              >
                <span class="font-title text-lg">{{ version.shortName }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-title text-lg text-ink">{{ version.name }}</h3>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-sm border"
                    :class="VERSION_TYPE_META[version.versionType].cls"
                  >
                    {{ VERSION_TYPE_META[version.versionType].label }}
                  </span>
                  <span
                    v-if="version.id === versionStore.baseVersionId"
                    class="text-[10px] px-1.5 py-0.5 rounded-sm bg-vermilion/20 text-vermilion border border-vermilion/30"
                  >
                    <Star class="w-3 h-3 inline mr-0.5" />
                    底本
                  </span>
                  <span
                    v-else-if="versionStore.comparingVersionIds.includes(version.id)"
                    class="text-[10px] px-1.5 py-0.5 rounded-sm bg-azure/20 text-azure border border-azure/30"
                  >
                    <Check class="w-3 h-3 inline mr-0.5" />
                    比对中
                  </span>
                </div>
                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted font-serif">
                  <span v-if="version.dynasty">{{ version.dynasty }}</span>
                  <span v-if="version.era">{{ version.era }}</span>
                  <span v-if="version.provenance">来源：{{ version.provenance }}</span>
                  <span v-if="version.repository">藏馆：{{ version.repository }}</span>
                  <span>{{ version.chapters.length }} 章</span>
                  <span>{{ version.fullText.length }} 字</span>
                </div>
                <p v-if="version.collationNote" class="mt-2 text-xs text-ink-soft font-serif line-clamp-1">
                  {{ version.collationNote }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="btn-ghost !p-2"
                title="设为底本"
                :disabled="version.id === versionStore.baseVersionId"
                @click="setAsBaseVersion(version)"
              >
                <Star
                  class="w-4 h-4"
                  :class="version.id === versionStore.baseVersionId ? 'text-vermilion fill-vermilion' : 'text-ink-muted'"
                />
              </button>
              <button
                class="btn-ghost !p-2"
                title="加入比对"
                :disabled="version.id === versionStore.baseVersionId"
                @click="toggleComparing(version)"
              >
                <Check
                  class="w-4 h-4"
                  :class="versionStore.comparingVersionIds.includes(version.id) || version.id === versionStore.baseVersionId ? 'text-azure' : 'text-ink-muted'"
                />
              </button>
              <button
                class="btn-ghost !p-2"
                title="编辑版本"
                @click="openEditVersion(version)"
              >
                <Pencil class="w-4 h-4" />
              </button>
              <button
                class="btn-ghost !p-2 text-carmine hover:bg-carmine/10"
                title="删除版本"
                @click="confirmDeleteVersion(version)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'relations'" class="space-y-4">
        <div class="flex justify-between items-center">
          <p class="text-ink-muted text-sm font-serif">
            建立版本之间的传承关系，用于构建版本谱系树和分析异文演变路径
          </p>
          <button class="btn-secondary !py-1.5 text-sm" @click="openCreateRelation">
            <Plus class="w-4 h-4" />
            新建关系
          </button>
        </div>

        <div
          v-if="projectRelations.length === 0"
          class="card-scroll p-12 text-center"
        >
          <Link2 class="w-16 h-16 text-ink-pale mx-auto mb-4" />
          <p class="text-ink-muted font-serif mb-2">尚未建立版本关系</p>
          <p class="text-ink-pale text-sm font-serif">
            建立版本之间的传承、并列、衍生等关系
          </p>
        </div>

        <div
          v-for="relation in projectRelations"
          :key="relation.id"
          class="card-scroll p-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 font-serif">
                <span
                  class="px-2 py-1 rounded-sm border text-sm"
                  :class="VERSION_TYPE_META[versionStore.getVersionById(relation.sourceVersionId)?.versionType || 'descendant'].cls"
                >
                  {{ getVersionName(relation.sourceVersionId) }}
                </span>
                <ChevronRight class="w-5 h-5 text-vermilion" />
                <span
                  class="px-2 py-1 rounded-sm border text-sm"
                  :class="VERSION_TYPE_META[versionStore.getVersionById(relation.targetVersionId)?.versionType || 'descendant'].cls"
                >
                  {{ getVersionName(relation.targetVersionId) }}
                </span>
              </div>
              <span
                class="text-xs px-2 py-0.5 rounded-sm bg-paper-100 border border-ink/10 text-ink-muted"
              >
                {{ relationTypeLabels[relation.relationType] }}
              </span>
              <span class="text-xs text-ink-pale">
                置信度 {{ Math.round(relation.confidence * 100) }}%
              </span>
            </div>
            <button
              class="btn-ghost !p-2 text-carmine hover:bg-carmine/10"
              @click="deleteRelation(relation.id)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
          <p v-if="relation.note" class="mt-2 text-xs text-ink-soft font-serif pl-4 border-l-2 border-ink/10">
            {{ relation.note }}
          </p>
        </div>
      </div>

      <div v-if="activeTab === 'tree'" class="space-y-4">
        <div class="flex justify-between items-center">
          <p class="text-ink-muted text-sm font-serif">
            可视化展示版本之间的传承关系，帮助理解文本的流传脉络
          </p>
          <button
            class="btn-secondary !py-1.5 text-sm"
            :disabled="versionTree.length === 0"
            @click="showTreeModal = true"
          >
            <Eye class="w-4 h-4" />
            全屏查看
          </button>
        </div>

        <div
          v-if="versionTree.length === 0"
          class="card-scroll p-12 text-center"
        >
          <TreeDeciduous class="w-16 h-16 text-ink-pale mx-auto mb-4" />
          <p class="text-ink-muted font-serif mb-2">暂无版本谱系数据</p>
          <p class="text-ink-pale text-sm font-serif">
            请先导入版本并建立版本关系
          </p>
        </div>

        <div v-else class="card-scroll p-6 overflow-x-auto">
          <div class="min-w-[600px]">
            <svg
              :width="Math.max(600, (versionTree.reduce((m, n) => Math.max(m, n.x), 0) + 120))"
              :height="(versionTree.reduce((m, n) => Math.max(m, n.y), 0) + 120)"
              class="mx-auto"
            >
              <g>
                <template v-for="node in versionTree" :key="'lines_' + node.id">
                  <line
                    v-for="childId in node.children"
                    :key="node.id + '_' + childId"
                    :x1="node.x + 50"
                    :y1="node.y + 30"
                    :x2="versionTree.find(n => n.id === childId)?.x + 50"
                    :y2="versionTree.find(n => n.id === childId)?.y"
                    stroke="#8B2500"
                    stroke-width="2"
                    stroke-dasharray="4,2"
                  />
                </template>
              </g>
              <g v-for="node in versionTree" :key="node.id">
                <rect
                  :x="node.x"
                  :y="node.y"
                  width="100"
                  height="60"
                  rx="4"
                  class="fill-paper-50 stroke-ink/20"
                  stroke-width="1"
                  :class="{ 'stroke-vermilion stroke-2': node.versionId === versionStore.baseVersionId }"
                />
                <text
                  :x="node.x + 50"
                  :y="node.y + 28"
                  text-anchor="middle"
                  class="fill-ink font-title text-base"
                >
                  {{ node.version.shortName }}
                </text>
                <text
                  :x="node.x + 50"
                  :y="node.y + 48"
                  text-anchor="middle"
                  class="fill-ink-muted text-[10px] font-serif"
                >
                  {{ VERSION_TYPE_META[node.version.versionType].label }}
                </text>
                <text
                  v-if="node.version.dynasty"
                  :x="node.x + 50"
                  :y="node.y + 72"
                  text-anchor="middle"
                  class="fill-ink-pale text-[9px] font-serif"
                >
                  {{ node.version.dynasty }}
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </template>

    <div v-if="showVersionModal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div class="p-5 border-b border-ink/10 flex items-center justify-between">
          <h3 class="font-title text-xl text-ink">
            {{ editingVersion ? '编辑版本' : '导入版本' }}
          </h3>
          <button class="btn-ghost !p-2" @click="showVersionModal = false">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5">
          <div v-if="formError" class="mb-4 p-3 rounded-sm border border-carmine/40 bg-carmine/10 text-carmine text-sm font-serif">
            {{ formError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">版本名称 *</label>
              <input
                v-model="versionForm.name"
                type="text"
                class="input-field text-sm"
                placeholder="如：宋刻本、明抄本、武英殿本等"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">版本简称 *（4字以内）</label>
              <input
                v-model="versionForm.shortName"
                type="text"
                class="input-field text-sm"
                placeholder="如：宋本、明抄、殿本"
                maxlength="4"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">版本类型 *</label>
              <select v-model="versionForm.versionType" class="input-field text-sm">
                <option v-for="(meta, key) in VERSION_TYPE_META" :key="key" :value="key">
                  {{ meta.label }} - {{ meta.desc }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">朝代</label>
              <select v-model="versionForm.dynasty" class="input-field text-sm">
                <option value="">请选择</option>
                <option v-for="d in DYNASTY_OPTIONS" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">时代/年号</label>
              <input
                v-model="versionForm.era"
                type="text"
                class="input-field text-sm"
                placeholder="如：北宋嘉祐、明万历"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">刊刻/传抄年代</label>
              <input
                v-model="versionForm.transcriptionYear"
                type="text"
                class="input-field text-sm"
                placeholder="如：南宋淳熙三年"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">来源</label>
              <input
                v-model="versionForm.provenance"
                type="text"
                class="input-field text-sm"
                placeholder="如：铁琴铜剑楼旧藏"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">藏馆</label>
              <input
                v-model="versionForm.repository"
                type="text"
                class="input-field text-sm"
                placeholder="如：国家图书馆"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">索书号</label>
              <input
                v-model="versionForm.shelfMark"
                type="text"
                class="input-field text-sm"
                placeholder="如：A001234"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">抄手/刊刻者</label>
              <input
                v-model="versionForm.scribe"
                type="text"
                class="input-field text-sm"
                placeholder="如：毛晋汲古阁"
              />
            </div>
          </div>

          <div class="mb-4">
            <label class="block text-xs text-ink-muted font-serif mb-1">校勘说明</label>
            <textarea
              v-model="versionForm.collationNote"
              class="input-field text-sm h-20"
              placeholder="描述此版本的重要校勘价值、已知问题等"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-ink-muted font-serif">版本文本 *</label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-xs text-vermilion font-serif flex items-center gap-1"
                  @click="fileInput?.click()"
                >
                  <Upload class="w-3 h-3" />
                  上传 .txt 文件
                </button>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".txt"
                  class="hidden"
                  @change="handleFileUpload"
                />
                <span class="text-xs text-ink-pale font-serif">
                  {{ versionForm.fullText.length }} 字
                </span>
              </div>
            </div>
            <textarea
              v-model="versionForm.fullText"
              class="input-field font-serif text-sm h-64"
              placeholder="粘贴或导入版本的全文内容，系统将自动识别章节结构..."
            />
          </div>
        </div>

        <div class="p-5 border-t border-ink/10 flex justify-end gap-2">
          <button class="btn-secondary" @click="showVersionModal = false">
            取消
          </button>
          <button class="btn-primary" @click="submitVersionForm">
            <Check class="w-4 h-4" />
            {{ editingVersion ? '保存修改' : '导入版本' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showRelationModal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-xl flex flex-col">
        <div class="p-5 border-b border-ink/10 flex items-center justify-between">
          <h3 class="font-title text-xl text-ink">建立版本关系</h3>
          <button class="btn-ghost !p-2" @click="showRelationModal = false">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-5 space-y-4">
          <div v-if="formError" class="p-3 rounded-sm border border-carmine/40 bg-carmine/10 text-carmine text-sm font-serif">
            {{ formError }}
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">源版本</label>
              <select v-model="relationForm.sourceVersionId" class="input-field text-sm">
                <option v-for="v in projectVersions" :key="v.id" :value="v.id">
                  {{ v.shortName }} - {{ v.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-ink-muted font-serif mb-1">目标版本</label>
              <select v-model="relationForm.targetVersionId" class="input-field text-sm">
                <option v-for="v in projectVersions" :key="v.id" :value="v.id">
                  {{ v.shortName }} - {{ v.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs text-ink-muted font-serif mb-1">关系类型</label>
            <select v-model="relationForm.relationType" class="input-field text-sm">
              <option value="parent_child">直接传承（父子关系）</option>
              <option value="sibling">并列版本（同出一源）</option>
              <option value="derived_from">间接衍生（经多步传承）</option>
              <option value="collated_with">参校本（校勘时参考）</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-ink-muted font-serif mb-1">
              置信度：{{ Math.round(relationForm.confidence * 100) }}%
            </label>
            <input
              v-model.number="relationForm.confidence"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs text-ink-muted font-serif mb-1">证据依据</label>
            <textarea
              v-model="relationForm.evidence"
              class="input-field text-sm h-20"
              placeholder="说明建立此关系的文献学依据，如版式特征、避讳字、序跋记载等"
            />
          </div>

          <div>
            <label class="block text-xs text-ink-muted font-serif mb-1">备注</label>
            <input
              v-model="relationForm.note"
              type="text"
              class="input-field text-sm"
              placeholder="其他补充说明"
            />
          </div>
        </div>

        <div class="p-5 border-t border-ink/10 flex justify-end gap-2">
          <button class="btn-secondary" @click="showRelationModal = false">
            取消
          </button>
          <button class="btn-primary" @click="submitRelationForm">
            <Check class="w-4 h-4" />
            建立关系
          </button>
        </div>
      </div>
    </div>

    <div v-if="showTreeModal" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div class="p-5 border-b border-ink/10 flex items-center justify-between">
          <h3 class="font-title text-xl text-ink">版本谱系树</h3>
          <button class="btn-ghost !p-2" @click="showTreeModal = false">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-auto p-6">
          <svg
            :width="Math.max(800, (versionTree.reduce((m, n) => Math.max(m, n.x), 0) + 150))"
            :height="(versionTree.reduce((m, n) => Math.max(m, n.y), 0) + 150)"
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
                <polygon points="0 0, 10 3.5, 0 7" fill="#8B2500" />
              </marker>
            </defs>
            <g>
              <template v-for="node in versionTree" :key="'line_' + node.id">
                <line
                  v-for="childId in node.children"
                  :key="node.id + '_' + childId"
                  :x1="node.x + 60"
                  :y1="node.y + 35"
                  :x2="versionTree.find(n => n.id === childId)?.x + 60"
                  :y2="versionTree.find(n => n.id === childId)?.y"
                  stroke="#8B2500"
                  stroke-width="2"
                  marker-end="url(#arrowhead)"
                  stroke-dasharray="6,3"
                />
              </template>
            </g>
            <g v-for="node in versionTree" :key="'node_' + node.id">
              <rect
                :x="node.x"
                :y="node.y"
                width="120"
                height="70"
                rx="4"
                class="fill-paper-50"
                stroke="#1C1C1C"
                stroke-width="1"
                :class="{ 'stroke-vermilion stroke-2': node.versionId === versionStore.baseVersionId }"
              />
              <text
                :x="node.x + 60"
                :y="node.y + 32"
                text-anchor="middle"
                class="fill-ink font-title text-lg"
              >
                {{ node.version.shortName }}
              </text>
              <text
                :x="node.x + 60"
                :y="node.y + 52"
                text-anchor="middle"
                class="fill-ink-muted text-[11px] font-serif"
              >
                {{ VERSION_TYPE_META[node.version.versionType].label }}
              </text>
              <text
                v-if="node.version.dynasty"
                :x="node.x + 60"
                :y="node.y + 85"
                text-anchor="middle"
                class="fill-ink-pale text-[10px] font-serif"
              >
                {{ node.version.dynasty }}{{ node.version.era ? ' · ' + node.version.era : '' }}
              </text>
            </g>
          </svg>
        </div>

        <div class="p-4 border-t border-ink/10 bg-paper-100/50">
          <div class="flex flex-wrap gap-4 text-xs font-serif text-ink-muted">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-sm border-2 border-vermilion bg-paper-50" />
              <span>底本</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-sm border border-ink/20 bg-paper-50" />
              <span>其他版本</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-6 h-0 border-t-2 border-vermilion border-dashed" style="border-style: dashed !important;" />
              <span>传承关系</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
      <div class="card-scroll w-full max-w-md p-6">
        <h3 class="font-title text-lg text-ink mb-3">确认删除</h3>
        <p class="text-ink-muted font-serif text-sm mb-2">
          确定要删除版本「{{ deleteTarget.name }}」吗？
        </p>
        <p class="text-carmine text-xs font-serif mb-6">
          删除后，相关的版本关系和异文数据也将被清除，此操作不可恢复。
        </p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" @click="deleteTarget = null">
            取消
          </button>
          <button class="btn-primary !bg-carmine !border-carmine" @click="deleteVersion">
            <Trash2 class="w-4 h-4" />
            确认删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
