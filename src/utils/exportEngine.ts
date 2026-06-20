import type { VerificationReport, DiffEntry, JudgmentType, CitationEntry, CitationDiffLink } from '@/types';
import { JUDGMENT_META, CITATION_TYPE_META, CREDIBILITY_META } from '@/types';

const JUDGMENT_LABEL: Record<Exclude<JudgmentType, null>, string> = {
  taboo: '避  讳',
  variant: '异  体',
  error: '误  改',
  pending: '待  定',
};

const CITATION_TYPE_LABEL = {
  taboo_literature: '避讳制度文献',
  collation_note: '校勘记',
  version_excerpt: '历代版本摘录',
  image_page: '图像页码',
};

const CREDIBILITY_LABEL = {
  primary: '一级',
  secondary: '二级',
  tertiary: '三级',
};

function getCredibilityShield(cred: string) {
  if (cred === 'primary') return '★★★';
  if (cred === 'secondary') return '★★☆';
  return '★☆☆';
}

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

  const citationLinks = report.citationLinks || [];
  const citations = report.citations || [];

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

    const diffLinks = citationLinks.filter((l) => l.diffEntryId === d.id);
    if (diffLinks.length > 0) {
      lines.push(`── 典籍依据（${diffLinks.length} 条）──`);
      diffLinks.forEach((link, linkIdx) => {
        const citation = citations.find((c) => c.id === link.citationId);
        if (citation) {
          lines.push(`    [${linkIdx + 1}] ${citation.title}`);
          lines.push(`        类型：${CITATION_TYPE_LABEL[citation.citationType]}｜可信度：${CREDIBILITY_LABEL[citation.credibility]} ${getCredibilityShield(citation.credibility)}`);
          lines.push(`        来源：${citation.source}${citation.page ? `｜页码：${citation.page}` : ''}`);
          if (citation.author) lines.push(`        作者：${citation.author}${citation.dynasty ? `｜朝代：${citation.dynasty}` : ''}`);
          if (link.relevanceNote) lines.push(`        关联说明：${link.relevanceNote}`);
          const contentLines = citation.content.split('\n');
          lines.push(`        引文：`);
          contentLines.forEach((cl) => lines.push(`          ${cl}`));
        }
      });
    }
    lines.push('─────────────────────────────────────────────────────────');
  });

  if (citations.length > 0) {
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    引 用 清 单');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`共收录典籍依据 ${citations.length} 条，按可信度排序：`);
    lines.push('');

    const sortedCitations = [...citations].sort((a, b) => {
      const order: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 };
      return order[a.credibility] - order[b.credibility];
    });

    sortedCitations.forEach((c, idx) => {
      lines.push(`[${idx + 1}] ${c.title}`);
      lines.push(`    ${getCredibilityShield(c.credibility)} ${CREDIBILITY_LABEL[c.credibility]}｜${CITATION_TYPE_LABEL[c.citationType]}`);
      const sourceParts: string[] = [];
      if (c.author) sourceParts.push(c.author);
      if (c.dynasty) sourceParts.push(c.dynasty);
      if (c.source) sourceParts.push(c.source);
      if (c.volume) sourceParts.push(c.volume);
      if (c.page) sourceParts.push(`第${c.page}页`);
      lines.push(`    ${sourceParts.join(' · ')}`);
      const linkedCount = citationLinks.filter((l) => l.citationId === c.id).length;
      if (linkedCount > 0) {
        lines.push(`    关联差异条目：${linkedCount} 处`);
      }
      lines.push('');
    });
  }

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
