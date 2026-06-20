import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TabooRule } from '@/types';

const STORAGE_KEY = 'ancientscrutiny_rules_v1';

const SEED_RULES: Omit<TabooRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { originalChar: '玄', replacedChar: '元', dynasty: '清代（避康熙讳）', note: '玄烨之「玄」改作「元」或缺末笔', enabled: true },
  { originalChar: '弘', replacedChar: '宏', dynasty: '清代（避乾隆讳）', note: '弘历之「弘」改作「宏」', enabled: true },
  { originalChar: '曆', replacedChar: '歷', dynasty: '清代（避乾隆讳）', note: '「曆」改为「歷」', enabled: true },
  { originalChar: '丘', replacedChar: '邱', dynasty: '清代（避孔子讳）', note: '丘姓加邑作邱', enabled: true },
  { originalChar: '胤', replacedChar: '允', dynasty: '宋代（避宋太祖讳）', note: '匡胤之「胤」改作「允」', enabled: true },
  { originalChar: '鏡', replacedChar: '鑑', dynasty: '宋代（避宋太祖讳）', note: '赵敬之「敬」嫌名改「鑑」', enabled: true },
  { originalChar: '民', replacedChar: '人', dynasty: '唐代（避唐太宗讳）', note: '李世民之「民」改作「人」', enabled: true },
  { originalChar: '世', replacedChar: '代', dynasty: '唐代（避唐太宗讳）', note: '「世」改作「代」或字缺笔', enabled: true },
  { originalChar: '治', replacedChar: '理', dynasty: '唐代（避唐高宗讳）', note: '李治之「治」改作「理」', enabled: true },
  { originalChar: '恒', replacedChar: '常', dynasty: '宋代（避宋真宗讳）', note: '赵恒之「恒」改作「常」', enabled: true },
];

function uid() {
  return 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useRuleStore = defineStore('rule', () => {
  const rules = ref<TabooRule[]>([]);
  const changedSinceLastScan = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        rules.value = JSON.parse(raw);
      } else {
        rules.value = SEED_RULES.map((r) => ({
          ...r,
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
        }));
        persist();
      }
    } catch {
      rules.value = SEED_RULES.map((r) => ({
        ...r,
        id: uid(),
        createdAt: now(),
        updatedAt: now(),
      }));
    }
    changedSinceLastScan.value = false;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules.value));
  }

  const enabledRules = computed(() => rules.value.filter((r) => r.enabled));

  function isDuplicate(originalChar: string, replacedChar: string, excludeId?: string) {
    return rules.value.some(
      (r) =>
        r.id !== excludeId &&
        r.originalChar === originalChar &&
        r.replacedChar === replacedChar,
    );
  }

  function addRule(
    data: Pick<TabooRule, 'originalChar' | 'replacedChar' | 'dynasty' | 'note'>,
  ): { ok: boolean; error?: string } {
    const oc = data.originalChar.trim();
    const rc = data.replacedChar.trim();
    if (!oc || !rc) return { ok: false, error: '原字与替换字均不可为空' };
    if (isDuplicate(oc, rc)) return { ok: false, error: '该「原字-替换字」组合已存在，请勿重复添加' };
    const rule: TabooRule = {
      id: uid(),
      originalChar: oc,
      replacedChar: rc,
      dynasty: data.dynasty?.trim() || undefined,
      note: data.note?.trim() || undefined,
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
    };
    rules.value.push(rule);
    persist();
    markChanged();
    return { ok: true };
  }

  function updateRule(
    id: string,
    patch: Partial<Pick<TabooRule, 'originalChar' | 'replacedChar' | 'dynasty' | 'note' | 'enabled'>>,
  ): { ok: boolean; error?: string } {
    const r = rules.value.find((x) => x.id === id);
    if (!r) return { ok: false, error: '规则不存在' };
    const oc = patch.originalChar !== undefined ? patch.originalChar.trim() : r.originalChar;
    const rc = patch.replacedChar !== undefined ? patch.replacedChar.trim() : r.replacedChar;
    if (!oc || !rc) return { ok: false, error: '原字与替换字均不可为空' };
    if (isDuplicate(oc, rc, id)) return { ok: false, error: '该「原字-替换字」组合已存在' };
    Object.assign(r, {
      ...patch,
      originalChar: oc,
      replacedChar: rc,
      updatedAt: now(),
    });
    persist();
    markChanged();
    return { ok: true };
  }

  function toggleEnabled(id: string) {
    const r = rules.value.find((x) => x.id === id);
    if (!r) return;
    r.enabled = !r.enabled;
    r.updatedAt = now();
    persist();
    markChanged();
  }

  function removeRule(id: string) {
    rules.value = rules.value.filter((x) => x.id !== id);
    persist();
    markChanged();
  }

  function bulkImport(lines: string[]): { added: number; skipped: number; errors: string[] } {
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    lines.forEach((line, i) => {
      const raw = line.trim();
      if (!raw) return;
      const parts = raw.split(/[\t,，]/).map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) {
        errors.push(`第 ${i + 1} 行格式错误，需至少两列：原字,替换字`);
        return;
      }
      const [originalChar, replacedChar, dynasty, note] = parts;
      if (!originalChar || !replacedChar) {
        errors.push(`第 ${i + 1} 行缺少原字或替换字`);
        return;
      }
      if (isDuplicate(originalChar, replacedChar)) {
        skipped++;
        return;
      }
      rules.value.push({
        id: uid(),
        originalChar,
        replacedChar,
        dynasty: dynasty || undefined,
        note: note || undefined,
        enabled: true,
        createdAt: now(),
        updatedAt: now(),
      });
      added++;
    });
    if (added > 0) {
      persist();
      markChanged();
    }
    return { added, skipped, errors };
  }

  function markChanged() {
    changedSinceLastScan.value = true;
  }

  function acknowledgeChange() {
    changedSinceLastScan.value = false;
  }

  function resetSeed() {
    rules.value = SEED_RULES.map((r) => ({
      ...r,
      id: uid(),
      createdAt: now(),
      updatedAt: now(),
    }));
    persist();
    markChanged();
  }

  return {
    rules,
    enabledRules,
    changedSinceLastScan,
    load,
    addRule,
    updateRule,
    toggleEnabled,
    removeRule,
    bulkImport,
    isDuplicate,
    markChanged,
    acknowledgeChange,
    resetSeed,
  };
});
