import type {
  TextVersion,
  ChapterInfo,
  VariantEntry,
  VariantReading,
  VariantCategory,
  EvolutionPath,
  EvolutionStep,
  VariantStatistics,
  TabooRule,
} from '@/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function sliceContext(text: string, start: number, end: number, len = 15) {
  const before = text.slice(Math.max(0, start - len), start);
  const after = text.slice(end, Math.min(text.length, end + len));
  return { before, after };
}

interface LCSOp {
  type: 'equal' | 'insert' | 'delete';
  chars: string;
}

function computeLCS(a: string, b: string): LCSOp[] {
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ type: 'insert', chars: b }];
  if (n === 0) return [{ type: 'delete', chars: a }];

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: LCSOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', chars: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', chars: b[j - 1] });
      j--;
    } else {
      ops.push({ type: 'delete', chars: a[i - 1] });
      i--;
    }
  }
  ops.reverse();

  const merged: LCSOp[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.chars += op.chars;
    } else {
      merged.push({ type: op.type, chars: op.chars });
    }
  }
  return merged;
}

interface PairDiff {
  position: number;
  baseText: string;
  compText: string;
  diffType: 'replace' | 'insert' | 'delete';
  contextBefore: string;
  contextAfter: string;
}

function computePairDiff(baseText: string, compText: string): PairDiff[] {
  const ops = computeLCS(baseText, compText);
  const diffs: PairDiff[] = [];

  let posBase = 0;
  let posComp = 0;
  let pendingDel = '';
  let pendingDelStart = -1;
  let pendingIns = '';
  let pendingInsStart = -1;

  const flush = () => {
    if (pendingDel.length === 0 && pendingIns.length === 0) return;

    const startOri = pendingDelStart >= 0 ? pendingDelStart : posBase;
    const endOri = startOri + pendingDel.length;
    const startRev = pendingInsStart >= 0 ? pendingInsStart : posComp;
    const endRev = startRev + pendingIns.length;

    let diffType: 'replace' | 'insert' | 'delete';
    if (pendingDel.length > 0 && pendingIns.length > 0) diffType = 'replace';
    else if (pendingDel.length > 0) diffType = 'delete';
    else diffType = 'insert';

    const contextText = diffType === 'insert' ? compText : baseText;
    const contextStart = diffType === 'insert' ? startRev : startOri;
    const contextEnd = diffType === 'insert' ? endRev : endOri;
    const { before, after } = sliceContext(contextText, contextStart, contextEnd, 15);

    diffs.push({
      position: startOri,
      baseText: pendingDel,
      compText: pendingIns,
      diffType,
      contextBefore: before,
      contextAfter: after,
    });

    pendingDel = '';
    pendingDelStart = -1;
    pendingIns = '';
    pendingInsStart = -1;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      flush();
      posBase += op.chars.length;
      posComp += op.chars.length;
    } else if (op.type === 'delete') {
      if (pendingDelStart < 0) pendingDelStart = posBase;
      pendingDel += op.chars;
      posBase += op.chars.length;
    } else {
      if (pendingInsStart < 0) pendingInsStart = posComp;
      pendingIns += op.chars;
      posComp += op.chars.length;
    }
  }
  flush();
  return diffs;
}

interface AlignedPosition {
  baseOffset: number;
  compOffsets: Map<string, number>;
}

function buildAlignmentMap(
  baseText: string,
  versions: { id: string; text: string }[]
): Map<number, Map<string, number>> {
  const alignment = new Map<number, Map<string, number>>();

  for (let i = 0; i <= baseText.length; i++) {
    alignment.set(i, new Map());
  }

  for (const version of versions) {
    const ops = computeLCS(baseText, version.text);
    let posBase = 0;
    let posComp = 0;

    for (const op of ops) {
      if (op.type === 'equal') {
        for (let k = 0; k < op.chars.length; k++) {
          const baseMap = alignment.get(posBase + k);
          if (baseMap) baseMap.set(version.id, posComp + k);
        }
        posBase += op.chars.length;
        posComp += op.chars.length;
      } else if (op.type === 'delete') {
        for (let k = 0; k < op.chars.length; k++) {
          const baseMap = alignment.get(posBase + k);
          if (baseMap) baseMap.set(version.id, posComp);
        }
        posBase += op.chars.length;
      } else {
        posComp += op.chars.length;
      }
    }
  }

  return alignment;
}

