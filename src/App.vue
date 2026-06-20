<script setup lang="ts">
import { watch, ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink, RouterView } from 'vue-router';
import {
  BookOpen,
  FileText,
  GitCompare,
  ScrollText,
  AlertTriangle,
  Menu,
  X,
  Check,
  Folder,
  FolderOpen,
  History,
  ChevronDown,
  BookMarked,
  GitBranch,
  Columns,
  FileBarChart,
} from 'lucide-vue-next';
import { useRuleStore } from '@/stores/ruleStore';
import { useDiffStore } from '@/stores/diffStore';
import { useTextStore } from '@/stores/textStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAnnotationStore } from '@/stores/annotationStore';
import { useReviewStore } from '@/stores/reviewStore';
import { useRuleVersionStore } from '@/stores/ruleVersionStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useCitationStore } from '@/stores/citationStore';

const route = useRoute();
const ruleStore = useRuleStore();
const diffStore = useDiffStore();
const textStore = useTextStore();
const projectStore = useProjectStore();
const auditStore = useAuditStore();
const annotationStore = useAnnotationStore();
const reviewStore = useReviewStore();
const ruleVersionStore = useRuleVersionStore();
const templateStore = useTemplateStore();
const citationStore = useCitationStore();

const sidebarOpen = ref(false);
const invalidateToast = ref<{ type: 'rule' | 'text'; message: string } | null>(null);
const projectDropdownOpen = ref(false);

const showStaleBanner = computed(() => invalidateToast.value !== null);

const nav = [
  { to: '/projects', name: '项目管理', icon: Folder, juan: '卷首' },
  { to: '/rules', name: '规则表', icon: BookOpen, juan: '卷一' },
  { to: '/import', name: '文本导入', icon: FileText, juan: '卷二' },
  { to: '/review', name: '差异审核', icon: GitCompare, juan: '卷三' },
  { to: '/report', name: '校验报告', icon: ScrollText, juan: '卷四' },
  { to: '/evidence', name: '典籍依据库', icon: BookMarked, juan: '卷五' },
  { to: '/audit', name: '操作日志', icon: History, juan: '卷六' },
  { to: '/versions', name: '版本管理', icon: GitBranch, juan: '卷七' },
  { to: '/collation', name: '版本对读', icon: Columns, juan: '卷八' },
  { to: '/collation-report', name: '校勘报告', icon: FileBarChart, juan: '卷九' },
];

function dismissToast() {
  invalidateToast.value = null;
}

onMounted(() => {
  projectStore.load();
  ruleStore.load();
  textStore.load();
  diffStore.load();
  auditStore.load();
  annotationStore.load();
  reviewStore.load();
  ruleVersionStore.load();
  templateStore.load();
  citationStore.load();

  ruleStore.$subscribe(
    () => {
      if (diffStore.scanStatus === 'done' || diffStore.entries.length > 0) {
        diffStore.invalidateDiffs('rule');
      }
    },
    { detached: true },
  );

  watch(
    () => diffStore.lastInvalidation,
    (v) => {
      if (v) {
        invalidateToast.value = { type: v.type, message: v.message };
        setTimeout(dismissToast, 6000);
      }
    },
  );
});

