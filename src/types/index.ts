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
  citations?: CitationEntry[];
  citationLinks?: CitationDiffLink[];
  glyphs?: GlyphEntry[];
  glyphLinks?: GlyphDiffLink[];
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

export type CitationType = 'taboo_literature' | 'collation_note' | 'version_excerpt' | 'image_page';

export type CitationCredibility = 'primary' | 'secondary' | 'tertiary';

export interface CitationEntry {
  id: string;
  title: string;
  citationType: CitationType;
  source: string;
  author?: string;
  dynasty?: string;
  volume?: string;
  page?: string;
  content: string;
  imageData?: string;
  imageName?: string;
  credibility: CitationCredibility;
  tags: string[];
  diffEntryIds: string[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface CitationDiffLink {
  id: string;
  citationId: string;
  diffEntryId: string;
  relevanceNote?: string;
  linkedBy: string;
  linkedAt: number;
}

export const CITATION_TYPE_META: Record<CitationType, { label: string; cls: string }> = {
  taboo_literature: { label: '避讳制度文献', cls: 'text-rattan-dark border-rattan bg-rattan/30' },
  collation_note: { label: '校勘记', cls: 'text-azure border-azure/40 bg-azure/10' },
  version_excerpt: { label: '历代版本摘录', cls: 'text-moss border-moss/40 bg-moss/10' },
  image_page: { label: '图像页码', cls: 'text-carmine border-carmine/40 bg-carmine/10' },
};

export const CREDIBILITY_META: Record<CitationCredibility, { label: string; cls: string; desc: string }> = {
  primary: { label: '一级', cls: 'text-vermilion border-vermilion/40 bg-vermilion/10', desc: '原始典籍、善本原书、出土文献等一手资料' },
  secondary: { label: '二级', cls: 'text-azure border-azure/40 bg-azure/10', desc: '后人的校勘记、注疏、影印本等间接依据' },
  tertiary: { label: '三级', cls: 'text-ink-muted border-ink/20 bg-paper-100', desc: '今人研究论文、网络资料等参考性文献' },
};

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
  | 'template_update'
  | 'citation_create'
  | 'citation_update'
  | 'citation_delete'
  | 'citation_link'
  | 'citation_unlink'
  | 'version_create'
  | 'version_update'
  | 'version_delete'
  | 'version_import'
  | 'version_relation_create'
  | 'version_relation_update'
  | 'version_relation_delete'
  | 'variant_scan'
  | 'variant_classify'
  | 'variant_accept'
  | 'variant_reject'
  | 'variant_note'
  | 'evolution_path_create'
  | 'evolution_path_update'
  | 'collation_report_generate'
  | 'collation_report_export'
  | 'glyph_create'
  | 'glyph_update'
  | 'glyph_delete'
  | 'glyph_variant_add'
  | 'glyph_variant_update'
  | 'glyph_variant_delete'
  | 'glyph_evolution_create'
  | 'glyph_evolution_update'
  | 'glyph_link'
  | 'glyph_unlink';

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
    | 'citation_summary'
    | 'custom';
  title: string;
  visible: boolean;
  order: number;
  config?: Record<string, unknown>;
}

export interface DiffEntryWithCitations extends DiffEntry {
  citations?: CitationEntry[];
  citationLinks?: CitationDiffLink[];
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

export type VersionType = 'original' | 'ancestor' | 'descendant' | 'collated' | 'commentary';

export type VariantCategory =
  | 'transcription'
  | 'taboo_layered'
  | 'later_revision'
  | 'orthographic'
  | 'phonetic'
  | 'missing'
  | 'added'
  | 'disputed';

export type AcceptanceStatus = 'accepted' | 'rejected' | 'tentative' | 'needs_review';

export interface TextVersion {
  id: string;
  projectId: string;
  name: string;
  shortName: string;
  versionType: VersionType;
  dynasty?: string;
  era?: string;
  provenance?: string;
  repository?: string;
  shelfMark?: string;
  scribe?: string;
  transcriptionYear?: string;
  collationNote?: string;
  chapters: ChapterInfo[];
  fullText: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ChapterInfo {
  id: string;
  versionId: string;
  title: string;
  order: number;
  startOffset: number;
  endOffset: number;
  wordCount: number;
  note?: string;
}

export interface VersionRelation {
  id: string;
  projectId: string;
  sourceVersionId: string;
  targetVersionId: string;
  relationType: 'parent_child' | 'sibling' | 'derived_from' | 'collated_with';
  confidence: number;
  evidence?: string;
  establishedBy: string;
  establishedAt: number;
  note?: string;
}

export interface VersionTreeNode {
  id: string;
  versionId: string;
  version: TextVersion;
  parentId: string | null;
  children: string[];
  depth: number;
  x: number;
  y: number;
}

export interface VariantEntry {
  id: string;
  projectId: string;
  chapterId?: string;
  chapterTitle?: string;
  locationKey: string;
  contextBefore: string;
  contextAfter: string;
  variants: VariantReading[];
  category: VariantCategory;
  categoryConfidence: number;
  suspectedTaboo?: TabooRule;
  suspectedTabooId?: string;
  evolutionPath?: EvolutionPath;
  acceptance: AcceptanceStatus;
  acceptedReading?: string;
  acceptedVersionId?: string;
  collationNote?: string;
  researcherNote?: string;
  citations: string[];
  createdAt: number;
  updatedAt: number;
  discoveredBy: string;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface VariantReading {
  text: string;
  versionIds: string[];
  isBaseReading?: boolean;
}

export interface EvolutionStep {
  versionId: string;
  versionName: string;
  text: string;
  changeType: 'addition' | 'deletion' | 'modification' | 'taboo' | 'correction';
  rationale?: string;
  timestamp?: number;
}

export interface EvolutionPath {
  id: string;
  variantId: string;
  steps: EvolutionStep[];
  direction: 'earlier_to_later' | 'later_to_earlier' | 'undetermined';
  confidence: number;
  evidence?: string;
  establishedBy: string;
  establishedAt: number;
}

export interface MultiVersionDiff {
  id: string;
  projectId: string;
  chapterId?: string;
  baseVersionId: string;
  comparingVersionIds: string[];
  status: ScanStatus;
  totalVariants: number;
  statistics: VariantStatistics;
  variants: VariantEntry[];
  scannedAt?: number;
  scannedBy: string;
}

export interface VariantStatistics {
  byCategory: Record<VariantCategory, number>;
  byAcceptance: Record<AcceptanceStatus, number>;
  byChapter: Record<string, number>;
  tabooLayeredCount: number;
  laterRevisionCount: number;
  transcriptionCount: number;
  disputedCount: number;
}

export interface CollationReport {
  id: string;
  projectId: string;
  generatedAt: number;
  generatedBy: string;
  title: string;
  summary: string;
  versions: TextVersion[];
  versionTree: VersionTreeNode[];
  versionRelations: VersionRelation[];
  variantStatistics: VariantStatistics;
  variants: VariantEntry[];
  acceptedVariants: VariantEntry[];
  collationPrinciples?: string;
  appendices?: CollationAppendix[];
}

export interface CollationAppendix {
  id: string;
  title: string;
  type: 'bibliography' | 'glossary' | 'abbreviations' | 'tables' | 'charts';
  content: string;
}

export const VERSION_TYPE_META: Record<VersionType, { label: string; cls: string; desc: string }> = {
  original: { label: '底本', cls: 'text-vermilion border-vermilion/40 bg-vermilion/10', desc: '作为校勘基准的版本' },
  ancestor: { label: '祖本', cls: 'text-rattan-dark border-rattan bg-rattan/30', desc: '最早的已知版本或源头版本' },
  descendant: { label: '传本', cls: 'text-azure border-azure/40 bg-azure/10', desc: '从祖本衍生出的后代版本' },
  collated: { label: '校本', cls: 'text-moss border-moss/40 bg-moss/10', desc: '经过校勘整理的版本' },
  commentary: { label: '注本', cls: 'text-ink-muted border-ink/20 bg-paper-100', desc: '带有注释或评注的版本' },
};

export const VARIANT_CATEGORY_META: Record<VariantCategory, { label: string; cls: string; tagCls: string; desc: string }> = {
  transcription: {
    label: '传抄异文',
    cls: 'text-rattan-dark border-rattan bg-rattan/30',
    tagCls: 'tag-transcription',
    desc: '因传抄过程产生的文字差异',
  },
  taboo_layered: {
    label: '避讳层累',
    cls: 'text-vermilion border-vermilion/40 bg-vermilion/10',
    tagCls: 'tag-taboo-layered',
    desc: '因不同时代避讳制度叠加产生的差异',
  },
  later_revision: {
    label: '后出改字',
    cls: 'text-carmine border-carmine/40 bg-carmine/10',
    tagCls: 'tag-later-revision',
    desc: '后世整理者或刻印者的改动',
  },
  orthographic: {
    label: '字形变异',
    cls: 'text-azure border-azure/40 bg-azure/10',
    tagCls: 'tag-orthographic',
    desc: '异体字、古今字、俗字等字形差异',
  },
  phonetic: {
    label: '音近通假',
    cls: 'text-purple border-purple/40 bg-purple/10',
    tagCls: 'tag-phonetic',
    desc: '因音近相通产生的异文',
  },
  missing: {
    label: '脱文',
    cls: 'text-amber border-amber/40 bg-amber/10',
    tagCls: 'tag-missing',
    desc: '版本中缺失的文字',
  },
  added: {
    label: '衍文',
    cls: 'text-indigo border-indigo/40 bg-indigo/10',
    tagCls: 'tag-added',
    desc: '版本中多出的文字',
  },
  disputed: {
    label: '存疑待考',
    cls: 'text-ink-muted border-ink/20 bg-paper-100',
    tagCls: 'tag-disputed',
    desc: '异文性质有待进一步考证',
  },
};

export const ACCEPTANCE_META: Record<AcceptanceStatus, { label: string; cls: string; tagCls: string }> = {
  accepted: { label: '采信', cls: 'text-moss border-moss/40 bg-moss/10', tagCls: 'tag-accepted' },
  rejected: { label: '不采信', cls: 'text-carmine border-carmine/40 bg-carmine/10', tagCls: 'tag-rejected' },
  tentative: { label: '暂定', cls: 'text-azure border-azure/40 bg-azure/10', tagCls: 'tag-tentative' },
  needs_review: { label: '待复核', cls: 'text-rattan-dark border-rattan bg-rattan/30', tagCls: 'tag-needs-review' },
};

export type GlyphSourceType = 'manuscript' | 'engraved' | 'rubbing' | 'seal' | 'bronze' | 'bamboo' | 'silk' | 'other';

export type GlyphVariantType =
  | 'structural'
  | 'component'
  | 'stroke_missing'
  | 'stroke_added'
  | 'stroke_variant'
  | 'simplified'
  | 'traditional'
  | 'vulgar'
  | 'phonetic_loan'
  | 'interchangeable';

export interface GlyphComponent {
  name: string;
  position: 'left' | 'right' | 'top' | 'bottom' | 'inside' | 'outside' | 'center';
  description?: string;
}

export interface GlyphVariant {
  id: string;
  glyphEntryId: string;
  variantChar: string;
  variantType: GlyphVariantType;
  dynasty?: string;
  era?: string;
  sourceType: GlyphSourceType;
  sourceTitle: string;
  sourceDetail?: string;
  pageRef?: string;
  imageData?: string;
  imageName?: string;
  components: GlyphComponent[];
  missingStrokes?: string[];
  addedStrokes?: string[];
  strokeCount?: number;
  useContext?: string;
  usageNotes?: string;
  relatedVariantIds: string[];
  isHeadVariant?: boolean;
  credibility: 'primary' | 'secondary' | 'tertiary';
  tags: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface GlyphEvolutionStep {
  id: string;
  fromVariantId: string | null;
  toVariantId: string | null;
  fromVariantChar?: string;
  toVariantChar?: string;
  changeType: 'simplification' | 'complication' | 'component_substitution' | 'stroke_change' | 'structural_rearrangement' | 'taboo_modification';
  dynasty?: string;
  evidence?: string;
  confidence: number;
  order: number;
}

export interface GlyphEntry {
  id: string;
  headChar: string;
  pinyin?: string;
  radical?: string;
  strokeCount?: number;
  definition?: string;
  category?: string;
  variants: GlyphVariant[];
  evolutionChain: GlyphEvolutionStep[];
  relatedGlyphIds: string[];
  researchNotes?: string;
  tags: string[];
  projectId?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface GlyphDiffLink {
  id: string;
  glyphEntryId: string;
  variantId?: string;
  diffEntryId: string;
  relevanceNote?: string;
  linkedBy: string;
  linkedAt: number;
}

export const GLYPH_SOURCE_TYPE_META: Record<GlyphSourceType, { label: string; cls: string }> = {
  manuscript: { label: '写本', cls: 'text-rattan-dark border-rattan bg-rattan/30' },
  engraved: { label: '刻本', cls: 'text-azure border-azure/40 bg-azure/10' },
  rubbing: { label: '拓本', cls: 'text-moss border-moss/40 bg-moss/10' },
  seal: { label: '玺印', cls: 'text-vermilion border-vermilion/40 bg-vermilion/10' },
  bronze: { label: '金文', cls: 'text-amber border-amber/40 bg-amber/10' },
  bamboo: { label: '简牍', cls: 'text-emerald border-emerald/40 bg-emerald/10' },
  silk: { label: '帛书', cls: 'text-purple border-purple/40 bg-purple/10' },
  other: { label: '其他', cls: 'text-ink-muted border-ink/20 bg-paper-100' },
};

export const GLYPH_VARIANT_TYPE_META: Record<GlyphVariantType, { label: string; cls: string; desc: string }> = {
  structural: { label: '结构差异', cls: 'text-vermilion border-vermilion/40 bg-vermilion/10', desc: '整体字形结构不同' },
  component: { label: '构件差异', cls: 'text-rattan-dark border-rattan bg-rattan/30', desc: '偏旁构件不同' },
  stroke_missing: { label: '缺笔', cls: 'text-carmine border-carmine/40 bg-carmine/10', desc: '笔画减少或缺笔' },
  stroke_added: { label: '增笔', cls: 'text-azure border-azure/40 bg-azure/10', desc: '笔画增加' },
  stroke_variant: { label: '笔形变异', cls: 'text-moss border-moss/40 bg-moss/10', desc: '笔画形态不同' },
  simplified: { label: '简体', cls: 'text-indigo border-indigo/40 bg-indigo/10', desc: '简化字形' },
  traditional: { label: '繁体', cls: 'text-purple border-purple/40 bg-purple/10', desc: '繁化字形' },
  vulgar: { label: '俗字', cls: 'text-amber border-amber/40 bg-amber/10', desc: '民间俗写字形' },
  phonetic_loan: { label: '假借', cls: 'text-emerald border-emerald/40 bg-emerald/10', desc: '音近假借字' },
  interchangeable: { label: '通用', cls: 'text-ink-muted border-ink/20 bg-paper-100', desc: '可通用的异体' },
};

export const AUDIT_ACTION_TYPES_EXTENDED: AuditActionType[] = [
  'version_create',
  'version_update',
  'version_delete',
  'version_import',
  'version_relation_create',
  'version_relation_update',
  'version_relation_delete',
  'variant_scan',
  'variant_classify',
  'variant_accept',
  'variant_reject',
  'variant_note',
  'evolution_path_create',
  'evolution_path_update',
  'collation_report_generate',
  'collation_report_export',
  'glyph_create',
  'glyph_update',
  'glyph_delete',
  'glyph_variant_add',
  'glyph_variant_update',
  'glyph_variant_delete',
  'glyph_evolution_create',
  'glyph_evolution_update',
  'glyph_link',
  'glyph_unlink',
];