function classifyVariant(
  baseText: string,
  compText: string,
  diffType: 'replace' | 'insert' | 'delete',
  contextBefore: string,
  contextAfter: string,
  tabooRules: TabooRule[],
  baseVersion: TextVersion,
  compVersion: TextVersion
): { category: VariantCategory; confidence: number; suspectedTabooId?: string } {
  const combinedText = baseText + compText;

  for (const rule of tabooRules) {
    if (
      (baseText.includes(rule.originalChar) && compText.includes(rule.replacedChar)) ||
      (baseText.includes(rule.replacedChar) && compText.includes(rule.originalChar))
    ) {
      return { category: 'taboo_layered', confidence: 0.85, suspectedTabooId: rule.id };
    }
  }

  if (diffType === 'delete') {
    return { category: 'missing', confidence: 0.9 };
  }

  if (diffType === 'insert') {
    return { category: 'added', confidence: 0.9 };
  }

  if (baseText.length === 1 && compText.length === 1) {
    const charPairs: Record<string, string[]> = {
      '一': ['壹', '弌'],
      '二': ['贰', '弍'],
      '三': ['叁', '弎'],
      '四': ['肆'],
      '五': ['伍'],
      '六': ['陆'],
      '七': ['柒'],
      '八': ['捌'],
      '九': ['玖'],
      '十': ['拾'],
      '于': ['於'],
      '托': ['託'],
      '嘆': ['歎'],
      '歡': ['懽'],
      '復': ['複', '覆'],
      '後': ['后'],
      '里': ['裏', '裡'],
      '面': ['麵'],
      '乾': ['干', '幹'],
    };

    for (const [std, variants] of Object.entries(charPairs)) {
      if (
        (baseText === std && variants.includes(compText)) ||
        (compText === std && variants.includes(baseText)) ||
        variants.includes(baseText) && variants.includes(compText)
      ) {
        return { category: 'orthographic', confidence: 0.75 };
      }
    }
  }

  if (baseText.length === compText.length) {
    let phoneticSimilarity = 0;
    const commonChars = [...baseText].filter((c) => compText.includes(c)).length;
    phoneticSimilarity = commonChars / Math.max(baseText.length, 1);

    if (phoneticSimilarity >= 0.5 && phoneticSimilarity < 1) {
      return { category: 'phonetic', confidence: 0.6 };
    }
  }

  const hasRattanPattern = /[抄寫謄錄刊刻雕印]/.test(
    contextBefore.slice(-5) + contextAfter.slice(0, 5)
  );
  if (hasRattanPattern) {
    return { category: 'transcription', confidence: 0.7 };
  }

  const baseDynasty = baseVersion.dynasty || '';
  const compDynasty = compVersion.dynasty || '';
  const dynastyOrder = [
    '先秦',
    '秦代',
    '汉代',
    '三国',
    '晋代',
    '南北朝',
    '隋代',
    '唐代',
    '五代',
    '宋代',
    '辽代',
    '金代',
    '元代',
    '明代',
    '清代',
    '民国',
  ];

  const baseIdx = dynastyOrder.indexOf(baseDynasty);
  const compIdx = dynastyOrder.indexOf(compDynasty);

  if (baseIdx !== -1 && compIdx !== -1 && baseIdx < compIdx) {
    return { category: 'later_revision', confidence: 0.65 };
  }

  if (baseIdx !== -1 && compIdx !== -1 && baseIdx > compIdx) {
    return { category: 'transcription', confidence: 0.65 };
  }

  return { category: 'disputed', confidence: 0.3 };
}

