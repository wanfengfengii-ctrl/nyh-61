import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AuditLog, AuditActionType } from '@/types';

const AUDIT_KEY = 'ancientscrutiny_audit_logs_v1';
const MAX_LOGS = 500;

function uid() {
  return 'audit_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

const ACTION_LABELS: Record<AuditActionType, string> = {
  project_create: '创建项目',
  project_update: '更新项目',
  project_delete: '删除项目',
  rule_create: '新增规则',
  rule_update: '修改规则',
  rule_delete: '删除规则',
  rule_bulk_import: '批量导入规则',
  scan_run: '执行扫描',
  judgment_set: '设置判断',
  judgment_clear: '清除判断',
  annotation_add: '添加批注',
  annotation_resolve: '解决批注',
  review_submit: '提交复核',
  review_approve: '复核通过',
  review_reject: '复核驳回',
  report_generate: '生成报告',
  report_export: '导出报告',
  template_create: '创建模板',
  template_update: '更新模板',
};

export const useAuditStore = defineStore('audit', () => {
  const logs = ref<AuditLog[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      if (raw) {
        logs.value = JSON.parse(raw);
      }
    } catch {
      logs.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    const data = logs.value.slice(0, MAX_LOGS);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(data));
  }

  function addLog(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      ...log,
      id: uid(),
      timestamp: now(),
    };
    logs.value.unshift(entry);
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(0, MAX_LOGS);
    }
    persist();
  }

  const sortedLogs = computed(() =>
    [...logs.value].sort((a, b) => b.timestamp - a.timestamp),
  );

  function getLogsByProject(projectId: string): AuditLog[] {
    return sortedLogs.value.filter((l) => l.projectId === projectId);
  }

  function getLogsByAction(actionType: AuditActionType): AuditLog[] {
    return sortedLogs.value.filter((l) => l.actionType === actionType);
  }

  function getLogsByActor(actor: string): AuditLog[] {
    return sortedLogs.value.filter((l) => l.actor === actor);
  }

  function clearLogs() {
    logs.value = [];
    persist();
  }

  function getActionLabel(type: AuditActionType): string {
    return ACTION_LABELS[type] || type;
  }

  return {
    logs,
    sortedLogs,
    initialized,
    load,
    addLog,
    getLogsByProject,
    getLogsByAction,
    getLogsByActor,
    clearLogs,
    getActionLabel,
  };
});
