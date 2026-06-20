import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useTextStore } from '@/stores/textStore';
import { useDiffStore } from '@/stores/diffStore';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { path: '/projects' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/pages/ProjectManager.vue'),
    meta: { title: '卷首 · 项目管理' },
  },
  {
    path: '/rules',
    name: 'rules',
    component: () => import('@/pages/RuleManager.vue'),
    meta: { title: '卷一 · 避讳字规则表' },
  },
  {
    path: '/import',
    name: 'import',
    component: () => import('@/pages/TextImport.vue'),
    meta: { title: '卷二 · 文本导入' },
  },
  {
    path: '/review',
    name: 'review',
    component: () => import('@/pages/DiffReview.vue'),
    meta: { title: '卷三 · 差异审核' },
    beforeEnter: () => {
      const textStore = useTextStore();
      const diffStore = useDiffStore();
      if (!textStore.hasBothTexts || diffStore.scanStatus !== 'done' || diffStore.entries.length === 0) {
        return { path: '/import', query: { reason: 'needtext' } };
      }
      return true;
    },
  },
  {
    path: '/report',
    name: 'report',
    component: () => import('@/pages/ReportPage.vue'),
    meta: { title: '卷四 · 校验报告' },
    beforeEnter: () => {
      const diffStore = useDiffStore();
      if (diffStore.scanStatus !== 'done' || diffStore.entries.length === 0) {
        return { path: '/import', query: { reason: 'nodiff' } };
      }
      return true;
    },
  },
  {
    path: '/evidence',
    name: 'evidence',
    component: () => import('@/pages/EvidenceBase.vue'),
    meta: { title: '卷五 · 典籍依据库' },
  },
  {
    path: '/audit',
    name: 'audit',
    component: () => import('@/pages/AuditLog.vue'),
    meta: { title: '卷六 · 操作日志' },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  const t = (to.meta?.title as string) || '古籍文本避讳校验系统';
  document.title = `${t} | 古籍避讳校验`;
});

export default router;
