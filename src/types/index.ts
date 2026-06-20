export interface TabooRule {
  id: string;
  originalChar: string;
  replacedChar: string;
  dynasty?: string;
  note?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type JudgmentType = 'taboo' | 'error' | 'variant' | 'pending' | null;

export type DiffType = 'replace' | 'insert' | 'delete';

export interface DiffEntry {
  id: string;
  startInOriginal: number;
  endInOriginal: number;
  startInRevised: number;
  endInRevised: number;
  originalText: string;
  revisedText: string;
  diffType: DiffType;
  matchedRuleId?: string;
  matchedRule?: TabooRule;
  judgment: JudgmentType;
  judgmentNote?: string;
  contextBefore: string;
  contextAfter: string;
}

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'stale';

export interface VerificationReport {
  generatedAt: number;
  originalSummary: string;
  revisedSummary: string;
  totalDiffs: number;
  statistics: {
    taboo: number;
    error: number;
    variant: number;
    pending: number;
  };
  judgments: DiffEntry[];
}

export const JUDGMENT_META: Record<
  Exclude<JudgmentType, null>,
  { label: string; cls: string; tagCls: string; hlCls: string }
> = {
  taboo: {
    label: '避讳',
    cls: 'text-ink border-rattan bg-rattan/50',
    tagCls: 'tag-taboo',
    hlCls: 'hl-taboo',
  },
  variant: {
    label: '异体',
    cls: 'text-azure border-azure/40 bg-azure/10',
    tagCls: 'tag-variant',
    hlCls: 'hl-variant',
  },
  error: {
    label: '误改',
    cls: 'text-carmine border-carmine/40 bg-carmine/10',
    tagCls: 'tag-error',
    hlCls: 'hl-error',
  },
  pending: {
    label: '待定',
    cls: 'text-moss border-moss/40 bg-moss/10',
    tagCls: 'tag-pending',
    hlCls: 'hl-pending',
  },
};
