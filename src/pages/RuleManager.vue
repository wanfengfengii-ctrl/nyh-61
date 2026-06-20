<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  Download,
  History,
  GitCompare,
  AlertTriangle,
  Info,
} from 'lucide-vue-next';
import { useRuleStore } from '@/stores/ruleStore';
import { useRuleVersionStore } from '@/stores/ruleVersionStore';
import { useAuditStore } from '@/stores/auditStore';
import { useDiffStore } from '@/stores/diffStore';
import { RouterLink } from 'vue-router';
import type { TabooRule, RuleVersion } from '@/types';
import { formatDate } from '@/utils/exportEngine';

const ruleStore = useRuleStore();
const ruleVersionStore = useRuleVersionStore();
const auditStore = useAuditStore();
const diffStore = useDiffStore();

const search = ref('');
const showModal = ref(false);
const showBulkModal = ref(false);
const editingId = ref<string | null>(null);
const showVersionModal = ref(false);
const selectedRuleId = ref<string | null>(null);
const showImpactModal = ref(false);
const impactRule = ref<TabooRule | null>(null);
const impactPatch = ref<Partial<TabooRule>>({});

const form = reactive({
  originalChar: '',
  replacedChar: '',
  dynasty: '',
  note: '',
});

const bulkText = ref('');
const bulkResult = ref<{ added: number; skipped: number; errors: string[] } | null>(null);
const formError = ref('');
const deleteTarget = ref<TabooRule | null>(null);
const changeNote = ref('');

const filtered = computed(() => {
  const q = search.value.trim();
  if (!q) return ruleStore.rules;
  return ruleStore.rules.filter(
    (r) =>
      r.originalChar.includes(q) ||
      r.replacedChar.includes(q) ||
      (r.dynasty || '').includes(q) ||
      (r.note || '').includes(q),
  );
});

const ruleVersions = computed(() => {
  if (!selectedRuleId.value) return [];
  return ruleVersionStore.getRuleVersions(selectedRuleId.value);
});

const impactAnalysis = computed(() => {
  if (!impactRule.value) return null;
  return ruleVersionStore.analyzeImpact(
    impactRule.value,
    impactPatch.value,
    diffStore.entries,
  );
});

function openCreate() {
  editingId.value = null;
  form.originalChar = '';
  form.replacedChar = '';
  form.dynasty = '';
  form.note = '';
  formError.value = '';
  changeNote.value = '';
  showModal.value = true;
}

function openEdit(r: TabooRule) {
  editingId.value = r.id;
  form.originalChar = r.originalChar;
  form.replacedChar = r.replacedChar;
  form.dynasty = r.dynasty || '';
  form.note = r.note || '';
  formError.value = '';
  changeNote.value = '';
  impactRule.value = r;
  impactPatch.value = {
    originalChar: r.originalChar,
    replacedChar: r.replacedChar,
    dynasty: r.dynasty,
    note: r.note,
  };
  showModal.value = true;
}

function showImpactAnalysis() {
  if (editingId.value && impactRule.value) {
    impactPatch.value = {
      originalChar: form.originalChar,
      replacedChar: form.replacedChar,
      dynasty: form.dynasty || undefined,
      note: form.note || undefined,
    };
    showImpactModal.value = true;
  }
}

function submitForm() {
  if (!form.originalChar.trim() || !form.replacedChar.trim()) {
    formError.value = '原字与替换字均不可为空';
    return;
  }
  if (form.originalChar.trim() === form.replacedChar.trim()) {
    formError.value = '原字与替换字不可相同';
    return;
  }
  let res;
  if (editingId.value) {
    const oldRule = ruleStore.rules.find((r) => r.id === editingId.value);
    res = ruleStore.updateRule(editingId.value, {
      originalChar: form.originalChar,
      replacedChar: form.replacedChar,
      dynasty: form.dynasty,
      note: form.note,
    });
    if (res.ok && oldRule) {
      ruleVersionStore.recordVersion(
        { ...oldRule, originalChar: form.originalChar, replacedChar: form.replacedChar, dynasty: form.dynasty || undefined, note: form.note || undefined },
        'update',
        '本地用户',
        changeNote.value || undefined,
      );
      auditStore.addLog({
        actionType: 'rule_update',
        actor: '本地用户',
        targetId: editingId.value,
        description: `修改规则：${oldRule.originalChar}→${oldRule.replacedChar} 改为 ${form.originalChar}→${form.replacedChar}`,
        details: { changeNote: changeNote.value },
      });
    }
  } else {
    res = ruleStore.addRule({
      originalChar: form.originalChar,
      replacedChar: form.replacedChar,
      dynasty: form.dynasty,
      note: form.note,
    });
    if (res.ok) {
      const newRule = ruleStore.rules[ruleStore.rules.length - 1];
      if (newRule) {
        ruleVersionStore.recordVersion(newRule, 'create', '本地用户', changeNote.value || undefined);
        auditStore.addLog({
          actionType: 'rule_create',
          actor: '本地用户',
          targetId: newRule.id,
          description: `新增规则：${newRule.originalChar} → ${newRule.replacedChar}`,
          details: { dynasty: newRule.dynasty, note: newRule.note },
        });
      }
    }
  }
  if (!res.ok) {
    formError.value = res.error || '操作失败';
    return;
  }
  showModal.value = false;
}

