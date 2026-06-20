import type { DiffEntry, TabooRule } from '@/types';

export function matchRulesToDiffs(diffs: DiffEntry[], rules: TabooRule[]): DiffEntry[] {
  const enabledRules = rules.filter((r) => r.enabled);
  return diffs.map((d) => {
    let matched: TabooRule | undefined;
    for (const rule of enabledRules) {
      const oriHit =
        d.originalText.includes(rule.originalChar) ||
        d.revisedText.includes(rule.originalChar);
      const repHit =
        d.originalText.includes(rule.replacedChar) ||
        d.revisedText.includes(rule.replacedChar);
      const directional =
        (d.diffType === 'replace' || d.diffType === 'delete' ? d.originalText === rule.originalChar : false) &&
        (d.diffType === 'replace' || d.diffType === 'insert' ? d.revisedText === rule.replacedChar : false);
      const reverse =
        d.diffType === 'replace' &&
        d.originalText === rule.replacedChar &&
        d.revisedText === rule.originalChar;
      if (directional || (oriHit && repHit) || reverse) {
        matched = rule;
        break;
      }
    }
    return {
      ...d,
      matchedRuleId: matched?.id,
      matchedRule: matched ? { ...matched } : undefined,
    };
  });
}
