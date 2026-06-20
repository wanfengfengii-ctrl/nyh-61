<script setup lang="ts">
import { watch, ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink, RouterView } from 'vue-router';
import { BookOpen, FileText, GitCompare, ScrollText, AlertTriangle, Menu, X, Check } from 'lucide-vue-next';
import { useRuleStore } from '@/stores/ruleStore';
import { useDiffStore } from '@/stores/diffStore';

const route = useRoute();
const ruleStore = useRuleStore();
const diffStore = useDiffStore();

const sidebarOpen = ref(false);
const invalidateToast = ref<{ type: 'rule' | 'text'; message: string } | null>(null);

const showStaleBanner = computed(() => invalidateToast.value !== null);

const nav = [
  { to: '/rules', name: '规则表', icon: BookOpen, juan: '卷一' },
  { to: '/import', name: '文本导入', icon: FileText, juan: '卷二' },
  { to: '/review', name: '差异审核', icon: GitCompare, juan: '卷三' },
  { to: '/report', name: '校验报告', icon: ScrollText, juan: '卷四' },
];

function dismissToast() {
  invalidateToast.value = null;
}

onMounted(() => {
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
        <nav class="hidden md:flex items-center gap-1">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="group relative px-4 py-2 rounded-[4px] font-serif text-sm transition-all duration-200"
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
        <div class="flex items-center gap-4">
          <span>避讳字规则：{{ ruleStore.rules.length }} 条</span>
          <span>·</span>
          <span>启用 {{ ruleStore.enabledRules.length }} 条</span>
        </div>
      </div>
    </footer>
  </div>
</template>
