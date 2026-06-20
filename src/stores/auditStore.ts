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
  citation_create: '新增典籍依据',
  citation_update: '更新典籍依据',
  citation_delete: '删除典籍依据',
  citation_link: '关联典籍依据',
  citation_unlink: '解除关联',
  version_create: '新增版本',
  version_update: '更新版本',
  version_delete: '删除版本',
  version_import: '导入版本',
  version_relation_create: '建立版本关系',
  version_relation_update: '更新版本关系',
  version_relation_delete: '删除版本关系',
  variant_scan: '执行异文扫描',
  variant_classify: '异文分类',
  variant_accept: '采信异文',
  variant_reject: '不采信异文',
  variant_note: '更新异文备注',
  evolution_path_create: '建立演变路径',
  evolution_path_update: '更新演变路径',
  collation_report_generate: '生成校勘报告',
  collation_report_export: '导出校勘报告',
  glyph_create: '新增字形条目',
  glyph_update: '更新字形条目',
  glyph_delete: '删除字形条目',
  glyph_variant_add: '新增异体字形',
  glyph_variant_update: '更新异体字形',
  glyph_variant_delete: '删除异体字形',
  glyph_evolution_create: '建立演化链',
  glyph_evolution_update: '更新演化链',
  glyph_link: '关联字形证据',
  glyph_unlink: '解除字形关联',
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
