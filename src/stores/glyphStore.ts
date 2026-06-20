import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  GlyphEntry,
  GlyphVariant,
  GlyphEvolutionStep,
  GlyphDiffLink,
  GlyphSourceType,
  GlyphVariantType,
  GlyphComponent,
} from '@/types';

const GLYPH_KEY = 'ancientscrutiny_glyphs_v1';
const GLYPH_LINK_KEY = 'ancientscrutiny_glyph_links_v1';

function uid() {
  return 'glyph_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useGlyphStore = defineStore('glyph', () => {
  const glyphEntries = ref<GlyphEntry[]>([]);
  const glyphLinks = ref<GlyphDiffLink[]>([]);
  const selectedGlyphId = ref<string | null>(null);
  const initialized = ref(false);

  function load() {
    try {
      const rawGlyphs = localStorage.getItem(GLYPH_KEY);
      if (rawGlyphs) {
        glyphEntries.value = JSON.parse(rawGlyphs);
      }
    } catch {
      glyphEntries.value = [];
    }
    try {
      const rawLinks = localStorage.getItem(GLYPH_LINK_KEY);
      if (rawLinks) {
        glyphLinks.value = JSON.parse(rawLinks);
      }
    } catch {
      glyphLinks.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(GLYPH_KEY, JSON.stringify(glyphEntries.value));
    localStorage.setItem(GLYPH_LINK_KEY, JSON.stringify(glyphLinks.value));
  }

  function addGlyphEntry(data: {
    headChar: string;
    pinyin?: string;
    radical?: string;
    strokeCount?: number;
    definition?: string;
    category?: string;
    researchNotes?: string;
    tags?: string[];
    projectId?: string;
    createdBy?: string;
  }): GlyphEntry {
    const entry: GlyphEntry = {
      id: uid(),
      headChar: data.headChar,
      pinyin: data.pinyin,
      radical: data.radical,
      strokeCount: data.strokeCount,
      definition: data.definition,
      category: data.category,
      variants: [],
      evolutionChain: [],
      relatedGlyphIds: [],
      researchNotes: data.researchNotes,
      tags: data.tags || [],
      projectId: data.projectId,
      createdBy: data.createdBy || '本地用户',
      createdAt: now(),
      updatedAt: now(),
    };
    glyphEntries.value.push(entry);
    persist();
    return entry;
  }

  function updateGlyphEntry(id: string, data: Partial<Omit<GlyphEntry, 'id' | 'variants' | 'evolutionChain' | 'createdAt' | 'createdBy'>>): boolean {
    const entry = glyphEntries.value.find((g) => g.id === id);
    if (!entry) return false;
    Object.assign(entry, data, { updatedAt: now() });
    persist();
    return true;
  }

  function deleteGlyphEntry(id: string): boolean {
    const idx = glyphEntries.value.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    glyphEntries.value.splice(idx, 1);
    glyphLinks.value = glyphLinks.value.filter((l) => l.glyphEntryId !== id);
    if (selectedGlyphId.value === id) {
      selectedGlyphId.value = null;
    }
    persist();
    return true;
  }

  function addGlyphVariant(
    glyphEntryId: string,
    data: {
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
      components?: GlyphComponent[];
      missingStrokes?: string[];
      addedStrokes?: string[];
      strokeCount?: number;
      useContext?: string;
      usageNotes?: string;
      isHeadVariant?: boolean;
      credibility: 'primary' | 'secondary' | 'tertiary';
      tags?: string[];
    }
  ): GlyphVariant | null {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return null;

    const variant: GlyphVariant = {
      id: uid(),
      glyphEntryId,
      variantChar: data.variantChar,
      variantType: data.variantType,
      dynasty: data.dynasty,
      era: data.era,
      sourceType: data.sourceType,
      sourceTitle: data.sourceTitle,
      sourceDetail: data.sourceDetail,
      pageRef: data.pageRef,
      imageData: data.imageData,
      imageName: data.imageName,
      components: data.components || [],
      missingStrokes: data.missingStrokes,
      addedStrokes: data.addedStrokes,
      strokeCount: data.strokeCount,
      useContext: data.useContext,
      usageNotes: data.usageNotes,
      relatedVariantIds: [],
      isHeadVariant: data.isHeadVariant || false,
      credibility: data.credibility,
      tags: data.tags || [],
      createdBy: '本地用户',
      createdAt: now(),
      updatedAt: now(),
    };

    if (variant.isHeadVariant) {
      entry.variants.forEach((v) => {
        v.isHeadVariant = false;
      });
    }

    entry.variants.push(variant);
    entry.updatedAt = now();
    persist();
    return variant;
  }

  function updateGlyphVariant(
    glyphEntryId: string,
    variantId: string,
    data: Partial<Omit<GlyphVariant, 'id' | 'glyphEntryId' | 'createdAt' | 'createdBy'>>
  ): boolean {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return false;
    const variant = entry.variants.find((v) => v.id === variantId);
    if (!variant) return false;

    if (data.isHeadVariant) {
      entry.variants.forEach((v) => {
        if (v.id !== variantId) v.isHeadVariant = false;
      });
    }

    Object.assign(variant, data, { updatedAt: now() });
    entry.updatedAt = now();
    persist();
    return true;
  }

  function deleteGlyphVariant(glyphEntryId: string, variantId: string): boolean {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return false;
    const idx = entry.variants.findIndex((v) => v.id === variantId);
    if (idx === -1) return false;
    entry.variants.splice(idx, 1);
    entry.evolutionChain = entry.evolutionChain.filter(
      (s) => s.fromVariantId !== variantId && s.toVariantId !== variantId
    );
    entry.updatedAt = now();
    persist();
    return true;
  }

  function addEvolutionStep(
    glyphEntryId: string,
    data: {
      fromVariantId: string | null;
      toVariantId: string | null;
      changeType: GlyphEvolutionStep['changeType'];
      dynasty?: string;
      evidence?: string;
      confidence: number;
      order?: number;
    }
  ): GlyphEvolutionStep | null {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return null;

    const fromVariant = data.fromVariantId
      ? entry.variants.find((v) => v.id === data.fromVariantId)
      : null;
    const toVariant = data.toVariantId
      ? entry.variants.find((v) => v.id === data.toVariantId)
      : null;

    const step: GlyphEvolutionStep = {
      id: uid(),
      fromVariantId: data.fromVariantId,
      toVariantId: data.toVariantId,
      fromVariantChar: fromVariant?.variantChar,
      toVariantChar: toVariant?.variantChar,
      changeType: data.changeType,
      dynasty: data.dynasty,
      evidence: data.evidence,
      confidence: data.confidence,
      order: data.order ?? entry.evolutionChain.length,
    };

    entry.evolutionChain.push(step);
    entry.evolutionChain.sort((a, b) => a.order - b.order);
    entry.updatedAt = now();
    persist();
    return step;
  }

  function updateEvolutionStep(
    glyphEntryId: string,
    stepId: string,
    data: Partial<Omit<GlyphEvolutionStep, 'id'>>
  ): boolean {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return false;
    const step = entry.evolutionChain.find((s) => s.id === stepId);
    if (!step) return false;

    if (data.fromVariantId !== undefined) {
      const fromVariant = entry.variants.find((v) => v.id === data.fromVariantId);
      step.fromVariantChar = fromVariant?.variantChar;
    }
    if (data.toVariantId !== undefined) {
      const toVariant = entry.variants.find((v) => v.id === data.toVariantId);
      step.toVariantChar = toVariant?.variantChar;
    }

    Object.assign(step, data);
    entry.evolutionChain.sort((a, b) => a.order - b.order);
    entry.updatedAt = now();
    persist();
    return true;
  }

  function deleteEvolutionStep(glyphEntryId: string, stepId: string): boolean {
    const entry = glyphEntries.value.find((g) => g.id === glyphEntryId);
    if (!entry) return false;
    const idx = entry.evolutionChain.findIndex((s) => s.id === stepId);
    if (idx === -1) return false;
    entry.evolutionChain.splice(idx, 1);
    entry.updatedAt = now();
    persist();
    return true;
  }

  function linkToDiff(
    glyphEntryId: string,
    diffEntryId: string,
    variantId?: string,
    relevanceNote?: string
  ): GlyphDiffLink | null {
    const exists = glyphLinks.value.find(
      (l) => l.glyphEntryId === glyphEntryId && l.diffEntryId === diffEntryId && l.variantId === variantId
    );
    if (exists) return null;

    const link: GlyphDiffLink = {
      id: uid(),
      glyphEntryId,
      variantId,
      diffEntryId,
      relevanceNote: relevanceNote?.trim() || undefined,
      linkedBy: '本地用户',
      linkedAt: now(),
    };

    glyphLinks.value.push(link);
    persist();
    return link;
  }

  function unlinkFromDiff(glyphEntryId: string, diffEntryId: string, variantId?: string): boolean {
    const idx = glyphLinks.value.findIndex(
      (l) => l.glyphEntryId === glyphEntryId && l.diffEntryId === diffEntryId && l.variantId === variantId
    );
    if (idx === -1) return false;
    glyphLinks.value.splice(idx, 1);
    persist();
    return true;
  }

  function getGlyphsByDiffEntry(diffEntryId: string): GlyphEntry[] {
    const linkedEntryIds = new Set(
      glyphLinks.value
        .filter((l) => l.diffEntryId === diffEntryId)
        .map((l) => l.glyphEntryId)
    );
    return glyphEntries.value.filter((g) => linkedEntryIds.has(g.id));
  }

  function getLinksByDiffEntry(diffEntryId: string): GlyphDiffLink[] {
    return glyphLinks.value
      .filter((l) => l.diffEntryId === diffEntryId)
      .sort((a, b) => a.linkedAt - b.linkedAt);
  }

  function getGlyphById(id: string): GlyphEntry | undefined {
    return glyphEntries.value.find((g) => g.id === id);
  }

  function getVariantById(glyphEntryId: string, variantId: string): GlyphVariant | undefined {
    const entry = getGlyphById(glyphEntryId);
    return entry?.variants.find((v) => v.id === variantId);
  }

  function searchGlyphs(query: string, filters?: {
    dynasty?: string;
    sourceType?: GlyphSourceType;
    variantType?: GlyphVariantType;
    projectId?: string;
    category?: string;
  }): GlyphEntry[] {
    let results = glyphEntries.value;

    if (filters?.projectId) {
      results = results.filter((g) => g.projectId === filters.projectId);
    }
    if (filters?.category) {
      results = results.filter((g) => g.category === filters.category);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter((g) => {
        const headMatch = g.headChar.includes(query);
        const pinyinMatch = (g.pinyin || '').toLowerCase().includes(q);
        const defMatch = (g.definition || '').toLowerCase().includes(q);
        const tagMatch = g.tags.some((t) => t.toLowerCase().includes(q));
        const variantMatch = g.variants.some(
          (v) =>
            v.variantChar.includes(query) ||
            v.sourceTitle.toLowerCase().includes(q) ||
            (v.useContext || '').toLowerCase().includes(q)
        );
        return headMatch || pinyinMatch || defMatch || tagMatch || variantMatch;
      });
    }

    if (filters?.dynasty || filters?.sourceType || filters?.variantType) {
      results = results.filter((g) =>
        g.variants.some((v) => {
          let match = true;
          if (filters.dynasty) {
            match = match && v.dynasty === filters.dynasty;
          }
          if (filters.sourceType) {
            match = match && v.sourceType === filters.sourceType;
          }
          if (filters.variantType) {
            match = match && v.variantType === filters.variantType;
          }
          return match;
        })
      );
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function findSimilarVariants(char: string): Array<{ entry: GlyphEntry; variant?: GlyphVariant }> {
    const results: Array<{ entry: GlyphEntry; variant?: GlyphVariant }> = [];

    for (const entry of glyphEntries.value) {
      if (entry.headChar === char) {
        results.push({ entry });
        continue;
      }
      const matchingVariant = entry.variants.find((v) => v.variantChar === char);
      if (matchingVariant) {
        results.push({ entry, variant: matchingVariant });
      }
    }

    return results;
  }

  function getGlyphsByProject(projectId: string): GlyphEntry[] {
    return glyphEntries.value
      .filter((g) => g.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function deleteGlyphsByProject(projectId: string): number {
    const count = glyphEntries.value.filter((g) => g.projectId === projectId).length;
    if (count === 0) return 0;
    const projectGlyphIds = glyphEntries.value
      .filter((g) => g.projectId === projectId)
      .map((g) => g.id);
    glyphEntries.value = glyphEntries.value.filter((g) => g.projectId !== projectId);
    glyphLinks.value = glyphLinks.value.filter((l) => projectGlyphIds.includes(l.glyphEntryId));
    persist();
    return count;
  }

  function buildGlyphSummary(projectId?: string): {
    glyphs: GlyphEntry[];
    links: GlyphDiffLink[];
    stats: {
      total: number;
      totalVariants: number;
      totalEvolutionSteps: number;
      linkedDiffEntries: number;
    };
  } {
    const projectGlyphs = projectId
      ? glyphEntries.value.filter((g) => g.projectId === projectId)
      : glyphEntries.value;
    const projectLinks = projectId
      ? glyphLinks.value.filter((l) => projectGlyphs.some((g) => g.id === l.glyphEntryId))
      : glyphLinks.value;
    
    const totalVariants = projectGlyphs.reduce((sum, g) => sum + g.variants.length, 0);
    const totalEvolutionSteps = projectGlyphs.reduce(
      (sum, g) => sum + (g.evolutionChain?.length || 0),
      0
    );
    const linkedDiffIds = new Set(projectLinks.map((l) => l.diffEntryId));

    return {
      glyphs: projectGlyphs,
      links: projectLinks,
      stats: {
        total: projectGlyphs.length,
        totalVariants,
        totalEvolutionSteps,
        linkedDiffEntries: linkedDiffIds.size,
      },
    };
  }

  const totalCount = computed(() => glyphEntries.value.length);
  const totalVariants = computed(() =>
    glyphEntries.value.reduce((sum, g) => sum + g.variants.length, 0)
  );

  const selectedGlyph = computed(() =>
    selectedGlyphId.value ? getGlyphById(selectedGlyphId.value) : undefined
  );

  function selectGlyph(id: string | null) {
    selectedGlyphId.value = id;
  }

  return {
    glyphEntries,
    glyphLinks,
    selectedGlyphId,
    initialized,
    selectedGlyph,
    totalCount,
    totalVariants,
    load,
    addGlyphEntry,
    updateGlyphEntry,
    deleteGlyphEntry,
    addGlyphVariant,
    updateGlyphVariant,
    deleteGlyphVariant,
    addEvolutionStep,
    updateEvolutionStep,
    deleteEvolutionStep,
    linkToDiff,
    unlinkFromDiff,
    getGlyphById,
    getVariantById,
    getGlyphsByDiffEntry,
    getLinksByDiffEntry,
    searchGlyphs,
    findSimilarVariants,
    getGlyphsByProject,
    deleteGlyphsByProject,
    buildGlyphSummary,
    selectGlyph,
  };
});
