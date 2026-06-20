<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search,
  Clock,
  Filter,
  Trash2,
  User,
  FileText,
  BookOpen,
  GitCompare,
  ScrollText,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Download,
  Settings,
} from 'lucide-vue-next';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { AuditActionType } from '@/types';
import { formatDate } from '@/utils/exportEngine';

const auditStore = useAuditStore();
const projectStore = useProjectStore();

const search = ref('');
const filterAction = ref<AuditActionType | 'all'>('all');
const filterProject = ref<string | 'all'>('all');

const actionOptions: { value: AuditActionType | 'all'; label: string; icon: any }[] = [
  { value: 'all', label: '全部操作', icon: Filter },
  { value: 'project_create', label: '创建项目', icon: FileText },
  { value: 'project_update', label: '更新项目', icon: Settings },
  { value: 'project_delete', label: '删除项目', icon: Trash2 },
  { value: 'rule_create', label: '新增规则', icon: BookOpen },
  { value: 'rule_update', label: '修改规则', icon: Settings },
  { value: 'rule_delete', label: '删除规则', icon: Trash2 },
  { value: 'rule_bulk_import', label: '批量导入', icon: Download },
  { value: 'scan_run', label: '执行扫描', icon: GitCompare },
  { value: 'judgment_set', label: '设置判断', icon: CheckCircle2 },
  { value: 'judgment_clear', label: '清除判断', icon: XCircle },
  { value: 'annotation_add', label: '添加批注', icon: MessageSquare },
  { value: 'annotation_resolve', label: '解决批注', icon: CheckCircle2 },
  { value: 'review_submit', label: '提交复核', icon: Clock },
  { value: 'review_approve', label: '复核通过', icon: CheckCircle2 },
  { value: 'review_reject', label: '复核驳回', icon: XCircle },
  { value: 'report_generate', label: '生成报告', icon: ScrollText },
  { value: 'report_export', label: '导出报告', icon: Download },
];

const filteredLogs = computed(() => {
  let logs = auditStore.sortedLogs;

  if (filterAction.value !== 'all') {
    logs = logs.filter((l) => l.actionType === filterAction.value);
  }

  if (filterProject.value !== 'all') {
    logs = logs.filter((l) => l.projectId === filterProject.value);
  }

  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q),
    );
  }

  return logs;
});

function getProjectName(projectId?: string): string {
  if (!projectId) return '—';
  const p = projectStore.projects.find((x) => x.id === projectId);
  return p ? p.name : '未知项目';
}

function getActionIcon(type: AuditActionType) {
  const opt = actionOptions.find((o) => o.value === type);
  return opt?.icon || Clock;
}

function getActionColor(type: AuditActionType): string {
  if (type.includes('delete') || type.includes('reject') || type.includes('clear')) {
    return 'text-carmine';
  }
  if (type.includes('create') || type.includes('approve') || type.includes('resolve')) {
    return 'text-moss';
  }
  if (type.includes('update') || type.includes('submit') || type.includes('review')) {
    return 'text-vermilion';
  }
  return 'text-azure';
}

function exportLogs() {
  const data = JSON.stringify(filteredLogs.value, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `操作日志_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function clearAllLogs() {
  if (confirm('确定要清空所有操作日志吗？此操作不可恢复。')) {
    auditStore.clearLogs();
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷六">操作日志</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          完整记录系统所有操作，包括项目管理、规则变更、差异判断、批注评论等，支持按类型、项目、关键词检索，
          <span class="text-vermilion">确保学术研究过程可追溯、可审查。</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" @click="exportLogs">
          <Download class="w-4 h-4" />
          导出日志
        </button>
        <button class="btn-secondary hover:!text-carmine" @click="clearAllLogs">
          <Trash2 class="w-4 h-4" />
          清空日志
        </button>
      </div>
    </div>

    <div class="card-scroll p-4">
      <div class="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div class="flex flex-wrap gap-2 items-center">
          <div class="relative w-full md:w-64">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
            <input
              v-model="search"
              placeholder="搜索操作描述或执行人……"
              class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
            />
          </div>
          <select
            v-model="filterAction"
            class="rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
          >
            <option v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <select
            v-model="filterProject"
            class="rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
          >
            <option value="all">全部项目</option>
            <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>
        <div class="text-xs text-ink-muted font-serif">
          共 <strong class="text-ink">{{ filteredLogs.length }}</strong> 条记录
        </div>
      </div>
    </div>

    <div class="card-scroll overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full font-serif text-sm">
          <thead>
            <tr class="bg-paper-200/70 text-ink text-left border-b border-ink/15">
              <th class="px-4 py-3 font-medium w-12"></th>
              <th class="px-4 py-3 font-medium w-40">时间</th>
              <th class="px-4 py-3 font-medium w-32">操作类型</th>
              <th class="px-4 py-3 font-medium">操作描述</th>
              <th class="px-4 py-3 font-medium w-28">执行人</th>
              <th class="px-4 py-3 font-medium w-40">所属项目</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="log in filteredLogs"
              :key="log.id"
              class="border-b border-ink/5 last:border-0 hover:bg-vermilion/5 transition-colors"
            >
              <td class="px-4 py-3">
                <component :is="getActionIcon(log.actionType)" :class="['w-4 h-4', getActionColor(log.actionType)]" />
              </td>
              <td class="px-4 py-3 text-ink-muted font-mono text-xs">
                {{ formatDate(log.timestamp) }}
              </td>
              <td class="px-4 py-3">
                <span :class="['text-xs', getActionColor(log.actionType)]">
                  {{ auditStore.getActionLabel(log.actionType) }}
                </span>
              </td>
              <td class="px-4 py-3 text-ink">
                {{ log.description }}
                <div v-if="log.details" class="text-xs text-ink-muted mt-1 font-mono">
                  {{ JSON.stringify(log.details).slice(0, 80) }}...
                </div>
              </td>
              <td class="px-4 py-3 text-ink-soft">
                <User class="w-3.5 h-3.5 inline mr-1 text-ink-pale" />
                {{ log.actor }}
              </td>
              <td class="px-4 py-3 text-ink-muted text-xs">
                {{ getProjectName(log.projectId) }}
              </td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-ink-muted font-serif">
                暂无操作日志记录
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