function buildEvolutionPath(
  variantId: string,
  variants: VariantReading[],
  versions: TextVersion[],
  relations: { sourceVersionId: string; targetVersionId: string; relationType: string }[]
): EvolutionPath | undefined {
  if (variants.length < 2) return undefined;

  const versionMap = new Map(versions.map((v) => [v.id, v]));
  const versionTexts = new Map<string, string>();

  variants.forEach((v) => {
    v.versionIds.forEach((vid) => versionTexts.set(vid, v.text));
  });

  const sortedVersions = versions
    .filter((v) => versionTexts.has(v.id))
    .sort((a, b) => {
      if (a.versionType === 'ancestor' && b.versionType !== 'ancestor') return -1;
      if (b.versionType === 'ancestor' && a.versionType !== 'ancestor') return 1;
      if (a.versionType === 'original' && b.versionType !== 'original') return -1;
      if (b.versionType === 'original' && a.versionType !== 'original') return 1;
      return 0;
    });

  const steps: EvolutionStep[] = sortedVersions.map((v, idx) => {
    const text = versionTexts.get(v.id) || '';
    let changeType: EvolutionStep['changeType'] = 'modification';

    if (idx === 0) {
      changeType = 'modification';
    } else {
      const prevText = versionTexts.get(sortedVersions[idx - 1].id) || '';
      if (text.length > prevText.length) changeType = 'addition';
      else if (text.length < prevText.length) changeType = 'deletion';
      else changeType = 'modification';
    }

    return {
      versionId: v.id,
      versionName: v.shortName,
      text,
      changeType,
    };
  });

  return {
    id: uid(),
    variantId,
    steps,
    direction: 'earlier_to_later',
    confidence: 0.6,
    establishedBy: '系统自动生成',
    establishedAt: Date.now(),
  };
}

export interface MultiVersionScanOptions {
  projectId: string;
  baseVersion: TextVersion;
  comparingVersions: TextVersion[];
  chapter?: ChapterInfo;
  tabooRules: TabooRule[];
  versionRelations: { sourceVersionId: string; targetVersionId: string; relationType: string }[];
  scannedBy: string;
}

