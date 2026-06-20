import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CitationEntry, CitationDiffLink, CitationType, CitationCredibility } from '@/types';

const CITATION_KEY = 'ancientscrutiny_citations_v1';
const LINK_KEY = 'ancientscrutiny_citation_links_v1';

function uid() {
  return 'cit_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useCitationStore = defineStore('citation', () => {
  const citations = ref<CitationEntry[]>([]);
  const links = ref<CitationDiffLink[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const rawCitations = localStorage.getItem(CITATION_KEY);
      if (rawCitations) {
        citations.value = JSON.parse(rawCitations);
      }
    } catch {
      citations.value = [];
    }
    try {
      const rawLinks = localStorage.getItem(LINK_KEY);
      if (rawLinks) {
        links.value = JSON.parse(rawLinks);
      }
    } catch {
      links.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(CITATION_KEY, JSON.stringify(citations.value));
    localStorage.setItem(LINK_KEY, JSON.stringify(links.value));
  }

  function addCitation(data: {
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
    tags?: string[];
    projectId?: string;
    createdBy?: string;
  }): CitationEntry {
    const entry: CitationEntry = {
      id: uid(),
      title: data.title.trim(),
      citationType: data.citationType,
      source: data.source.trim(),
      author: data.author?.trim() || undefined,
      dynasty: data.dynasty?.trim() || undefined,
      volume: data.volume?.trim() || undefined,
      page: data.page?.trim() || undefined,
      content: data.content.trim(),
      imageData: data.imageData || undefined,
      imageName: data.imageName || undefined,
      credibility: data.credibility,
      tags: data.tags || [],
      diffEntryIds: [],
      projectId: data.projectId || undefined,
      createdAt: now(),
      updatedAt: now(),
      createdBy: data.createdBy || '本地用户',
    };
    citations.value.push(entry);
    persist();
    return entry;
  }

  function updateCitation(id: string, data: Partial<Omit<CitationEntry, 'id' | 'createdAt' | 'createdBy'>>): boolean {
    const c = citations.value.find((x) => x.id === id);
    if (!c) return false;
    Object.assign(c, data, { updatedAt: now() });
    persist();
    return true;
  }

  function deleteCitation(id: string): boolean {
    const idx = citations.value.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    citations.value.splice(idx, 1);
    links.value = links.value.filter((l) => l.citationId !== id);
    persist();
    return true;
  }

  function deleteCitationsByProject(projectId: string): number {
    const projectCitationIds = citations.value
      .filter((c) => c.projectId === projectId)
      .map((c) => c.id);
    const count = projectCitationIds.length;
    if (count === 0) return 0;
    citations.value = citations.value.filter((c) => c.projectId !== projectId);
    links.value = links.value.filter((l) => projectCitationIds.includes(l.citationId));
    persist();
    return count;
  }

  function linkToDiff(citationId: string, diffEntryId: string, relevanceNote?: string): CitationDiffLink | null {
    const exists = links.value.find(
      (l) => l.citationId === citationId && l.diffEntryId === diffEntryId,
    );
    if (exists) return null;
    const link: CitationDiffLink = {
      id: uid(),
      citationId,
      diffEntryId,
      relevanceNote: relevanceNote?.trim() || undefined,
      linkedBy: '本地用户',
      linkedAt: now(),
    };
    links.value.push(link);
    const citation = citations.value.find((c) => c.id === citationId);
    if (citation && !citation.diffEntryIds.includes(diffEntryId)) {
      citation.diffEntryIds.push(diffEntryId);
      citation.updatedAt = now();
    }
    persist();
    return link;
  }

  function unlinkFromDiff(citationId: string, diffEntryId: string): boolean {
    const idx = links.value.findIndex(
      (l) => l.citationId === citationId && l.diffEntryId === diffEntryId,
    );
    if (idx === -1) return false;
    links.value.splice(idx, 1);
    const citation = citations.value.find((c) => c.id === citationId);
    if (citation) {
      citation.diffEntryIds = citation.diffEntryIds.filter((d) => d !== diffEntryId);
      citation.updatedAt = now();
    }
    persist();
    return true;
  }

  function getCitationsByDiffEntry(diffEntryId: string): CitationEntry[] {
    const linkedIds = links.value
      .filter((l) => l.diffEntryId === diffEntryId)
      .map((l) => l.citationId);
    return citations.value
      .filter((c) => linkedIds.includes(c.id))
      .sort((a, b) => {
        const order: Record<CitationCredibility, number> = { primary: 0, secondary: 1, tertiary: 2 };
        return order[a.credibility] - order[b.credibility];
      });
  }

  function getLinksByDiffEntry(diffEntryId: string): CitationDiffLink[] {
    return links.value
      .filter((l) => l.diffEntryId === diffEntryId)
      .sort((a, b) => a.linkedAt - b.linkedAt);
  }

  function getLinksByCitation(citationId: string): CitationDiffLink[] {
    return links.value
      .filter((l) => l.citationId === citationId)
      .sort((a, b) => a.linkedAt - b.linkedAt);
  }

  function getCitationsByProject(projectId: string): CitationEntry[] {
    return citations.value
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function searchCitations(query: string, filters?: { citationType?: CitationType; credibility?: CitationCredibility; projectId?: string }): CitationEntry[] {
    let results = citations.value;
    if (filters?.projectId) {
      results = results.filter((c) => c.projectId === filters.projectId);
    }
    if (filters?.citationType) {
      results = results.filter((c) => c.citationType === filters.citationType);
    }
    if (filters?.credibility) {
      results = results.filter((c) => c.credibility === filters.credibility);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.source.toLowerCase().includes(q) ||
          c.content.toLowerCase().includes(q) ||
          (c.author || '').toLowerCase().includes(q) ||
          (c.dynasty || '').toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const totalCount = computed(() => citations.value.length);

  const credibilityStats = computed(() => {
    const stats = { primary: 0, secondary: 0, tertiary: 0 };
    for (const c of citations.value) {
      stats[c.credibility]++;
    }
    return stats;
  });

  const typeStats = computed(() => {
    const stats: Record<CitationType, number> = {
      taboo_literature: 0,
      collation_note: 0,
      version_excerpt: 0,
      image_page: 0,
    };
    for (const c of citations.value) {
      stats[c.citationType]++;
    }
    return stats;
  });

  function buildCitationSummary(projectId?: string): {
    citations: CitationEntry[];
    links: CitationDiffLink[];
    stats: {
      total: number;
      byCredibility: Record<CitationCredibility, number>;
      byType: Record<CitationType, number>;
      linkedDiffEntries: number;
    };
  } {
    const projectCitations = projectId
      ? citations.value.filter((c) => c.projectId === projectId)
      : citations.value;
    const projectLinks = projectId
      ? links.value.filter((l) => projectCitations.some((c) => c.id === l.citationId))
      : links.value;
    const byCred: Record<CitationCredibility, number> = { primary: 0, secondary: 0, tertiary: 0 };
    const byType: Record<CitationType, number> = {
      taboo_literature: 0,
      collation_note: 0,
      version_excerpt: 0,
      image_page: 0,
    };
    for (const c of projectCitations) {
      byCred[c.credibility]++;
      byType[c.citationType]++;
    }
    const linkedDiffIds = new Set(projectLinks.map((l) => l.diffEntryId));
    return {
      citations: projectCitations,
      links: projectLinks,
      stats: {
        total: projectCitations.length,
        byCredibility: byCred,
        byType: byType,
        linkedDiffEntries: linkedDiffIds.size,
      },
    };
  }

  function addCitationAndLink(
    data: {
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
      tags?: string[];
      projectId?: string;
      createdBy?: string;
    },
    diffEntryId: string,
    relevanceNote?: string,
  ): { citation: CitationEntry; link: CitationDiffLink | null } {
    const citation = addCitation(data);
    const link = linkToDiff(citation.id, diffEntryId, relevanceNote);
    return { citation, link };
  }

  function getCitationsWithLinksByDiffEntry(diffEntryId: string): Array<{ citation: CitationEntry; link: CitationDiffLink | undefined }> {
    const linked = getCitationsByDiffEntry(diffEntryId);
    const allLinks = getLinksByDiffEntry(diffEntryId);
    return linked.map((c) => ({
      citation: c,
      link: allLinks.find((l) => l.citationId === c.id),
    }));
  }

  function getCitationsGroupedByDiffEntry(diffEntryIds: string[]): Record<string, CitationEntry[]> {
    const result: Record<string, CitationEntry[]> = {};
    for (const id of diffEntryIds) {
      result[id] = getCitationsByDiffEntry(id);
    }
    return result;
  }

  function getCitationsByDiffAndCredibility(diffEntryId: string): Record<CitationCredibility, CitationEntry[]> {
    const all = getCitationsByDiffEntry(diffEntryId);
    return {
      primary: all.filter((c) => c.credibility === 'primary'),
      secondary: all.filter((c) => c.credibility === 'secondary'),
      tertiary: all.filter((c) => c.credibility === 'tertiary'),
    };
  }

  return {
    citations,
    links,
    initialized,
    totalCount,
    credibilityStats,
    typeStats,
    load,
    addCitation,
    updateCitation,
    deleteCitation,
    deleteCitationsByProject,
    linkToDiff,
    unlinkFromDiff,
    getCitationsByDiffEntry,
    getLinksByDiffEntry,
    getLinksByCitation,
    getCitationsByProject,
    searchCitations,
    buildCitationSummary,
    addCitationAndLink,
    getCitationsWithLinksByDiffEntry,
    getCitationsGroupedByDiffEntry,
    getCitationsByDiffAndCredibility,
  };
});