function confirmDelete(r: TabooRule) {
  deleteTarget.value = r;
}

function doDelete() {
  if (deleteTarget.value) {
    const rule = deleteTarget.value;
    ruleVersionStore.recordVersion(rule, 'delete', '本地用户');
    ruleStore.removeRule(deleteTarget.value.id);
    auditStore.addLog({
      actionType: 'rule_delete',
      actor: '本地用户',
      targetId: rule.id,
      description: `删除规则：${rule.originalChar} → ${rule.replacedChar}`,
    });
    deleteTarget.value = null;
  }
}

function submitBulk() {
  const lines = bulkText.value.split(/\r?\n/);
  const beforeCount = ruleStore.rules.length;
  bulkResult.value = ruleStore.bulkImport(lines);
  if (bulkResult.value.added > 0) {
    const newRules = ruleStore.rules.slice(beforeCount);
    for (const r of newRules) {
      ruleVersionStore.recordVersion(r, 'create', '本地用户', '批量导入');
    }
    auditStore.addLog({
      actionType: 'rule_bulk_import',
      actor: '本地用户',
      description: `批量导入规则：新增 ${bulkResult.value.added} 条，跳过 ${bulkResult.value.skipped} 条`,
    });
  }
  if (bulkResult.value.added > 0 || bulkResult.value.errors.length === 0) {
    setTimeout(() => {
      showBulkModal.value = false;
      bulkText.value = '';
      bulkResult.value = null;
    }, 1500);
  }
}

function resetSeed() {
  if (confirm('将重置为内置避讳字示例表，当前所有自定义规则会被清除，确认吗？')) {
    ruleStore.resetSeed();
    ruleVersionStore.clearVersions();
    auditStore.addLog({
      actionType: 'rule_update',
      actor: '本地用户',
      description: '重置规则为默认示例',
    });
  }
}

function exportRules() {
  const rows = ruleStore.rules.map((r) =>
    [r.originalChar, r.replacedChar, r.dynasty || '', r.note || '', r.enabled ? '启用' : '禁用'].join('\t'),
  );
  const content =
    '原字\t替换字\t朝代/出处\t备注\t状态\n' + rows.join('\n');
  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '避讳字规则表.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);

  auditStore.addLog({
    actionType: 'rule_update',
    actor: '本地用户',
    description: '导出规则表',
  });
}

function openVersionHistory(rule: TabooRule) {
  selectedRuleId.value = rule.id;
  showVersionModal.value = true;
}

function getChangeTypeLabel(type: string): string {
  switch (type) {
    case 'create': return '新增';
    case 'update': return '修改';
    case 'delete': return '删除';
    default: return type;
  }
}

function getChangeTypeClass(type: string): string {
  switch (type) {
    case 'create': return 'text-moss';
    case 'update': return 'text-vermilion';
    case 'delete': return 'text-carmine';
    default: return 'text-ink-muted';
  }
}

const impactLevelClass = computed(() => {
  if (!impactAnalysis.value) return '';
  switch (impactAnalysis.value.impactLevel) {
    case 'high': return 'text-carmine border-carmine/50 bg-carmine/10';
    case 'medium': return 'text-rattan-dark border-rattan/50 bg-rattan/20';
    case 'low': return 'text-moss border-moss/50 bg-moss/10';
    default: return '';
  }
});