export function scanMultiVersionVariants(
  options: MultiVersionScanOptions
): { variants: VariantEntry[]; statistics: VariantStatistics } {
  const {
    projectId,
    baseVersion,
    comparingVersions,
    chapter,
    tabooRules,
    versionRelations,
    scannedBy,
  } = options;

  const variants: VariantEntry[] = [];
  const allVersions = [baseVersion, ...comparingVersions];

  let baseText = baseVersion.fullText;
  let startOffset = 0;

  if (chapter) {
    baseText = baseVersion.fullText.slice(chapter.startOffset, chapter.endOffset);
    startOffset = chapter.startOffset;
  }

  const compTexts = comparingVersions.map((v) => {
    let text = v.fullText;
    if (chapter) {
      const vChapter = v.chapters.find(
        (c) => c.title === chapter.title || Math.abs(c.order - chapter.order) <= 1
      );
      if (vChapter) {
        text = v.fullText.slice(vChapter.startOffset, vChapter.endOffset);
      }
    }
    return { id: v.id, text, version: v };
  });

  const versionMap = new Map(allVersions.map((v) => [v.id, v]));

  const positionVariants = new Map<
    string,
    {
      position: number;
      readings: Map<string, string[]>;
      contextBefore: string;
      contextAfter: string;
    }
  >();

  for (const comp of compTexts) {
    const pairDiffs = computePairDiff(baseText, comp.text);

    for (const diff of pairDiffs) {
      const locationKey = `${chapter?.id || 'full'}_${diff.position + startOffset}`;

      if (!positionVariants.has(locationKey)) {
        positionVariants.set(locationKey, {
          position: diff.position + startOffset,
          readings: new Map(),
          contextBefore: diff.contextBefore,
          contextAfter: diff.contextAfter,
        });
      }

      const posVar = positionVariants.get(locationKey)!;

      const baseReading = diff.baseText || '（缺）';
      const compReading = diff.compText || '（缺）';

      if (!posVar.readings.has(baseReading)) {
        posVar.readings.set(baseReading, []);
      }
      if (!posVar.readings.get(baseReading)!.includes(baseVersion.id)) {
        posVar.readings.get(baseReading)!.push(baseVersion.id);
      }

      if (!posVar.readings.has(compReading)) {
        posVar.readings.set(compReading, []);
      }
      if (!posVar.readings.get(compReading)!.includes(comp.id)) {
        posVar.readings.get(compReading)!.push(comp.id);
      }
    }
  }

  for (const [locationKey, posVar] of positionVariants) {
    const readings: VariantReading[] = [];
    let baseReadingText = '';

    for (const [text, versionIds] of posVar.readings) {
      const isBase = versionIds.includes(baseVersion.id);
      if (isBase) baseReadingText = text;
      readings.push({
        text,
        versionIds,
        isBaseReading: isBase,
      });
    }

    let bestClassification: {
      category: VariantCategory;
      confidence: number;
      suspectedTabooId?: string;
    } = { category: 'disputed', confidence: 0.3 };

    for (const reading of readings) {
      if (reading.isBaseReading) continue;

      const compVersionId = reading.versionIds.find((vid) => vid !== baseVersion.id);
      if (!compVersionId) continue;

      const compVersion = versionMap.get(compVersionId);
      if (!compVersion) continue;

      const classification = classifyVariant(
        baseReadingText,
        reading.text,
        reading.text === '（缺）'
          ? 'delete'
          : baseReadingText === '（缺）'
          ? 'insert'
          : 'replace',
        posVar.contextBefore,
        posVar.contextAfter,
        tabooRules,
        baseVersion,
        compVersion
      );

      if (classification.confidence > bestClassification.confidence) {
        bestClassification = classification;
      }
    }

    const variant: VariantEntry = {
      id: uid(),
      projectId,
      chapterId: chapter?.id,
      chapterTitle: chapter?.title,
      locationKey,
      contextBefore: posVar.contextBefore,
      contextAfter: posVar.contextAfter,
      variants: readings,
      category: bestClassification.category,
      categoryConfidence: bestClassification.confidence,
      suspectedTabooId: bestClassification.suspectedTabooId,
      suspectedTaboo: bestClassification.suspectedTabooId
        ? tabooRules.find((r) => r.id === bestClassification.suspectedTabooId)
        : undefined,
      acceptance: 'needs_review',
      citations: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      discoveredBy: scannedBy,
    };

    variant.evolutionPath = buildEvolutionPath(
      variant.id,
      readings,
      allVersions,
      versionRelations
    );

    variants.push(variant);
  }

  const statistics: VariantStatistics = {
    byCategory: {
      transcription: 0,
      taboo_layered: 0,
      later_revision: 0,
      orthographic: 0,
      phonetic: 0,
      missing: 0,
      added: 0,
      disputed: 0,
    },
    byAcceptance: {
      accepted: 0,
      rejected: 0,
      tentative: 0,
      needs_review: 0,
    },
    byChapter: {},
    tabooLayeredCount: 0,
    laterRevisionCount: 0,
    transcriptionCount: 0,
    disputedCount: 0,
  };

  for (const variant of variants) {
    statistics.byCategory[variant.category]++;
    statistics.byAcceptance[variant.acceptance]++;

    if (variant.chapterId) {
      statistics.byChapter[variant.chapterId] =
        (statistics.byChapter[variant.chapterId] || 0) + 1;
    }

    if (variant.category === 'taboo_layered') statistics.tabooLayeredCount++;
    if (variant.category === 'later_revision') statistics.laterRevisionCount++;
    if (variant.category === 'transcription') statistics.transcriptionCount++;
    if (variant.category === 'disputed') statistics.disputedCount++;
  }

  return { variants, statistics };
}

export function autoAcceptVariants(
  variants: VariantEntry[],
  options: {
    minConfidence: number;
    preferEarlierVersions: boolean;
    preferMajorityReading: boolean;
  }
): VariantEntry[] {
  return variants.map((variant) => {
    if (variant.categoryConfidence >= options.minConfidence) {
      let acceptedReading: string | undefined;
      let acceptedVersionId: string | undefined;

      if (options.preferMajorityReading) {
        const sortedReadings = [...variant.variants].sort(
          (a, b) => b.versionIds.length - a.versionIds.length
        );
        const majority = sortedReadings[0];
        acceptedReading = majority.text;
        acceptedVersionId = majority.versionIds[0];
      }

      if (!acceptedReading) {
        const baseReading = variant.variants.find((r) => r.isBaseReading);
        if (baseReading) {
          acceptedReading = baseReading.text;
          acceptedVersionId = baseReading.versionIds[0];
        }
      }

      return {
        ...variant,
        acceptance: 'tentative' as const,
        acceptedReading,
        acceptedVersionId,
        updatedAt: Date.now(),
      };
    }
    return variant;
  });
}
