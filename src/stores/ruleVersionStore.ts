import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { RuleVersion, TabooRule, DiffEntry } from '@/types';

const VERSION_KEY = 'ancientscrutiny_rule_versions_v1';

function uid(prefix = 'v') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useRuleVersionStore = defineStore('ruleVersion', () => {
  const versions = ref<RuleVersion[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(VERSION_KEY);
      if (raw) {
        versions.value = JSON.parse(raw);
      }
    } catch {
      versions.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(VERSION_KEY, JSON.stringify(versions.value));
  }

  function recordVersion(
    rule: TabooRule,
    changeType: 'create' | 'update' | 'delete',
    changedBy: string = '本地用户',
    changeNote?: string,
  ) {
    const versionNum = getNextVersionNumber(rule.id, changeType);
    const version: RuleVersion = {
      id: uid('rv'),
      version: versionNum,
      ruleId: rule.id,
      originalChar: rule.originalChar,
      replacedChar: rule.replacedChar,
      dynasty: rule.dynasty,
      note: rule.note,
      enabled: rule.enabled,
      changeType,
      changedBy,
      changeNote,
      createdAt: now(),
    };
    versions.value.push(version);
    persist();
    return version;
  }

  function getNextVersionNumber(ruleId: string, changeType: string): string {
    const ruleVersions = versions.value
      .filter((v) => v.ruleId === ruleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const count = ruleVersions.length + 1;
    const typePrefix = changeType === 'create' ? 'v' : changeType === 'delete' ? 'd' : 'u';
    return `${typePrefix}${count}`;
  }

  function getRuleVersions(ruleId: string): RuleVersion[] {
    return versions.value
      .filter((v) => v.ruleId === ruleId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function getVersionById(id: string): RuleVersion | undefined {
    return versions.value.find((v) => v.id === id);
  }

  function compareVersions(
    v1: RuleVersion,
    v2: RuleVersion,
  ): {
    originalCharChanged: boolean;
    replacedCharChanged: boolean;
    dynastyChanged: boolean;
    noteChanged: boolean;
    enabledChanged: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    const originalCharChanged = v1.originalChar !== v2.originalChar;
    const replacedCharChanged = v1.replacedChar !== v2.replacedChar;
    const dynastyChanged = (v1.dynasty || '') !== (v2.dynasty || '');
    const noteChanged = (v1.note || '') !== (v2.note || '');
    const enabledChanged = v1.enabled !== v2.enabled;

    if (originalCharChanged) changes.push(`原字: ${v1.originalChar} → ${v2.originalChar}`);
    if (replacedCharChanged) changes.push(`替换字: ${v1.replacedChar} → ${v2.replacedChar}`);
    if (dynastyChanged) changes.push(`朝代: ${v1.dynasty || '无'} → ${v2.dynasty || '无'}`);
    if (noteChanged) changes.push('备注已变更');
    if (enabledChanged) changes.push(`状态: ${v1.enabled ? '启用' : '禁用'} → ${v2.enabled ? '启用' : '禁用'}`);

    return {
      originalCharChanged,
      replacedCharChanged,
      dynastyChanged,
      noteChanged,
      enabledChanged,
      changes,
    };
  }

  function analyzeImpact(
    oldRule: TabooRule,
    newRule: Partial<TabooRule>,
    entries: DiffEntry[],
  ): {
    affectedCount: number;
    affectedEntries: DiffEntry[];
    impactLevel: 'low' | 'medium' | 'high';
    details: string[];
  } {
    const affectedEntries = entries.filter((e) => e.matchedRuleId === oldRule.id);
    const affectedCount = affectedEntries.length;
    const details: string[] = [];

    let impactLevel: 'low' | 'medium' | 'high' = 'low';

    if (newRule.originalChar !== undefined && newRule.originalChar !== oldRule.originalChar) {
      details.push(`原字从「${oldRule.originalChar}」改为「${newRule.originalChar}」`);
      impactLevel = 'high';
    }
    if (newRule.replacedChar !== undefined && newRule.replacedChar !== oldRule.replacedChar) {
      details.push(`替换字从「${oldRule.replacedChar}」改为「${newRule.replacedChar}」`);
      impactLevel = 'high';
    }
    if (newRule.enabled !== undefined && newRule.enabled !== oldRule.enabled) {
      details.push(newRule.enabled ? '规则将被启用' : '规则将被禁用');
      impactLevel = affectedCount > 5 ? 'high' : 'medium';
    }
    if (newRule.dynasty !== undefined && newRule.dynasty !== oldRule.dynasty) {
      details.push(`朝代从「${oldRule.dynasty || '无'}」改为「${newRule.dynasty || '无'}」`);
      if (impactLevel === 'low') impactLevel = 'low';
    }

    if (affectedCount > 0) {
      details.unshift(`将影响 ${affectedCount} 条已匹配的差异条目`);
    }

    if (affectedCount > 10) impactLevel = 'high';
    else if (affectedCount > 3) impactLevel = 'medium';

    return {
      affectedCount,
      affectedEntries,
      impactLevel,
      details,
    };
  }

  const totalVersions = computed(() => versions.value.length);

  function clearVersions() {
    versions.value = [];
    persist();
  }

  return {
    versions,
    initialized,
    totalVersions,
    load,
    recordVersion,
    getRuleVersions,
    getVersionById,
    compareVersions,
    analyzeImpact,
    clearVersions,
  };
});
