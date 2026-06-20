import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ReviewFlow, ReviewStatus, ReviewAction } from '@/types';

const REVIEW_KEY = 'ancientscrutiny_review_flows_v1';

function uid() {
  return 'rev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function now() {
  return Date.now();
}

export const useReviewStore = defineStore('review', () => {
  const flows = ref<ReviewFlow[]>([]);
  const initialized = ref(false);

  function load() {
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      if (raw) {
        flows.value = JSON.parse(raw);
      }
    } catch {
      flows.value = [];
    }
    initialized.value = true;
  }

  function persist() {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(flows.value));
  }

  function createFlow(data: {
    diffEntryId: string;
    projectId: string;
    createdBy?: string;
    assignedTo?: string;
  }): ReviewFlow {
    const flow: ReviewFlow = {
      id: uid(),
      diffEntryId: data.diffEntryId,
      projectId: data.projectId,
      status: 'draft',
      assignedTo: data.assignedTo,
      createdBy: data.createdBy || '本地用户',
      createdAt: now(),
      updatedAt: now(),
      reviewHistory: [],
    };
    flows.value.push(flow);
    persist();
    return flow;
  }

  function getOrCreateFlow(diffEntryId: string, projectId: string, createdBy?: string): ReviewFlow {
    let flow = flows.value.find(
      (f) => f.diffEntryId === diffEntryId && f.projectId === projectId,
    );
    if (!flow) {
      flow = createFlow({ diffEntryId, projectId, createdBy });
    }
    return flow;
  }

  function getFlowByDiffEntry(diffEntryId: string, projectId: string): ReviewFlow | undefined {
    return flows.value.find(
      (f) => f.diffEntryId === diffEntryId && f.projectId === projectId,
    );
  }

  function submitForReview(
    flowId: string,
    actor?: string,
    comment?: string,
    assignedTo?: string,
  ): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    const fromStatus = flow.status;
    flow.status = 'pending_review';
    if (assignedTo) flow.assignedTo = assignedTo;
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'submit',
      actor: actor || '本地用户',
      comment,
      timestamp: now(),
      fromStatus,
      toStatus: 'pending_review',
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function reviewFlow(
    flowId: string,
    approved: boolean,
    actor?: string,
    comment?: string,
  ): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    const fromStatus = flow.status;
    flow.status = approved ? 'reviewed' : 'rejected';
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: approved ? 'review' : 'reject',
      actor: actor || '本地用户',
      comment,
      timestamp: now(),
      fromStatus,
      toStatus: approved ? 'reviewed' : 'rejected',
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function approveFlow(flowId: string, actor?: string, comment?: string): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    const fromStatus = flow.status;
    flow.status = 'approved';
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'approve',
      actor: actor || '本地用户',
      comment,
      timestamp: now(),
      fromStatus,
      toStatus: 'approved',
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function rejectFlow(flowId: string, actor?: string, comment?: string): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    const fromStatus = flow.status;
    flow.status = 'rejected';
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'reject',
      actor: actor || '本地用户',
      comment,
      timestamp: now(),
      fromStatus,
      toStatus: 'rejected',
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function reassignFlow(flowId: string, assignedTo: string, actor?: string, comment?: string): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    flow.assignedTo = assignedTo;
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'reassign',
      actor: actor || '本地用户',
      comment: comment || `转交给 ${assignedTo}`,
      timestamp: now(),
      fromStatus: flow.status,
      toStatus: flow.status,
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function addComment(flowId: string, content: string, actor?: string): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'comment',
      actor: actor || '本地用户',
      comment: content,
      timestamp: now(),
      fromStatus: flow.status,
      toStatus: flow.status,
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function resetToDraft(flowId: string, actor?: string, comment?: string): boolean {
    const flow = flows.value.find((f) => f.id === flowId);
    if (!flow) return false;
    const fromStatus = flow.status;
    flow.status = 'draft';
    flow.updatedAt = now();

    const action: ReviewAction = {
      id: uid() + '_act',
      action: 'comment',
      actor: actor || '本地用户',
      comment: comment || '退回草稿',
      timestamp: now(),
      fromStatus,
      toStatus: 'draft',
    };
    flow.reviewHistory.push(action);
    persist();
    return true;
  }

  function getFlowsByProject(projectId: string): ReviewFlow[] {
    return flows.value
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getFlowsByStatus(projectId: string, status: ReviewStatus): ReviewFlow[] {
    return flows.value.filter((f) => f.projectId === projectId && f.status === status);
  }

  const statistics = computed(() => {
    const stats: Record<ReviewStatus, number> = {
      draft: 0,
      pending_review: 0,
      reviewed: 0,
      approved: 0,
      rejected: 0,
    };
    for (const f of flows.value) {
      stats[f.status]++;
    }
    return stats;
  });

  return {
    flows,
    initialized,
    statistics,
    load,
    createFlow,
    getOrCreateFlow,
    getFlowByDiffEntry,
    submitForReview,
    reviewFlow,
    approveFlow,
    rejectFlow,
    reassignFlow,
    addComment,
    resetToDraft,
    getFlowsByProject,
    getFlowsByStatus,
  };
});
