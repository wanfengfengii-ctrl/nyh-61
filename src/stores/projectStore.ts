import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Project, ScanHistory } from '@/types';

const PROJECT_KEY = 'ancientscrutiny_projects_v1';
const CURRENT_PROJECT_KEY = 'ancientscrutiny_current_project_v1';
const SCAN_HISTORY_KEY = 'ancientscrutiny_scan_history_v1';

function uid(prefix = 'p') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const currentProjectId = ref<string | null>(null);
  const scanHistories = ref<ScanHistory[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(PROJECT_KEY);
      if (raw) {
        projects.value = JSON.parse(raw);
      }
      const currentRaw = localStorage.getItem(CURRENT_PROJECT_KEY);
      if (currentRaw) {
        currentProjectId.value = currentRaw;
      }
      const historyRaw = localStorage.getItem(SCAN_HISTORY_KEY);
      if (historyRaw) {
        scanHistories.value = JSON.parse(historyRaw);
      }
    } catch {
      projects.value = [];
      currentProjectId.value = null;
      scanHistories.value = [];
    }
    initialized.value = true;
  }

  function persistProjects() {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(projects.value));
  }

  function persistCurrent() {
    if (currentProjectId.value) {
      localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId.value);
    } else {
      localStorage.removeItem(CURRENT_PROJECT_KEY);
    }
  }

  function persistHistories() {
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(scanHistories.value));
  }

  const currentProject = computed(() =>
    projects.value.find((p) => p.id === currentProjectId.value) || null,
  );

  const activeProjects = computed(() => projects.value.filter((p) => p.status === 'active'));
  const archivedProjects = computed(() => projects.value.filter((p) => p.status === 'archived'));
  const completedProjects = computed(() => projects.value.filter((p) => p.status === 'completed'));

  function createProject(data: {
    name: string;
    dynasty: string;
    bookTitle: string;
    volume: string;
    description?: string;
    createdBy?: string;
  }): { ok: boolean; error?: string; project?: Project } {
    const name = data.name.trim();
    if (!name) return { ok: false, error: '项目名称不能为空' };
    if (!data.dynasty) return { ok: false, error: '请选择朝代' };
    if (!data.bookTitle.trim()) return { ok: false, error: '请填写书名' };
    if (!data.volume.trim()) return { ok: false, error: '请填写卷次' };

    const project: Project = {
      id: uid('proj'),
      name,
      dynasty: data.dynasty,
      bookTitle: data.bookTitle.trim(),
      volume: data.volume.trim(),
      description: data.description?.trim() || undefined,
      createdAt: now(),
      updatedAt: now(),
      createdBy: data.createdBy || '本地用户',
      status: 'active',
    };
    projects.value.push(project);
    persistProjects();
    if (!currentProjectId.value) {
      currentProjectId.value = project.id;
      persistCurrent();
    }
    return { ok: true, project };
  }

  function updateProject(
    id: string,
    patch: Partial<Pick<Project, 'name' | 'dynasty' | 'bookTitle' | 'volume' | 'description' | 'status'>>,
  ): { ok: boolean; error?: string } {
    const p = projects.value.find((x) => x.id === id);
    if (!p) return { ok: false, error: '项目不存在' };
    Object.assign(p, { ...patch, updatedAt: now() });
    persistProjects();
    return { ok: true };
  }

  function deleteProject(id: string): { ok: boolean; error?: string } {
    const idx = projects.value.findIndex((p) => p.id === id);
    if (idx === -1) return { ok: false, error: '项目不存在' };
    projects.value.splice(idx, 1);
    if (currentProjectId.value === id) {
      currentProjectId.value = projects.value[0]?.id || null;
      persistCurrent();
    }
    scanHistories.value = scanHistories.value.filter((h) => h.projectId !== id);
    persistProjects();
    persistHistories();
    return { ok: true };
  }

  function setCurrentProject(id: string | null) {
    if (id && !projects.value.find((p) => p.id === id)) return;
    currentProjectId.value = id;
    persistCurrent();
  }

  function getProjectScans(projectId: string): ScanHistory[] {
    return scanHistories.value
      .filter((h) => h.projectId === projectId)
      .sort((a, b) => b.scannedAt - a.scannedAt);
  }

  function addScanHistory(scan: Omit<ScanHistory, 'id'>): ScanHistory {
    const history: ScanHistory = {
      ...scan,
      id: uid('scan'),
    };
    scanHistories.value.push(history);
    persistHistories();
    const project = projects.value.find((p) => p.id === scan.projectId);
    if (project) {
      project.currentScanId = history.id;
      project.updatedAt = now();
      persistProjects();
    }
    return history;
  }

  function getScanById(id: string): ScanHistory | undefined {
    return scanHistories.value.find((h) => h.id === id);
  }

  function deleteScanHistory(id: string): boolean {
    const idx = scanHistories.value.findIndex((h) => h.id === id);
    if (idx === -1) return false;
    scanHistories.value.splice(idx, 1);
    persistHistories();
    return true;
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    activeProjects,
    archivedProjects,
    completedProjects,
    scanHistories,
    initialized,
    load,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    getProjectScans,
    addScanHistory,
    getScanById,
    deleteScanHistory,
  };
});
