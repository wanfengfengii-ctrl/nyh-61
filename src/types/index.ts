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

export interface RuleVersion {
  id: string;
  version: string;
  ruleId: string;
  originalChar: string;
  replacedChar: string;
  dynasty?: string;
  note?: string;
  enabled: boolean;
  changeType: 'create' | 'update' | 'delete';
  changedBy: string;
  changeNote?: string;
  createdAt: number;
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

export interface Project {
  id: string;
  name: string;
  dynasty: string;
  bookTitle: string;
  volume: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  status: 'active' | 'archived' | 'completed';
  currentScanId?: string;
  ruleVersionTag?: string;
}

export interface ScanHistory {
  id: string;
  projectId: string;
  scannedAt: number;
  scannedBy: string;
  ruleVersionTag?: string;
  totalDiffs: number;
  statistics: {
    taboo: number;
    error: number;
    variant: number;
    pending: number;
    unjudged: number;
  };
  originalText?: string;
  revisedText?: string;
  entries: DiffEntry[];
  note?: string;
}

export interface Annotation {
  id: string;
  diffEntryId: string;
  projectId: string;
  author: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  replyTo?: string;
}

export type ReviewStatus = 'draft' | 'pending_review' | 'reviewed' | 'approved' | 'rejected';

export interface ReviewFlow {
  id: string;
  diffEntryId: string;
  projectId: string;
  status: ReviewStatus;
  assignedTo?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  reviewHistory: ReviewAction[];
}

export interface ReviewAction {
  id: string;
  action: 'submit' | 'review' | 'approve' | 'reject' | 'reassign' | 'comment';
  actor: string;
  comment?: string;
  timestamp: number;
  fromStatus: ReviewStatus;
  toStatus: ReviewStatus;
}

export type AuditActionType =
  | 'project_create'
  | 'project_update'
  | 'project_delete'
  | 'rule_create'
  | 'rule_update'
  | 'rule_delete'
  | 'rule_bulk_import'
  | 'scan_run'
  | 'judgment_set'
  | 'judgment_clear'
  | 'annotation_add'
  | 'annotation_resolve'
  | 'review_submit'
  | 'review_approve'
  | 'review_reject'
  | 'report_generate'
  | 'report_export'
  | 'template_create'
  | 'template_update';

export interface AuditLog {
  id: string;
  actionType: AuditActionType;
  actor: string;
  projectId?: string;
  targetId?: string;
  description: string;
  details?: Record<string, unknown>;
  timestamp: number;
  ip?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  sections: ReportSection[];
}

export interface ReportSection {
  id: string;
  type:
    | 'title'
    | 'summary'
    | 'statistics'
    | 'project_info'
    | 'rule_info'
    | 'diff_list'
    | 'evidence_chain'
    | 'custom';
  title: string;
  visible: boolean;
  order: number;
  config?: Record<string, unknown>;
}

export interface EvidenceChainItem {
  id: string;
  type: 'rule' | 'diff' | 'annotation' | 'review' | 'document';
  title: string;
  content: string;
  timestamp: number;
  author?: string;
  metadata?: Record<string, unknown>;
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

export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; cls: string; tagCls: string }> = {
  draft: { label: '草稿', cls: 'text-ink-muted border-ink/30 bg-paper-100', tagCls: 'tag-unjudged' },
  pending_review: { label: '待审核', cls: 'text-rattan-dark border-rattan bg-rattan/30', tagCls: 'tag-taboo' },
  reviewed: { label: '已审核', cls: 'text-azure border-azure/40 bg-azure/10', tagCls: 'tag-variant' },
  approved: { label: '已通过', cls: 'text-moss border-moss/40 bg-moss/10', tagCls: 'tag-pending' },
  rejected: { label: '已驳回', cls: 'text-carmine border-carmine/40 bg-carmine/10', tagCls: 'tag-error' },
};

export const DYNASTY_OPTIONS = [
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
  '其他',
];
