import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Annotation } from '@/types';

const ANNOTATION_KEY = 'ancientscrutiny_annotations_v1';

function uid() {
  return 'ann_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useAnnotationStore = defineStore('annotation', () => {
  const annotations = ref<Annotation[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(ANNOTATION_KEY);
      if (raw) {
        annotations.value = JSON.parse(raw);
      }
    } catch {
      annotations.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(ANNOTATION_KEY, JSON.stringify(annotations.value));
  }

  function addAnnotation(data: {
    diffEntryId: string;
    projectId: string;
    author?: string;
    content: string;
    replyTo?: string;
  }): Annotation {
    const annotation: Annotation = {
      id: uid(),
      diffEntryId: data.diffEntryId,
      projectId: data.projectId,
      author: data.author || '本地用户',
      content: data.content.trim(),
      createdAt: now(),
      updatedAt: now(),
      resolved: false,
      replyTo: data.replyTo,
    };
    annotations.value.push(annotation);
    persist();
    return annotation;
  }

  function updateAnnotation(id: string, content: string): boolean {
    const a = annotations.value.find((x) => x.id === id);
    if (!a) return false;
    a.content = content.trim();
    a.updatedAt = now();
    persist();
    return true;
  }

  function deleteAnnotation(id: string): boolean {
    const idx = annotations.value.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    annotations.value.splice(idx, 1);
    persist();
    return true;
  }

  function resolveAnnotation(id: string, resolvedBy?: string): boolean {
    const a = annotations.value.find((x) => x.id === id);
    if (!a) return false;
    a.resolved = true;
    a.resolvedAt = now();
    a.resolvedBy = resolvedBy || '本地用户';
    a.updatedAt = now();
    persist();
    return true;
  }

  function unresolveAnnotation(id: string): boolean {
    const a = annotations.value.find((x) => x.id === id);
    if (!a) return false;
    a.resolved = false;
    a.resolvedAt = undefined;
    a.resolvedBy = undefined;
    a.updatedAt = now();
    persist();
    return true;
  }

  function getByDiffEntry(diffEntryId: string): Annotation[] {
    return annotations.value
      .filter((a) => a.diffEntryId === diffEntryId && !a.replyTo)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getReplies(annotationId: string): Annotation[] {
    return annotations.value
      .filter((a) => a.replyTo === annotationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function getByProject(projectId: string): Annotation[] {
    return annotations.value
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const unresolvedCount = computed(() =>
    annotations.value.filter((a) => !a.resolved).length,
  );

  function getUnresolvedByProject(projectId: string): Annotation[] {
    return annotations.value.filter((a) => a.projectId === projectId && !a.resolved);
  }

  return {
    annotations,
    initialized,
    unresolvedCount,
    load,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,
    unresolveAnnotation,
    getByDiffEntry,
    getReplies,
    getByProject,
    getUnresolvedByProject,
  };
});
