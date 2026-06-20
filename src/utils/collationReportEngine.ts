import type {
  CollationReport,
  CollationAppendix,
  TextVersion,
  VersionTreeNode,
  VersionRelation,
  VariantEntry,
  VariantStatistics,
  VariantReading,
  EvolutionPath,
  EvolutionStep,
  VariantCategory,
  AcceptanceStatus,
  CitationEntry,
} from '@/types';
import {
  VARIANT_CATEGORY_META,
  ACCEPTANCE_META,
  VERSION_TYPE_META,
  CITATION_TYPE_META,
  CREDIBILITY_META,
} from '@/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CollationReportOptions {
  projectId: string;
  projectName: string;
  projectDynasty: string;
  projectBookTitle: string;
  projectVolume: string;
  versions: TextVersion[];
  versionTree: VersionTreeNode[];
  versionRelations: VersionRelation[];
  variants: VariantEntry[];
  statistics: VariantStatistics;
  generatedBy: string;
  collationPrinciples?: string;
  citations?: CitationEntry[];
}

export function generateCollationReport(options: CollationReportOptions): CollationReport {
  const {
    projectId,
    projectName,
    projectDynasty,
    projectBookTitle,
    projectVolume,
    versions,
    versionTree,
    versionRelations,
    variants,
    statistics,
    generatedBy,
    collationPrinciples,
    citations,
  } = options;

  const acceptedVariants = variants.filter((v) => v.acceptance === 'accepted' || v.acceptance === 'tentative');

  const appendices: CollationAppendix[] = [];

  if (citations && citations.length > 0) {
    const bibContent = generateBibliography(citations);
    appendices.push({
      id: uid(),
      title: '参考文献',
      type: 'bibliography',
      content: bibContent,
    });
  }

  const glossaryContent = generateGlossary();
  appendices.push({
    id: uid(),
    title: '术语表',
    type: 'glossary',
    content: glossaryContent,
  });

  const summary = generateSummary(
    projectName,
    projectDynasty,
    projectBookTitle,
    projectVolume,
    versions,
    variants,
    statistics
  );

  return {
    id: uid(),
    projectId,
    generatedAt: Date.now(),
    generatedBy,
    title: `${projectDynasty}《${projectBookTitle}》卷${projectVolume} 校勘报告`,
    summary,
    versions,
    versionTree,
    versionRelations,
    variantStatistics: statistics,
    variants,
    acceptedVariants,
    collationPrinciples,
    appendices,
  };
}

function generateSummary(
  projectName: string,
  dynasty: string,
  bookTitle: string,
  volume: string,
  versions: TextVersion[],
  variants: VariantEntry[],
  statistics: VariantStatistics
): string {
  const totalVariants = variants.length;
  const accepted = statistics.byAcceptance.accepted + statistics.byAcceptance.tentative;
  const tabooCount = statistics.tabooLayeredCount;
  const revisionCount = statistics.laterRevisionCount;
  const transcriptionCount = statistics.transcriptionCount;

  const versionList = versions.map((v) => v.shortName).join('、');

  return `本报告针对${dynasty}《${bookTitle}》卷${volume}的${versions.length}个版本（${versionList}）进行了全面校勘。

共发现异文 ${totalVariants} 处，其中已采信 ${accepted} 处，待复核 ${statistics.byAcceptance.needs_review} 处。

按异文类型统计：
· 避讳层累：${tabooCount} 处
· 后出改字：${revisionCount} 处
· 传抄异文：${transcriptionCount} 处
· 字形变异：${statistics.byCategory.orthographic} 处
· 音近通假：${statistics.byCategory.phonetic} 处
· 脱文：${statistics.byCategory.missing} 处
· 衍文：${statistics.byCategory.added} 处
· 存疑待考：${statistics.disputedCount} 处

报告包含完整的版本谱系分析、异文逐条考辨及采择依据，为研究人员提供系统的校勘学依据。`;
}

function generateBibliography(citations: CitationEntry[]): string {
  const lines: string[] = [];
  const sorted = [...citations].sort((a, b) => {
    const order: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 };
    return order[a.credibility] - order[b.credibility];
  });

  sorted.forEach((c, idx) => {
    const parts: string[] = [];
    parts.push(`[${idx + 1}]`);
    if (c.author) parts.push(c.author + '，');
    if (c.dynasty) parts.push('（' + c.dynasty + '）');
    parts.push(c.title + '。');
    if (c.source) parts.push(c.source);
    if (c.volume) parts.push('，' + c.volume);
    if (c.page) parts.push('，第' + c.page + '页');
    parts.push('。');
    lines.push(parts.join(''));
    lines.push(`    【${CREDIBILITY_META[c.credibility].label}】${CITATION_TYPE_META[c.citationType].label}`);
  });

  return lines.join('\n');
}

