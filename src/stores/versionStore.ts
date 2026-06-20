import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  TextVersion,
  ChapterInfo,
  VersionRelation,
  VersionTreeNode,
  VersionType,
} from '@/types';

const VERSION_KEY = 'ancientscrutiny_versions_v1';
const RELATION_KEY = 'ancientscrutiny_version_relations_v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const useVersionStore = defineStore('version', () => {
  const versions = ref<TextVersion[]>([]);
  const relations = ref<VersionRelation[]>([]);
  const selectedVersionId = ref<string | null>(null);
  const baseVersionId = ref<string | null>(null);
  const comparingVersionIds = ref<string[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const rawVersions = localStorage.getItem(VERSION_KEY);
      const rawRelations = localStorage.getItem(RELATION_KEY);
      if (rawVersions) {
        versions.value = JSON.parse(rawVersions);
      }
      if (rawRelations) {
        relations.value = JSON.parse(rawRelations);
      }
      if (versions.value.length > 0 && !baseVersionId.value) {
        baseVersionId.value = versions.value[0].id;
      }
      initialized.value = true;
    } catch {
      versions.value = [];
      relations.value = [];
    }
  }

  function persistVersions() {
    localStorage.setItem(VERSION_KEY, JSON.stringify(versions.value));
  }

  function persistRelations() {
    localStorage.setItem(RELATION_KEY, JSON.stringify(relations.value));
  }

  function parseChapters(text: string, versionId: string): ChapterInfo[] {
    const chapters: ChapterInfo[] = [];
    const chapterRegex = /[第卷][一二三四五六七八九十百千0-9]+[卷篇章回]/g;
    let match;
    const matches: { title: string; index: number }[] = [];

    while ((match = chapterRegex.exec(text)) !== null) {
      matches.push({ title: match[0], index: match.index });
    }

    if (matches.length === 0) {
      const chapter: ChapterInfo = {
        id: uid(),
        versionId,
        title: '全文',
        order: 1,
        startOffset: 0,
        endOffset: text.length,
        wordCount: text.length,
      };
      chapters.push(chapter);
      return chapters;
    }

    for (let i = 0; i < matches.length; i++) {
      const startOffset = matches[i].index;
      const endOffset = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const chapter: ChapterInfo = {
        id: uid(),
        versionId,
        title: matches[i].title,
        order: i + 1,
        startOffset,
        endOffset,
        wordCount: endOffset - startOffset,
      };
      chapters.push(chapter);
    }

    if (matches[0].index > 0) {
      const preChapter: ChapterInfo = {
        id: uid(),
        versionId,
        title: '序/前言',
        order: 0,
        startOffset: 0,
        endOffset: matches[0].index,
        wordCount: matches[0].index,
      };
      chapters.unshift(preChapter);
    }

    return chapters;
  }

  function addVersion(data: {
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
    fullText: string;
    createdBy: string;
  }): { ok: boolean; version?: TextVersion; error?: string } {
    const existing = versions.value.find(
      (v) => v.projectId === data.projectId && (v.name === data.name || v.shortName === data.shortName)
    );
    if (existing) {
      return { ok: false, error: '版本名称或简称已存在，请使用不同的名称。' };
    }

    const chapters = parseChapters(data.fullText, '');

    const version: TextVersion = {
      id: uid(),
      projectId: data.projectId,
      name: data.name,
      shortName: data.shortName,
      versionType: data.versionType,
      dynasty: data.dynasty,
      era: data.era,
      provenance: data.provenance,
      repository: data.repository,
      shelfMark: data.shelfMark,
      scribe: data.scribe,
      transcriptionYear: data.transcriptionYear,
      collationNote: data.collationNote,
      chapters: chapters.map((c) => ({ ...c, versionId: '' })),
      fullText: data.fullText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: data.createdBy,
    };

    version.chapters.forEach((c) => (c.versionId = version.id));

    versions.value.push(version);

    if (!baseVersionId.value) {
      baseVersionId.value = version.id;
    }

    persistVersions();
    return { ok: true, version };
  }

  function updateVersion(
    id: string,
    updates: Partial<Omit<TextVersion, 'id' | 'projectId' | 'createdAt' | 'createdBy'>>
  ): { ok: boolean; version?: TextVersion; error?: string } {
    const idx = versions.value.findIndex((v) => v.id === id);
    if (idx === -1) return { ok: false, error: '版本不存在' };

    if (updates.name || updates.shortName) {
      const existing = versions.value.find(
        (v) =>
          v.id !== id &&
          v.projectId === versions.value[idx].projectId &&
          ((updates.name && v.name === updates.name) ||
            (updates.shortName && v.shortName === updates.shortName))
      );
      if (existing) {
        return { ok: false, error: '版本名称或简称已存在' };
      }
    }

    if (updates.fullText) {
      updates.chapters = parseChapters(updates.fullText, id);
    }

    versions.value[idx] = {
      ...versions.value[idx],
      ...updates,
      updatedAt: Date.now(),
    };

    persistVersions();
    return { ok: true, version: versions.value[idx] };
  }

  function deleteVersion(id: string): { ok: boolean; error?: string } {
    const idx = versions.value.findIndex((v) => v.id === id);
    if (idx === -1) return { ok: false, error: '版本不存在' };

    versions.value.splice(idx, 1);
    relations.value = relations.value.filter(
      (r) => r.sourceVersionId !== id && r.targetVersionId !== id
    );

    if (selectedVersionId.value === id) selectedVersionId.value = null;
    if (baseVersionId.value === id) {
      baseVersionId.value = versions.value[0]?.id || null;
    }
    comparingVersionIds.value = comparingVersionIds.value.filter((v) => v !== id);

    persistVersions();
    persistRelations();
    return { ok: true };
  }

  function getVersionById(id: string): TextVersion | undefined {
    return versions.value.find((v) => v.id === id);
  }

  function getVersionsByProject(projectId: string): TextVersion[] {
    return versions.value.filter((v) => v.projectId === projectId);
  }

  function getChapterText(versionId: string, chapterId: string): string | undefined {
    const version = getVersionById(versionId);
    if (!version) return undefined;

    const chapter = version.chapters.find((c) => c.id === chapterId);
    if (!chapter) return undefined;

    return version.fullText.slice(chapter.startOffset, chapter.endOffset);
  }

  function addRelation(data: {
    projectId: string;
    sourceVersionId: string;
    targetVersionId: string;
    relationType: VersionRelation['relationType'];
    confidence: number;
    evidence?: string;
    establishedBy: string;
    note?: string;
  }): { ok: boolean; relation?: VersionRelation; error?: string } {
    if (data.sourceVersionId === data.targetVersionId) {
      return { ok: false, error: '不能建立版本自身的关系' };
    }

    const existing = relations.value.find(
      (r) =>
        r.projectId === data.projectId &&
        ((r.sourceVersionId === data.sourceVersionId && r.targetVersionId === data.targetVersionId) ||
          (r.sourceVersionId === data.targetVersionId && r.targetVersionId === data.sourceVersionId))
    );
    if (existing) {
      return { ok: false, error: '这两个版本之间已存在关系' };
    }

    const relation: VersionRelation = {
      id: uid(),
      projectId: data.projectId,
      sourceVersionId: data.sourceVersionId,
      targetVersionId: data.targetVersionId,
      relationType: data.relationType,
      confidence: data.confidence,
      evidence: data.evidence,
      establishedBy: data.establishedBy,
      establishedAt: Date.now(),
      note: data.note,
    };

    relations.value.push(relation);
    persistRelations();
    return { ok: true, relation };
  }

  function updateRelation(
    id: string,
    updates: Partial<Omit<VersionRelation, 'id' | 'projectId' | 'establishedAt' | 'establishedBy'>>
  ): { ok: boolean; relation?: VersionRelation; error?: string } {
    const idx = relations.value.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, error: '关系不存在' };

    relations.value[idx] = {
      ...relations.value[idx],
      ...updates,
    };

    persistRelations();
    return { ok: true, relation: relations.value[idx] };
  }

  function deleteRelation(id: string): { ok: boolean; error?: string } {
    const idx = relations.value.findIndex((r) => r.id === id);
    if (idx === -1) return { ok: false, error: '关系不存在' };

    relations.value.splice(idx, 1);
    persistRelations();
    return { ok: true };
  }

  function getRelationsByProject(projectId: string): VersionRelation[] {
    return relations.value.filter((r) => r.projectId === projectId);
  }

  function getRelationsByVersion(versionId: string): VersionRelation[] {
    return relations.value.filter(
      (r) => r.sourceVersionId === versionId || r.targetVersionId === versionId
    );
  }

  function buildVersionTree(projectId: string, rootVersionId?: string): VersionTreeNode[] {
    const projectVersions = getVersionsByProject(projectId);
    const projectRelations = getRelationsByProject(projectId);

    if (projectVersions.length === 0) return [];

    const rootId = rootVersionId || findRootVersion(projectVersions, projectRelations);
    const nodes: Map<string, VersionTreeNode> = new Map();
    const processed = new Set<string>();

    function buildNode(versionId: string, parentId: string | null, depth: number, x: number): VersionTreeNode {
      if (processed.has(versionId)) {
        return nodes.get(versionId)!;
      }
      processed.add(versionId);

      const version = getVersionById(versionId)!;
      const childRelations = projectRelations.filter(
        (r) =>
          r.sourceVersionId === versionId &&
          (r.relationType === 'parent_child' || r.relationType === 'derived_from')
      );

      const children: string[] = childRelations.map((r) => r.targetVersionId);

      const node: VersionTreeNode = {
        id: uid(),
        versionId,
        version,
        parentId,
        children: [],
        depth,
        x,
        y: depth * 80,
      };

      nodes.set(versionId, node);

      const childCount = children.length;
      children.forEach((childId, idx) => {
        const childX = x + (idx - (childCount - 1) / 2) * 120;
        const childNode = buildNode(childId, versionId, depth + 1, childX);
        node.children.push(childNode.id);
      });

      return node;
    }

    buildNode(rootId, null, 0, 0);

    const adjustX = (nodeId: string, minX: number): number => {
      const node = nodes.get(nodeId)!;
      if (node.children.length === 0) {
        node.x = Math.max(node.x, minX);
        return node.x + 120;
      }

      let currentX = minX;
      node.children.forEach((childId) => {
        currentX = adjustX(childId, currentX);
      });

      const childNodes = node.children.map((id) => nodes.get(id)!);
      node.x = (childNodes[0].x + childNodes[childNodes.length - 1].x) / 2;

      return Math.max(node.x + 120, currentX);
    };

    adjustX(rootId, 60);

    return Array.from(nodes.values());
  }

  function findRootVersion(versions: TextVersion[], relations: VersionRelation[]): string {
    const ancestor = versions.find((v) => v.versionType === 'ancestor');
    if (ancestor) return ancestor.id;

    const targetIds = new Set(relations.map((r) => r.targetVersionId));
    const sourceIds = new Set(relations.map((r) => r.sourceVersionId));

    for (const v of versions) {
      if (sourceIds.has(v.id) && !targetIds.has(v.id)) {
        return v.id;
      }
    }

    const original = versions.find((v) => v.versionType === 'original');
    if (original) return original.id;

    return versions[0].id;
  }

  function toggleComparingVersion(versionId: string) {
    const idx = comparingVersionIds.value.indexOf(versionId);
    if (idx === -1) {
      comparingVersionIds.value.push(versionId);
    } else {
      comparingVersionIds.value.splice(idx, 1);
    }
  }

  function setBaseVersion(versionId: string) {
    baseVersionId.value = versionId;
  }

  function selectVersion(versionId: string | null) {
    selectedVersionId.value = versionId;
  }

  const selectedVersion = computed(() =>
    selectedVersionId.value ? getVersionById(selectedVersionId.value) : undefined
  );

  const baseVersion = computed(() =>
    baseVersionId.value ? getVersionById(baseVersionId.value) : undefined
  );

  const comparingVersions = computed(() =>
    comparingVersionIds.value.map((id) => getVersionById(id)).filter(Boolean) as TextVersion[]
  );

  return {
    versions,
    relations,
    selectedVersionId,
    baseVersionId,
    comparingVersionIds,
    initialized,
    selectedVersion,
    baseVersion,
    comparingVersions,
    load,
    addVersion,
    updateVersion,
    deleteVersion,
    getVersionById,
    getVersionsByProject,
    getChapterText,
    addRelation,
    updateRelation,
    deleteRelation,
    getRelationsByProject,
    getRelationsByVersion,
    buildVersionTree,
    toggleComparingVersion,
    setBaseVersion,
    selectVersion,
  };
});
