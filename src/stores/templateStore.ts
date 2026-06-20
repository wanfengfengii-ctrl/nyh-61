import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ReportTemplate, ReportSection } from '@/types';

const TEMPLATE_KEY = 'ancientscrutiny_report_templates_v1';

function uid() {
  return 'tpl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

const DEFAULT_TEMPLATE: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '标准报告模板',
  description: '包含项目信息、统计摘要、差异详情的标准报告模板',
  isDefault: true,
  createdBy: '系统',
  sections: [
    { id: 'sec_title', type: 'title', title: '报告标题', visible: true, order: 1 },
    { id: 'sec_project', type: 'project_info', title: '项目信息', visible: true, order: 2 },
    { id: 'sec_summary', type: 'summary', title: '摘要信息', visible: true, order: 3 },
    { id: 'sec_stats', type: 'statistics', title: '统计数据', visible: true, order: 4 },
    { id: 'sec_rules', type: 'rule_info', title: '规则版本', visible: true, order: 5 },
    { id: 'sec_diffs', type: 'diff_list', title: '差异条目详情', visible: true, order: 6 },
    { id: 'sec_evidence', type: 'evidence_chain', title: '证据链', visible: true, order: 7 },
  ],
};

export const useTemplateStore = defineStore('template', () => {
  const templates = ref<ReportTemplate[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(TEMPLATE_KEY);
      if (raw) {
        templates.value = JSON.parse(raw);
      }
      if (templates.value.length === 0) {
        templates.value = [
          {
            ...DEFAULT_TEMPLATE,
            id: uid(),
            createdAt: now(),
            updatedAt: now(),
          },
        ];
        persist();
      }
    } catch {
      templates.value = [
        {
          ...DEFAULT_TEMPLATE,
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
        },
      ];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.value));
  }

  const defaultTemplate = computed(() =>
    templates.value.find((t) => t.isDefault) || templates.value[0],
  );

  const sortedTemplates = computed(() =>
    [...templates.value].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.updatedAt - a.updatedAt;
    }),
  );

  function createTemplate(data: {
    name: string;
    description?: string;
    sections?: ReportSection[];
    createdBy?: string;
  }): { ok: boolean; error?: string; template?: ReportTemplate } {
    const name = data.name.trim();
    if (!name) return { ok: false, error: '模板名称不能为空' };
    if (templates.value.some((t) => t.name === name)) {
      return { ok: false, error: '模板名称已存在' };
    }

    const template: ReportTemplate = {
      id: uid(),
      name,
      description: data.description?.trim() || undefined,
      isDefault: false,
      createdAt: now(),
      updatedAt: now(),
      createdBy: data.createdBy || '本地用户',
      sections: data.sections || [...DEFAULT_TEMPLATE.sections.map((s) => ({ ...s, id: uid() }))],
    };
    templates.value.push(template);
    persist();
    return { ok: true, template };
  }

  function updateTemplate(
    id: string,
    patch: Partial<Pick<ReportTemplate, 'name' | 'description' | 'sections' | 'isDefault'>>,
  ): { ok: boolean; error?: string } {
    const t = templates.value.find((x) => x.id === id);
    if (!t) return { ok: false, error: '模板不存在' };

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return { ok: false, error: '模板名称不能为空' };
      if (name !== t.name && templates.value.some((x) => x.name === name && x.id !== id)) {
        return { ok: false, error: '模板名称已存在' };
      }
      t.name = name;
    }

    if (patch.description !== undefined) {
      t.description = patch.description.trim() || undefined;
    }

    if (patch.sections !== undefined) {
      t.sections = patch.sections;
    }

    if (patch.isDefault !== undefined && patch.isDefault) {
      templates.value.forEach((x) => {
        x.isDefault = x.id === id;
      });
    }

    t.updatedAt = now();
    persist();
    return { ok: true };
  }

  function deleteTemplate(id: string): { ok: boolean; error?: string } {
    const t = templates.value.find((x) => x.id === id);
    if (!t) return { ok: false, error: '模板不存在' };
    if (t.isDefault) return { ok: false, error: '不能删除默认模板' };

    templates.value = templates.value.filter((x) => x.id !== id);
    persist();
    return { ok: true };
  }

  function getTemplateById(id: string): ReportTemplate | undefined {
    return templates.value.find((t) => t.id === id);
  }

  function duplicateTemplate(id: string, newName: string): { ok: boolean; error?: string; template?: ReportTemplate } {
    const original = templates.value.find((t) => t.id === id);
    if (!original) return { ok: false, error: '源模板不存在' };

    const name = newName.trim();
    if (!name) return { ok: false, error: '新模板名称不能为空' };
    if (templates.value.some((t) => t.name === name)) {
      return { ok: false, error: '模板名称已存在' };
    }

    const template: ReportTemplate = {
      id: uid(),
      name,
      description: original.description ? `${original.description}（副本）` : undefined,
      isDefault: false,
      createdAt: now(),
      updatedAt: now(),
      createdBy: '本地用户',
      sections: original.sections.map((s) => ({ ...s, id: uid() })),
    };
    templates.value.push(template);
    persist();
    return { ok: true, template };
  }

  return {
    templates,
    initialized,
    defaultTemplate,
    sortedTemplates,
    load,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById,
    duplicateTemplate,
  };
});
