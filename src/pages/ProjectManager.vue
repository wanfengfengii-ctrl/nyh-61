<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  BookOpen,
  Archive,
  CheckCircle2,
  Clock,
  History,
  X,
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
} from 'lucide-vue-next';
import { RouterLink, useRouter } from 'vue-router';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAnnotationStore } from '@/stores/annotationStore';
import type { Project } from '@/types';
import { DYNASTY_OPTIONS } from '@/types';
import { formatDate } from '@/utils/exportEngine';

const projectStore = useProjectStore();
const auditStore = useAuditStore();
const annotationStore = useAnnotationStore();
const router = useRouter();

const search = ref('');
const showModal = ref(false);
const editingId = ref<string | null>(null);
const deleteTarget = ref<Project | null>(null);
const showHistory = ref(false);
const historyProjectId = ref<string | null>(null);

const form = reactive({
  name: '',
  dynasty: '',
  bookTitle: '',
  volume: '',
  description: '',
  status: 'active' as Project['status'],
});

const formError = ref('');

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return projectStore.projects;
  return projectStore.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.bookTitle.toLowerCase().includes(q) ||
      p.dynasty.toLowerCase().includes(q) ||
      p.volume.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q),
  );
});

const groupedProjects = computed(() => {
  const active: Project[] = [];
  const archived: Project[] = [];
  const completed: Project[] = [];
  for (const p of filtered.value) {
    if (p.status === 'active') active.push(p);
    else if (p.status === 'archived') archived.push(p);
    else completed.push(p);
  }
  return { active, archived, completed };
});

function openCreate() {
  editingId.value = null;
  form.name = '';
  form.dynasty = '';
  form.bookTitle = '';
  form.volume = '';
  form.description = '';
  form.status = 'active';
  formError.value = '';
  showModal.value = true;
}

function openEdit(p: Project) {
  editingId.value = p.id;
  form.name = p.name;
  form.dynasty = p.dynasty;
  form.bookTitle = p.bookTitle;
  form.volume = p.volume;
  form.description = p.description || '';
  form.status = p.status;
  formError.value = '';
  showModal.value = true;
}

function submitForm() {
  if (!form.name.trim()) {
    formError.value = '项目名称不能为空';
    return;
  }
  if (!form.dynasty) {
    formError.value = '请选择朝代';
    return;
  }
  if (!form.bookTitle.trim()) {
    formError.value = '请填写书名';
    return;
  }
  if (!form.volume.trim()) {
    formError.value = '请填写卷次';
    return;
  }

  let res;
  if (editingId.value) {
    res = projectStore.updateProject(editingId.value, {
      name: form.name,
      dynasty: form.dynasty,
      bookTitle: form.bookTitle,
      volume: form.volume,
      description: form.description,
      status: form.status,
    });
    if (res.ok) {
      auditStore.addLog({
        actionType: 'project_update',
        actor: '本地用户',
        projectId: editingId.value,
        description: `更新项目：${form.name}`,
      });
    }
  } else {
    res = projectStore.createProject({
      name: form.name,
      dynasty: form.dynasty,
      bookTitle: form.bookTitle,
      volume: form.volume,
      description: form.description,
    });
    if (res.ok && res.project) {
      auditStore.addLog({
        actionType: 'project_create',
        actor: '本地用户',
        projectId: res.project.id,
        description: `创建项目：${form.name}`,
      });
    }
  }

  if (!res.ok) {
    formError.value = res.error || '操作失败';
    return;
  }
  showModal.value = false;
}

function confirmDelete(p: Project) {
  deleteTarget.value = p;
}

function doDelete() {
  if (deleteTarget.value) {
    const name = deleteTarget.value.name;
    projectStore.deleteProject(deleteTarget.value.id);
    auditStore.addLog({
      actionType: 'project_delete',
      actor: '本地用户',
      description: `删除项目：${name}`,
    });
    deleteTarget.value = null;
  }
}

function selectProject(p: Project) {
  projectStore.setCurrentProject(p.id);
  router.push('/import');
}

function openScanHistory(p: Project) {
  historyProjectId.value = p.id;
  showHistory.value = true;
}

const projectScans = computed(() => {
  if (!historyProjectId.value) return [];
  return projectStore.getProjectScans(historyProjectId.value);
});

const currentHistoryProject = computed(() => {
  if (!historyProjectId.value) return null;
  return projectStore.projects.find((p) => p.id === historyProjectId.value);
});

function getUnresolvedCount(projectId: string): number {
  return annotationStore.getUnresolvedByProject(projectId).length;
}

