import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { useTextStore } from '@/stores/textStore';
import { useDiffStore } from '@/stores/diffStore';
import { useVersionStore } from '@/stores/versionStore';
import { useVariantStore } from '@/stores/variantStore';

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
  {
    path: '/versions',
    name: 'versions',
    component: () => import('@/pages/VersionManager.vue'),
    meta: { title: '卷七 · 版本管理' },
  },
  {
    path: '/collation',
    name: 'collation',
    component: () => import('@/pages/VersionCollation.vue'),
    meta: { title: '卷八 · 版本对读' },
    beforeEnter: () => {
      const versionStore = useVersionStore();
      if (!versionStore.initialized) versionStore.load();
      if (versionStore.versions.length < 2) {
        return { path: '/versions', query: { reason: 'needversions' } };
      }
      return true;
    },
  },
  {
    path: '/collation-report',
    name: 'collation-report',
    component: () => import('@/pages/CollationReportPage.vue'),
    meta: { title: '卷九 · 校勘报告' },
    beforeEnter: () => {
      const variantStore = useVariantStore();
      if (!variantStore.initialized) variantStore.load();
      if (variantStore.variants.length === 0) {
        return { path: '/collation', query: { reason: 'needcollation' } };
      }
      return true;
    },
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