const impactLevelLabel = computed(() => {
  if (!impactAnalysis.value) return '';
  const level = impactAnalysis.value.impactLevel;
  return level === 'high' ? '高影响' : level === 'medium' ? '中影响' : '低影响';
});
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h2 class="juan-title" data-juan="卷一">避讳字规则表</h2>
        <p class="mt-2 text-ink-muted text-sm font-serif leading-relaxed">
          维护古籍中常见的避讳字替换规则，支持版本管理与变更影响分析。
          <span class="text-vermilion">新增或修改规则后，须回到「卷二·文本导入」重新执行差异扫描。</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn-secondary" @click="resetSeed">
          <RotateCcw class="w-4 h-4" />
          重置示例
        </button>
        <button class="btn-secondary" @click="exportRules">
          <Download class="w-4 h-4" />
          导出 TSV
        </button>
        <button class="btn-secondary" @click="showBulkModal = true">
          <Upload class="w-4 h-4" />
          批量导入
        </button>
        <button class="btn-primary" @click="openCreate">
          <Plus class="w-4 h-4" />
          新增规则
        </button>
      </div>
    </div>

    <div class="card-scroll p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
      <div class="relative w-full md:w-80">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-pale" />
        <input
          v-model="search"
          placeholder="搜索原字、替换字、朝代或备注……"
          class="w-full rounded-md border border-ink/20 bg-paper-50 pl-9 pr-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
        />
      </div>
      <div class="text-xs text-ink-muted font-serif">
        共 <strong class="text-ink">{{ ruleStore.rules.length }}</strong> 条，其中
        启用 <strong class="text-vermilion">{{ ruleStore.enabledRules.length }}</strong> 条，
        已筛出 {{ filtered.length }} 条
        <span v-if="ruleVersionStore.totalVersions > 0">
          · 历史版本 <strong class="text-azure">{{ ruleVersionStore.totalVersions }}</strong> 条
        </span>
      </div>
    </div>

    <div class="card-scroll overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full font-serif text-sm">
          <thead>
            <tr class="bg-paper-200/70 text-ink text-left border-b border-ink/15">
              <th class="px-4 py-3 font-medium w-16">编号</th>
              <th class="px-4 py-3 font-medium">原字</th>
              <th class="px-4 py-3 font-medium">替换字</th>
              <th class="px-4 py-3 font-medium">朝代 / 出处</th>
              <th class="px-4 py-3 font-medium">备注说明</th>
              <th class="px-4 py-3 font-medium w-24">状态</th>
              <th class="px-4 py-3 font-medium w-48 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, idx) in filtered"
              :key="r.id"
              class="border-b border-ink/5 last:border-0 hover:bg-vermilion/5 transition-colors"
            >
              <td class="px-4 py-3 text-ink-muted font-mono text-xs">
                {{ String(idx + 1).padStart(3, '0') }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center justify-center min-w-[2.2rem] h-[2.2rem] rounded-sm bg-paper-200 border border-ink/20 px-2 font-title text-xl"
                >
                  {{ r.originalChar }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-vermilion font-serif">→</span>
                  <span
                    class="inline-flex items-center justify-center min-w-[2.2rem] h-[2.2rem] rounded-sm bg-rattan/30 border border-rattan px-2 font-title text-xl"
                  >
                    {{ r.replacedChar }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-ink-soft">
                {{ r.dynasty || '—' }}
              </td>
              <td class="px-4 py-3 text-ink-muted max-w-sm">
                <span class="line-clamp-2">{{ r.note || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <button
                  class="btn-ghost !p-0 hover:bg-transparent"
                  :title="r.enabled ? '点击禁用' : '点击启用'"
                  @click="ruleStore.toggleEnabled(r.id)"
                >
                  <ToggleRight v-if="r.enabled" class="w-6 h-6 text-vermilion" />
                  <ToggleLeft v-else class="w-6 h-6 text-ink-pale" />
                </button>
                <span class="ml-1 text-xs" :class="r.enabled ? 'text-vermilion' : 'text-ink-pale'">
                  {{ r.enabled ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1">
                  <button class="btn-ghost" title="版本历史" @click="openVersionHistory(r)">
                    <History class="w-4 h-4" />
                  </button>
                  <button class="btn-ghost" title="编辑" @click="openEdit(r)">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    class="btn-ghost hover:!text-carmine"
                    title="删除"
                    @click="confirmDelete(r)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-ink-muted font-serif">
                暂无匹配的规则，点击「新增规则」添加第一条
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex justify-end">
      <RouterLink to="/import" class="btn-primary">
        前往文本导入与扫描 →
      </RouterLink>
    </div>

    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showModal = false"
      >
        <div class="card-scroll w-full max-w-xl p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink">
              {{ editingId ? '编辑规则' : '新增避讳字规则' }}
            </h3>
            <button class="btn-ghost" @click="showModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-5" />
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">原字 <span class="text-carmine">*</span></label>
              <input
                v-model="form.originalChar"
                maxlength="4"
                placeholder="如：玄"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-title text-2xl tracking-widest focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>
            <div>
              <label class="block font-serif text-sm text-ink-soft mb-1">替换字 <span class="text-carmine">*</span></label>
              <input
                v-model="form.replacedChar"
                maxlength="4"
                placeholder="如：元"
                class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-title text-2xl tracking-widest focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
              />
            </div>
          </div>
          <div class="mb-4">
            <label class="block font-serif text-sm text-ink-soft mb-1">朝代 / 出处</label>
            <input
              v-model="form.dynasty"
              placeholder="如：清代（避康熙讳）"
              class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
            />
          </div>
          <div class="mb-4">
            <label class="block font-serif text-sm text-ink-soft mb-1">备注说明</label>
            <textarea
              v-model="form.note"
              rows="3"
              placeholder="说明避讳规则的缘由、出处或典籍例证……"
              class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
            />
          </div>
          <div class="mb-4">
            <label class="block font-serif text-sm text-ink-soft mb-1">变更说明</label>
            <input
              v-model="changeNote"
              placeholder="可选：简要说明本次变更的原因或依据……"
              class="w-full rounded-md border border-ink/20 bg-paper-50 px-3 py-2 font-serif text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
            />
          </div>

          <div v-if="editingId" class="mb-4">
            <button
              class="text-vermilion text-sm font-serif flex items-center gap-1 hover:underline"
              @click="showImpactAnalysis"
            >
              <GitCompare class="w-4 h-4" />
              查看变更影响分析
            </button>
          </div>

          <div
            v-if="formError"
            class="mb-4 rounded-sm border border-carmine/40 bg-carmine/10 p-3 text-sm font-serif text-carmine flex items-start gap-2"
          >
            <AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
            {{ formError }}
          </div>
          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showModal = false">取消</button>
            <button class="btn-primary" @click="submitForm">
              <Check class="w-4 h-4" />
              {{ editingId ? '保存修改' : '确认新增' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showBulkModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showBulkModal = false"
      >
        <div class="card-scroll w-full max-w-2xl p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-title text-xl text-ink">批量导入规则</h3>
              <p class="mt-1 text-xs text-ink-muted font-serif">
                每行一条，支持逗号「,」、中文逗号「，」或制表符分隔：
                <code class="font-mono bg-paper-200 px-1 rounded-sm">原字,替换字,朝代,备注</code>
              </p>
            </div>
            <button class="btn-ghost" @click="showBulkModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <textarea
            v-model="bulkText"
            rows="8"
            placeholder="玄,元,清代,康熙讳&#10;弘,宏,清代,乾隆讳"
            class="w-full rounded-md border border-ink/20 bg-paper-50 p-3 font-mono text-sm focus:border-vermilion focus:outline-none focus:ring-2 focus:ring-vermilion/20"
          />
          <div
            v-if="bulkResult"
            class="mt-3 rounded-sm border border-moss/40 bg-moss/10 p-3 text-sm font-serif text-moss"
          >
            成功新增 {{ bulkResult.added }} 条
            <span v-if="bulkResult.skipped">，重复跳过 {{ bulkResult.skipped }} 条</span>
            <div v-if="bulkResult.errors.length" class="mt-2 text-carmine text-xs">
              <div v-for="(e, i) in bulkResult.errors" :key="i">{{ e }}</div>
            </div>
          </div>
          <div class="scroll-divider my-4" />
          <div class="flex justify-end gap-2">
            <button class="btn-secondary" @click="showBulkModal = false">关闭</button>
            <button class="btn-primary" @click="submitBulk">
              <Upload class="w-4 h-4" />
              开始导入
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
          <h3 class="font-title text-lg text-ink mb-2">确认删除规则？</h3>
          <p class="font-serif text-sm text-ink-muted mb-4">
            将删除
            <span class="font-title text-ink text-base mx-1">{{ deleteTarget.originalChar }}</span>
            →
            <span class="font-title text-vermilion text-base mx-1">{{ deleteTarget.replacedChar }}</span>
            的对应规则。已有判断不会被删除，但后续扫描将不再使用此规则。
            <br/>
            <span class="text-carmine">删除操作会记录到版本历史中。</span>
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
        v-if="showVersionModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showVersionModal = false"
      >
        <div class="card-scroll w-full max-w-2xl p-6 max-h-[80vh] flex flex-col">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-title text-xl text-ink">规则版本历史</h3>
              <p class="text-sm text-ink-muted font-serif mt-1">
                记录规则的所有变更历史，可追溯每次修改详情</p>
            </div>
            <button class="btn-ghost" @click="showVersionModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />

          <div class="flex-1 overflow-y-auto space-y-3">
            <div
              v-for="(v, idx) in ruleVersions"
              :key="v.id"
              class="rounded-sm border border-ink/10 p-4 bg-paper-50"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs text-ink-muted">{{ v.version }}</span>
                  <span :class="['text-xs', getChangeTypeClass(v.changeType)]">
                    {{ getChangeTypeLabel(v.changeType) }}
                  </span>
                </div>
                <span class="text-xs text-ink-muted font-mono">
                  {{ formatDate(v.createdAt) }}
                </span>
              </div>
              <div class="flex items-center gap-3 my-2">
                <span
                  class="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-paper-200 border border-ink/20 font-title text-lg"
                >
                  {{ v.originalChar }}
                </span>
                <span class="text-vermilion">→</span>
                <span
                  class="inline-flex items-center justify-center w-8 h-8 rounded-sm bg-rattan/30 border border-rattan font-title text-lg"
                >
                  {{ v.replacedChar }}
                </span>
                <span class="text-xs text-ink-muted ml-2">
                  {{ v.dynasty || '无朝代' }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-xs text-ink-muted">
                <span>操作人：{{ v.changedBy }}</span>
                <span>状态：{{ v.enabled ? '启用' : '禁用' }}</span>
              </div>
              <div v-if="v.note" class="mt-2 text-xs text-ink-soft font-serif">
                备注：{{ v.note }}
              </div>
              <div v-if="v.changeNote" class="mt-1 text-xs text-vermilion font-serif">
                变更说明：{{ v.changeNote }}
              </div>
            </div>

            <div v-if="ruleVersions.length === 0" class="text-center py-8 text-ink-muted font-serif text-sm">
              暂无版本历史记录
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showImpactModal && impactAnalysis"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
        @click.self="showImpactModal = false"
      >
        <div class="card-scroll w-full max-w-lg p-6 animate-fade-in">
          <div class="flex items-start justify-between mb-4">
            <h3 class="font-title text-xl text-ink flex items-center gap-2">
              <AlertTriangle class="w-5 h-5 text-vermilion" />
              变更影响分析
            </h3>
            <button class="btn-ghost" @click="showImpactModal = false">
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="scroll-divider mb-4" />

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-serif text-ink-soft">影响等级</span>
              <span
                :class="['px-3 py-1 rounded-sm border text-sm font-serif', impactLevelClass]"
              >
                {{ impactLevelLabel }}
              </span>
            </div>

            <div class="rounded-sm border border-ink/10 bg-paper-100/50 p-4">
              <div class="text-sm font-serif text-ink-soft mb-2">变更内容</div>
              <ul class="space-y-1 text-sm font-serif text-ink">
                <li v-for="(detail, idx) in impactAnalysis.details" :key="idx" class="flex items-start gap-2">
                  <Info class="w-4 h-4 text-vermilion flex-shrink-0 mt-0.5" />
                  {{ detail }}
                </li>
              </ul>
            </div>

            <div class="rounded-sm border border-ink/10 bg-paper-100/50 p-4">
              <div class="text-sm font-serif text-ink-soft mb-2">
                受影响差异条目
                <span class="text-vermilion font-title font-bold ml-1">
                  {{ impactAnalysis.affectedCount }}
                </span>
                条
              </div>
              <div v-if="impactAnalysis.affectedCount > 0" class="text-xs text-ink-muted font-serif">
                规则变更后，已有的这些差异条目匹配状态可能需要重新审核判断
              </div>
              <div v-else class="text-xs text-moss font-serif">
                当前扫描结果中没有匹配此规则的匹配项，变更影响较小
              </div>
            </div>

            <div class="text-xs text-ink-muted font-serif">
              <AlertCircle class="w-3.5 h-3.5 inline mr-1" />
              提示：规则变更后需要重新执行扫描才能看到最新结果
            </div>
          </div>

          <div class="scroll-divider my-4" />
          <div class="flex justify-end">
            <button class="btn-primary" @click="showImpactModal = false">
              我知道了
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