function generateGlossary(): string {
  const terms: { term: string; definition: string }[] = [
    { term: '底本', definition: '作为校勘基准的版本，通常选用最早或最善之本。' },
    { term: '祖本', definition: '某一书最早的刻本或写本，为后世各本所从出之本。' },
    { term: '传本', definition: '从祖本衍生出的历代传抄或刻印版本。' },
    { term: '避讳层累', definition: '不同历史时期因避讳制度对文本产生的叠加性改字。' },
    { term: '后出改字', definition: '后世整理者、刊刻者对前代文本所作的改动。' },
    { term: '传抄异文', definition: '在传抄过程中产生的文字差异。' },
    { term: '脱文', definition: '版本中缺少的文字，又称夺文。' },
    { term: '衍文', definition: '版本中多出的文字。' },
    { term: '字形变异', definition: '同一字的不同写法，包括异体字、古今字、俗字等。' },
    { term: '音近通假', definition: '因读音相近或相同而借用的字。' },
  ];

  return terms.map((t) => `【${t.term}】${t.definition}`).join('\n\n');
}

export function generateCollationReportJSON(report: CollationReport): string {
  return JSON.stringify(
    {
      ...report,
    },
    null,
    2
  );
}

export function generateCollationReportTXT(report: CollationReport): string {
  const lines: string[] = [];
  const dt = new Date(report.generatedAt);

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('           古 籍 版 本 对 读 校 勘 报 告');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`报告标题：${report.title}`);
  lines.push(`生成时间：${formatDate(report.generatedAt)}`);
  lines.push(`编制者：${report.generatedBy}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    一、摘  要');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  report.summary.split('\n').forEach((l) => lines.push(l));
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    二、版 本 目 录');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  report.versions.forEach((v, idx) => {
    lines.push(`版本 ${idx + 1}：${v.name}（${v.shortName}）`);
    lines.push(`  · 类型：${VERSION_TYPE_META[v.versionType].label}`);
    if (v.dynasty) lines.push(`  · 朝代：${v.dynasty}`);
    if (v.era) lines.push(`  · 时代：${v.era}`);
    if (v.provenance) lines.push(`  · 来源：${v.provenance}`);
    if (v.repository) lines.push(`  · 藏馆：${v.repository}`);
    if (v.shelfMark) lines.push(`  · 索书号：${v.shelfMark}`);
    if (v.scribe) lines.push(`  · 抄手/刊刻者：${v.scribe}`);
    if (v.transcriptionYear) lines.push(`  · 刊刻年代：${v.transcriptionYear}`);
    if (v.collationNote) lines.push(`  · 校勘说明：${v.collationNote}`);
    lines.push(`  · 章节数：${v.chapters.length} 章，共 ${v.fullText.length} 字`);
    lines.push('');
  });

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    三、版 本 谱 系');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(generateVersionTreeText(report.versionTree));
  lines.push('');

  if (report.collationPrinciples) {
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    四、校 勘 凡 例');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');
    report.collationPrinciples.split('\n').forEach((l) => lines.push(l));
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    五、异 文 统 计');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  const stats = report.variantStatistics;
  lines.push(`异文总数：${report.variants.length} 处`);
  lines.push('');
  lines.push('── 按异文类型 ──');
  lines.push(`  · 传抄异文：${stats.byCategory.transcription} 处`);
  lines.push(`  · 避讳层累：${stats.byCategory.taboo_layered} 处`);
  lines.push(`  · 后出改字：${stats.byCategory.later_revision} 处`);
  lines.push(`  · 字形变异：${stats.byCategory.orthographic} 处`);
  lines.push(`  · 音近通假：${stats.byCategory.phonetic} 处`);
  lines.push(`  · 脱  文：${stats.byCategory.missing} 处`);
  lines.push(`  · 衍  文：${stats.byCategory.added} 处`);
  lines.push(`  · 存疑待考：${stats.byCategory.disputed} 处`);
  lines.push('');
  lines.push('── 按采信状态 ──');
  lines.push(`  · 采  信：${stats.byAcceptance.accepted} 处`);
  lines.push(`  · 不采信：${stats.byAcceptance.rejected} 处`);
  lines.push(`  · 暂  定：${stats.byAcceptance.tentative} 处`);
  lines.push(`  · 待复核：${stats.byAcceptance.needs_review} 处`);
  lines.push('');
  lines.push('── 关键指标 ──');
  lines.push(`  · 避讳层累：${stats.tabooLayeredCount} 处`);
  lines.push(`  · 后出改字：${stats.laterRevisionCount} 处`);
  lines.push(`  · 传抄异文：${stats.transcriptionCount} 处`);
  lines.push(`  · 存疑待考：${stats.disputedCount} 处`);
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('                    六、异 文 考 辨');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  report.variants.forEach((variant, idx) => {
    lines.push(`【异文 ${idx + 1}】${variant.chapterTitle ? `（${variant.chapterTitle}）` : ''}`);
    lines.push(`类型：${VARIANT_CATEGORY_META[variant.category].label}｜置信度：${Math.round(variant.categoryConfidence * 100)}%`);
    lines.push(`状态：${ACCEPTANCE_META[variant.acceptance].label}`);
    lines.push('');
    lines.push('── 上 下 文 ──');
    lines.push(`    前：${variant.contextBefore || '（无）'}`);
    lines.push(`    后：${variant.contextAfter || '（无）'}`);
    lines.push('');
    lines.push('── 各 版 本 读 法 ──');
    variant.variants.forEach((reading, ridx) => {
      const versionNames = reading.versionIds
        .map((vid) => {
          const v = report.versions.find((x) => x.id === vid);
          return v ? v.shortName : '未知版本';
        })
        .join('、');
      lines.push(`  [${ridx + 1}] "${reading.text}" —— ${versionNames}${reading.isBaseReading ? '（底本读法）' : ''}`);
    });
    lines.push('');

    if (variant.acceptedReading) {
      lines.push('── 采 择 结 论 ──');
      const acceptedVersion = variant.acceptedVersionId
        ? report.versions.find((v) => v.id === variant.acceptedVersionId)
        : null;
      lines.push(`    采信读法："${variant.acceptedReading}"${acceptedVersion ? `（${acceptedVersion.shortName}）` : ''}`);
      if (variant.researcherNote) {
        lines.push(`    考辨依据：${variant.researcherNote}`);
      }
      if (variant.collationNote) {
        lines.push(`    校勘记：${variant.collationNote}`);
      }
      lines.push('');
    }

    if (variant.suspectedTaboo) {
      lines.push('── 相 关 避 讳 规 则 ──');
      lines.push(`    ${variant.suspectedTaboo.originalChar} → ${variant.suspectedTaboo.replacedChar}${variant.suspectedTaboo.dynasty ? `（${variant.suspectedTaboo.dynasty}）` : ''}`);
      if (variant.suspectedTaboo.note) lines.push(`    说明：${variant.suspectedTaboo.note}`);
      lines.push('');
    }

    if (variant.evolutionPath && variant.evolutionPath.steps.length > 1) {
      lines.push('── 演 变 路 径 ──');
      lines.push(generateEvolutionPathText(variant.evolutionPath));
      lines.push('');
    }

    lines.push('─────────────────────────────────────────────────────────');
    lines.push('');
  });

  if (report.appendices && report.appendices.length > 0) {
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    七、附  录');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');

    report.appendices.forEach((appendix) => {
      lines.push(`── ${appendix.title} ──`);
      lines.push('');
      appendix.content.split('\n').forEach((l) => lines.push(l));
      lines.push('');
    });
  }

  lines.push('');
  lines.push('（本报告由古籍文本避讳校验系统自动生成）');

  return lines.join('\n');
}

function generateVersionTreeText(tree: VersionTreeNode[]): string {
  if (tree.length === 0) return '（暂无版本谱系数据）';

  const lines: string[] = [];
  const nodeMap = new Map(tree.map((n) => [n.versionId, n]));
  const rootNodes = tree.filter((n) => n.parentId === null);

  function printNode(node: VersionTreeNode, prefix: string, isLast: boolean) {
    const connector = isLast ? '└── ' : '├── ';
    const version = node.version;
    lines.push(
      `${prefix}${connector}${version.shortName}（${VERSION_TYPE_META[version.versionType].label}）`
    );

    if (version.dynasty) {
      lines.push(`${prefix}${isLast ? '    ' : '│   '}${version.dynasty}${version.era ? ` · ${version.era}` : ''}`);
    }

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const children = node.children
      .map((cid) => tree.find((n) => n.id === cid))
      .filter(Boolean) as VersionTreeNode[];

    children.forEach((child, idx) => {
      printNode(child, childPrefix, idx === children.length - 1);
    });
  }

  rootNodes.forEach((root, idx) => {
    printNode(root, '', idx === rootNodes.length - 1);
  });

  return lines.join('\n');
}

function generateEvolutionPathText(path: EvolutionPath): string {
  const lines: string[] = [];
  const directionLabel =
    path.direction === 'earlier_to_later'
      ? '（由早到晚）'
      : path.direction === 'later_to_earlier'
      ? '（由晚到早）'
      : '（方向未定）';

  lines.push(`    演变方向：${directionLabel}｜置信度：${Math.round(path.confidence * 100)}%`);
  lines.push('');

  path.steps.forEach((step, idx) => {
    const arrow = idx < path.steps.length - 1 ? ' ↓' : '';
    const changeTypeLabel: Record<EvolutionStep['changeType'], string> = {
      addition: '【增】',
      deletion: '【删】',
      modification: '【改】',
      taboo: '【避讳改字】',
      correction: '【校正】',
    };

    lines.push(`    [${idx + 1}] ${changeTypeLabel[step.changeType]} ${step.versionName}："${step.text}"`);
    if (step.rationale) {
      lines.push(`         ${step.rationale}`);
    }
    if (idx < path.steps.length - 1) {
      lines.push(`         ${arrow}`);
    }
  });

  return lines.join('\n');
}

export function generateVariantReadingText(reading: VariantReading, versions: TextVersion[]): string {
  const versionNames = reading.versionIds
    .map((vid) => versions.find((v) => v.id === vid)?.shortName || '未知')
    .join('、');
  return `"${reading.text}"（${versionNames}）`;
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