function loadScan(scanId: string) {
  const scan = projectStore.getScanById(scanId);
  if (!scan) return;
  alert(`加载历史扫描记录：${formatDate(scan.scannedAt)}，共 ${scan.totalDiffs} 处差异`);
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷首">项目管理</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          按朝代、书名、卷次建立校勘项目，保存研究过程与历史扫描记录，支持多人协作与完整证据链追溯。
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="openCreate">
          <Plus class="w-4 h-4" />
          新建项目
        </button>
      </div>
    </div>

    <div class="card-scroll p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
      <div class="relative w-full md:w-80">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
        <input
          v-model="search"
          placeholder="搜索项目名称、书名、朝代或卷次……"
          class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
        />
      </div>
      <div class="text-xs text-ink-muted font-serif">
        共 <strong class="text-ink">{{ projectStore.projects.length }}</strong> 个项目，
        进行中 <strong class="text-vermilion">{{ projectStore.activeProjects.length }}</strong> 个，
        已完成 <strong class="text-moss">{{ projectStore.completedProjects.length }}</strong> 个
      </div>
    </div>

    <div v-if="projectStore.currentProject" class="card-scroll p-5 border-vermilion/30 bg-vermilion/5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <FolderOpen class="w-6 h-6 text-vermilion" />
          <div>
            <div class="font-title text-lg text-ink">当前项目：{{ projectStore.currentProject.name }}</div>
            <div class="text-xs text-ink-muted font-serif mt-1">
              {{ projectStore.currentProject.dynasty }} · {{ projectStore.currentProject.bookTitle }} · {{ projectStore.currentProject.volume }}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <RouterLink to="/rules" class="btn-secondary">
            进入工作区
            <ChevronRight class="w-4 h-4" />
          </RouterLink>
        </div>
      </div>
    </div>

    <div class="space-y-6">
      <template v-if="groupedProjects.active.length > 0">
        <div>
          <h3 class="font-title text-base text-ink mb-3 flex items-center gap-2">
            <Clock class="w-4 h-4 text-vermilion" />
            进行中 ({{ groupedProjects.active.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="p in groupedProjects.active"
              :key="p.id"
              class="card-scroll p-5 hover:border-vermilion/40 transition-all cursor-pointer group"
              :class="{ 'border-vermilion/50 bg-vermilion/5': projectStore.currentProjectId === p.id }"
              @click="selectProject(p)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <Folder class="w-5 h-5 text-vermilion" />
                  <span class="font-title text-lg text-ink">{{ p.name }}</span>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button class="btn-ghost !p-1" @click.stop="openEdit(p)" title="编辑">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button class="btn-ghost !p-1 hover:!text-carmine" @click.stop="confirmDelete(p)" title="删除">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div class="scroll-divider mb-3" />
              <div class="space-y-2 text-sm font-serif">
                <div class="flex items-center gap-2">
                  <span class="text-ink-muted">朝代：</span>
                  <span class="text-ink">{{ p.dynasty }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-ink-muted">书名：</span>
                  <span class="text-ink">{{ p.bookTitle }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-ink-muted">卷次：</span>
                  <span class="text-ink">{{ p.volume }}</span>
                </div>
                <div v-if="p.description" class="text-ink-soft text-xs line-clamp-2 mt-2">
                  {{ p.description }}
                </div>
              </div>
              <div class="scroll-divider my-3" />
              <div class="flex items-center justify-between text-xs font-serif">
                <div class="flex items-center gap-3 text-ink-muted">
                  <span>
                    <History class="w-3.5 h-3.5 inline mr-1" />
                    {{ projectStore.getProjectScans(p.id).length }} 次扫描
                  </span>
                  <span v-if="getUnresolvedCount(p.id) > 0" class="text-carmine">
                    {{ getUnresolvedCount(p.id) }} 待批注
                  </span>
                </div>
                <button
                  class="text-vermilion hover:underline"
                  @click.stop="openScanHistory(p)"
                >
                  历史记录
                </button>
              </div>
              <div class="mt-2 text-[10px] text-ink-pale font-mono">
                创建于 {{ formatDate(p.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="groupedProjects.completed.length > 0">
        <div>
          <h3 class="font-title text-base text-ink mb-3 flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4 text-moss" />
            已完成 ({{ groupedProjects.completed.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="p in groupedProjects.completed"
              :key="p.id"
              class="card-scroll p-5 hover:border-moss/40 transition-all cursor-pointer opacity-80"
              @click="selectProject(p)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <BookOpen class="w-5 h-5 text-moss" />
                  <span class="font-title text-lg text-ink">{{ p.name }}</span>
                </div>
                <span class="tag-pending">已完成</span>
              </div>
              <div class="scroll-divider mb-3" />
              <div class="space-y-1 text-sm font-serif text-ink-muted">
                <div>{{ p.dynasty }} · {{ p.bookTitle }} · {{ p.volume }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="groupedProjects.archived.length > 0">
        <div>
          <h3 class="font-title text-base text-ink mb-3 flex items-center gap-2">
            <Archive class="w-4 h-4 text-ink-muted" />
            已归档 ({{ groupedProjects.archived.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="p in groupedProjects.archived"
              :key="p.id"
              class="card-scroll p-5 hover:border-ink/30 transition-all cursor-pointer opacity-60"
              @click="selectProject(p)"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <Archive class="w-5 h-5 text-ink-muted" />
                  <span class="font-title text-lg text-ink-muted">{{ p.name }}</span>
                </div>
                <span class="tag-unjudged">已归档</span>
              </div>
              <div class="scroll-divider mb-3" />
              <div class="space-y-1 text-sm font-serif text-ink-muted">
                <div>{{ p.dynasty }} · {{ p.bookTitle }} · {{ p.volume }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="filtered.length === 0"
        class="card-scroll p-12 text-center"
      >
        <Folder class="w-12 h-12 mx-auto text-ink-pale mb-3" />
        <div class="font-serif text-ink-muted">
          {{ search ? '没有找到匹配的项目' : '还没有项目，点击「新建项目」开始第一个校勘项目' }}
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showModal = false"
      >
        <div class="card-scroll w-full max-w-lg p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingId ? '编辑项目' : '新建校勘项目' }}
            </h3>
            <button class="btn-ghost" @click="showModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />

          <div class="space-y-4">
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">项目名称 <span class="text-carmine">*</span></label>
              <input
                v-model="form.name"
                placeholder="如：老子道德经校勘"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">朝代 <span class="text-carmine">*</span></label>
                <select
                  v-model="form.dynasty"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                >
                  <option value="">请选择朝代</option>
                  <option v-for="d in DYNASTY_OPTIONS" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
              <div>
                <label class="block font-serif text-sm text-ink-soft mb-1">卷次 <span class="text-carmine">*</span></label>
                <input
                  v-model="form.volume"
                  placeholder="如：卷一、上篇"
                  class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
                />
              </div>
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">书名 <span class="text-carmine">*</span></label>
              <input
                v-model="form.bookTitle"
                placeholder="如：道德经"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">项目描述</label>
              <textarea
                v-model="form.description"
                rows="3"
                placeholder="简要描述项目研究目的、底本来源、校勘方法等……"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>

            <div v-if="editingId">
              <label class="block font-serif text-sm text-ink-soft mb-1">项目状态</label>
              <select
                v-model="form.status"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              >
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="archived">已归档</option>
              </select>
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
              {{ editingId ? '保存修改' : '创建项目' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="deleteTarget = null"
      >
        <div class="card-scroll w-full max-w-md p-6">
          <h3 class="font-title text-lg text-ink mb-2">确认删除项目？</h3>
          <p class="font-serif text-sm text-ink-muted mb-4">
            将删除项目
            <span class="font-title text-ink text-base mx-1">{{ deleteTarget.name }}</span>
            及其所有历史扫描记录、批注、审核流程等数据。此操作不可恢复。
          </p>
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="deleteTarget = null">取消</button>
            <button class="btn-primary !bg-carmine !border-carmine" @click="doDelete">
              <Trash2 class="w-4 h-4" />
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showHistory"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showHistory = false"
      >
        <div class="card-scroll w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-title text-xl text-ink">历史扫描记录</h3>
              <p v-if="currentHistoryProject" class="text-sm text-ink-muted font-serif mt-1">
                {{ currentHistoryProject.name }}
              </p>
            </div>
            <button class="btn-ghost" @click="showHistory = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />

          <div class="flex-1 overflow-y-auto space-y-3">
            <div
              v-for="scan in projectScans"
              :key="scan.id"
              class="rounded-sm border border-ink/10 p-4 hover:border-vermilion/30 transition-all bg-paper-50"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-serif text-ink">
                  <History class="w-4 h-4 inline mr-2 text-vermilion" />
                  {{ formatDate(scan.scannedAt) }}
                </div>
                <span class="text-xs text-ink-muted font-mono">{{ scan.totalDiffs }} 处差异</span>
              </div>
              <div class="grid grid-cols-4 gap-2 text-xs font-serif">
                <div class="text-center">
                  <div class="text-rattan-dark font-title text-lg">{{ scan.statistics.taboo }}</div>
                  <div class="text-ink-muted">避讳</div>
                </div>
                <div class="text-center">
                  <div class="text-azure font-title text-lg">{{ scan.statistics.variant }}</div>
                  <div class="text-ink-muted">异体</div>
                </div>
                <div class="text-center">
                  <div class="text-carmine font-title text-lg">{{ scan.statistics.error }}</div>
                  <div class="text-ink-muted">误改</div>
                </div>
                <div class="text-center">
                  <div class="text-moss font-title text-lg">{{ scan.statistics.pending }}</div>
                  <div class="text-ink-muted">待定</div>
                </div>
              </div>
              <div class="mt-2 text-xs text-ink-muted">
                执行人：{{ scan.scannedBy }}
                <span v-if="scan.ruleVersionTag"> · 规则版本：{{ scan.ruleVersionTag }}</span>
              </div>
              <div v-if="scan.note" class="mt-1 text-xs text-ink-soft">
                备注：{{ scan.note }}
              </div>
              <div class="mt-3 flex justify-end">
                <button class="btn-secondary !py-1 !px-3 !text-xs" @click="loadScan(scan.id)">
                  加载此版本
                </button>
              </div>
            </div>

            <div v-if="projectScans.length === 0" class="text-center py-8 text-ink-muted font-serif text-sm">
              暂无历史扫描记录
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