function selectProject(projectId: string) {
  projectStore.setCurrentProject(projectId);
  projectDropdownOpen.value = false;
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="sticky top-0 z-40 backdrop-blur-sm bg-paper-100/80 border-b border-ink/15"
    >
      <div class="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            class="md:hidden btn-ghost !p-2"
            @click="sidebarOpen = !sidebarOpen"
          >
            <Menu v-if="!sidebarOpen" class="w-5 h-5" />
            <X v-else class="w-5 h-5" />
          </button>
          <div class="flex items-center gap-2">
            <div
              class="seal-badge w-9 h-9 text-lg font-bold flex items-center justify-center"
            >
              校
            </div>
            <div>
              <div class="font-title text-lg md:text-xl text-ink leading-none">
                古籍文本避讳校验系统
              </div>
              <div class="text-xs text-ink-muted font-serif mt-1 tracking-widest">
                ANCIENT TABOO SCRUTINY · 校勘學工具
              </div>
            </div>
          </div>
        </div>

        <div class="hidden md:flex items-center gap-4">
          <div v-if="projectStore.projects.length > 0" class="relative">
            <button
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-ink/20 bg-paper-50 text-sm font-serif hover:border-vermilion/50 transition-all"
              @click="projectDropdownOpen = !projectDropdownOpen"
            >
              <FolderOpen v-if="projectStore.currentProject" class="w-4 h-4 text-vermilion" />
              <Folder v-else class="w-4 h-4 text-ink-muted" />
              <span class="max-w-[140px] truncate">
                {{ projectStore.currentProject?.name || '选择项目' }}
              </span>
              <ChevronDown class="w-3.5 h-3.5 text-ink-pale" />
            </button>
            <div
              v-if="projectDropdownOpen"
              class="absolute right-0 top-full mt-1 w-64 card-scroll p-2 z-50 max-h-80 overflow-y-auto"
            >
              <div class="px-3 py-2 text-xs text-ink-muted font-serif border-b border-ink/10 mb-1">
                我的项目
              </div>
              <button
                v-for="p in projectStore.activeProjects.slice(0, 10)"
                :key="p.id"
                class="w-full text-left px-3 py-2 rounded-sm text-sm font-serif hover:bg-vermilion/10 transition-colors flex items-center gap-2"
                :class="{ 'bg-vermilion/10 text-vermilion': projectStore.currentProjectId === p.id }"
                @click="selectProject(p.id)"
              >
                <Folder class="w-4 h-4 flex-shrink-0" />
                <span class="truncate">{{ p.name }}</span>
              </button>
              <div class="border-t border-ink/10 mt-2 pt-2">
                <RouterLink
                  to="/projects"
                  class="block w-full text-left px-3 py-1.5 text-xs text-vermilion font-serif hover:bg-vermilion/5 rounded-sm"
                  @click="projectDropdownOpen = false"
                >
                  管理全部项目 →
                </RouterLink>
              </div>
            </div>
          </div>

          <nav class="flex items-center gap-1">
            <RouterLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="group relative px-3 py-2 rounded-[4px] font-serif text-sm transition-all duration-200"
              :class="
                route.path === item.to
                  ? 'bg-vermilion text-paper-50 shadow'
                  : 'text-ink hover:bg-paper-200'
              "
            >
              <span class="inline-flex items-center gap-2">
                <component :is="item.icon" class="w-4 h-4" />
                <span class="text-[10px] opacity-60 mr-1">{{ item.juan }}</span>
                {{ item.name }}
              </span>
            </RouterLink>
          </nav>
        </div>
      </div>

      <div
        v-if="showStaleBanner && invalidateToast"
        class="border-t border-vermilion/20 bg-rattan/25"
      >
        <div
          class="container mx-auto px-4 md:px-6 py-2 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm font-serif text-ink"
        >
          <div class="flex items-center gap-2 text-ink">
            <AlertTriangle class="w-4 h-4 text-vermilion flex-shrink-0" />
            <span>
              <strong class="text-vermilion mr-1">
                {{ invalidateToast.type === 'rule' ? '【规则已变更】' : '【文本已变更】' }}
              </strong>
              {{ invalidateToast.message }}
            </span>
          </div>
          <div class="ml-auto flex gap-2">
            <RouterLink to="/import" class="btn-primary !py-1 !px-3 text-xs">
              前往重新扫描
            </RouterLink>
            <button class="btn-ghost !py-1 !px-3 text-xs" @click="dismissToast">
              <Check class="w-3 h-3 mr-1" />
              知晓
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="flex-1 flex">
      <aside
        v-show="sidebarOpen"
        class="md:hidden fixed inset-y-0 left-0 z-30 w-64 bg-paper-50 border-r border-ink/15 p-4 pt-20 shadow-lg"
      >
        <nav class="flex flex-col gap-1">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-3 rounded-[4px] font-serif transition"
            :class="
              route.path === item.to
                ? 'bg-vermilion text-paper-50'
                : 'text-ink hover:bg-paper-200'
            "
            @click="sidebarOpen = false"
          >
            <component :is="item.icon" class="w-4 h-4" />
            <span class="text-xs opacity-60">{{ item.juan }}</span>
            <span>{{ item.name }}</span>
          </RouterLink>
        </nav>
      </aside>

      <main class="flex-1 w-full">
        <div class="container mx-auto px-4 md:px-6 py-6 md:py-8">
          <RouterView v-slot="{ Component }">
            <div class="frame-corners p-1">
              <transition
                mode="out-in"
                enter-active-class="transition-opacity duration-300"
                enter-from-class="opacity-0 translate-y-1"
                leave-active-class="transition-opacity duration-150"
                leave-to-class="opacity-0"
              >
                <component :is="Component" />
              </transition>
            </div>
          </RouterView>
        </div>
      </main>
    </div>

    <footer class="border-t border-ink/10 py-5 bg-paper-100/60">
      <div
        class="container mx-auto px-4 md:px-6 flex flex-col md:flex-row gap-3 items-center justify-between text-xs text-ink-muted font-serif"
      >
        <div>古籍文本避讳校验系统 · 本地端运行 · 数据存储于浏览器</div>
        <div class="flex items-center gap-4 flex-wrap">
          <span>
            项目：<strong class="text-ink">{{ projectStore.projects.length }}</strong> 个
          </span>
          <span>·</span>
          <span>
            避讳字规则：<strong class="text-ink">{{ ruleStore.rules.length }}</strong> 条
          </span>
          <span>·</span>
          <span>
            典籍依据：<strong class="text-ink">{{ citationStore.totalCount }}</strong> 条
          </span>
          <span>·</span>
          <span>
            操作日志：<strong class="text-ink">{{ auditStore.logs.length }}</strong> 条
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>
