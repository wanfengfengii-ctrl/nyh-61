import type { VerificationReport, DiffEntry, JudgmentType } from '@/types';
import { JUDGMENT_META } from '@/types';

const JUDGMENT_LABEL: Record<Exclude<JudgmentType, null>, string> = {
  taboo: '避  讳',
  variant: '异  体',
  error: '误  改',
  pending: '待  定',
};

export function generateReportJSON(report: VerificationReport): string {
  return JSON.stringify(
    {
      ...report,
      generatedAtISO: new Date(report.generatedAt).toISOString(),
    },
    null,
    2,
  );
}

function diffTypeLabel(t: DiffEntry['diffType']) {
  return t === 'replace' ? '替换' : t === 'delete' ? '删除' : '插入';
}

export function generateReportTXT(report: VerificationReport): string {
  const lines: string[] = [];
  const dt = new Date(report.generatedAt);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('           古 籍 文 本 避 讳 校 验 报 告');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`生成时间：${dt.toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push(`── 摘  要 ──`);
  lines.push(`原文摘要：${report.originalSummary}`);
  lines.push(`校改摘要：${report.revisedSummary}`);
  lines.push('');
  lines.push(`── 统  计 ──`);
  lines.push(`差异总数：${report.totalDiffs}`);
  lines.push(`  · 避  讳：${report.statistics.taboo}`);
  lines.push(`  · 误  改：${report.statistics.error}`);
  lines.push(`  · 异  体：${report.statistics.variant}`);
  lines.push(`  · 待  定：${report.statistics.pending}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    差 异 条 目 详 情');
  lines.push('═══════════════════════════════════════════════════════════');

  report.judgments.forEach((d, idx) => {
    const j = d.judgment ?? 'pending';
    lines.push('');
    lines.push(`【第 ${idx + 1} 处】（${diffTypeLabel(d.diffType)}） 判断：${JUDGMENT_LABEL[j as Exclude<JudgmentType, null>] || '待定'}`);
    lines.push(`── 上 下 文 ──`);
    lines.push(`    前：${d.contextBefore || '（无）'}`);
    lines.push(`    后：${d.contextAfter || '（无）'}`);
    lines.push(`── 原  文 [${d.startInOriginal + 1} - ${d.endInOriginal}] ──`);
    lines.push(`    【${d.originalText || '（空）'}】`);
    lines.push(`── 校 改 文 [${d.startInRevised + 1} - ${d.endInRevised}] ──`);
    lines.push(`    【${d.revisedText || '（空）'}】`);
    if (d.matchedRule) {
      lines.push(`── 匹配避讳规则 ──`);
      lines.push(`    ${d.matchedRule.originalChar} → ${d.matchedRule.replacedChar}${d.matchedRule.dynasty ? ` （${d.matchedRule.dynasty}）` : ''}`);
      if (d.matchedRule.note) lines.push(`    备注：${d.matchedRule.note}`);
    } else {
      lines.push(`── 匹配避讳规则 ── （无）`);
    }
    lines.push(`── 判断依据/备注 ──`);
    lines.push(`    ${d.judgmentNote?.trim() || '（未填写）'}`);
    lines.push('─────────────────────────────────────────────────────────');
  });

  lines.push('');
  lines.push('（本报告由古籍文本避讳校验系统自动生成）');
  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function judgmentLabel(j: JudgmentType) {
  if (!j) return '未判断';
  return JUDGMENT_META[j].label;
}

export function judgmentTagCls(j: JudgmentType) {
  if (!j) return 'tag-unjudged';
  return JUDGMENT_META[j].tagCls;
}

export function judgmentHlCls(j: JudgmentType) {
  if (!j) return 'hl-pending';
  return JUDGMENT_META[j].hlCls;
}
