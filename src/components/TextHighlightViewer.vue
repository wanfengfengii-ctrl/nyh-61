<script setup lang="ts">
import { computed } from 'vue';
import type { DiffEntry, JudgmentType } from '@/types';
import { judgmentHlCls } from '@/utils/exportEngine';

interface Segment {
  text: string;
  diff?: DiffEntry;
  kind: 'plain' | 'diff';
  cls?: string;
}

const props = defineProps<{
  text: string;
  entries: DiffEntry[];
  /** 'original' | 'revised' 高亮哪一边 */
  side: 'original' | 'revised';
  selectedId?: string | null;
  /** 若为 true，删除用删除线显示，插入用加粗显示，用于"单栏差异模式" */
  showRawStyle?: boolean;
}>();

const segments = computed<Segment[]>(() => {
  const segs: Segment[] = [];
  if (!props.text) return segs;
  const sorted = [...props.entries].sort((a, b) => {
    if (props.side === 'original') return a.startInOriginal - b.startInOriginal;
    return a.startInRevised - b.startInRevised;
  });
  let cursor = 0;
  for (const d of sorted) {
    const start = props.side === 'original' ? d.startInOriginal : d.startInRevised;
    const end = props.side === 'original' ? d.endInOriginal : d.endInRevised;
    if (start > cursor) {
      segs.push({ text: props.text.slice(cursor, start), kind: 'plain' });
    }
    const piece = props.text.slice(start, end);
    const baseCls =
      d.id === props.selectedId
        ? `${judgmentHlCls(d.judgment)} ring-2 ring-vermilion ring-offset-1`
        : judgmentHlCls(d.judgment);
    const extra = (() => {
      if (!props.showRawStyle) return baseCls;
      if (props.side === 'original' && d.diffType !== 'insert') {
        return `${baseCls} line-through decoration-2 decoration-carmine/70`;
      }
      if (props.side === 'revised' && d.diffType !== 'delete') {
        return `${baseCls} font-semibold`;
      }
      return baseCls;
    })();
    segs.push({
      text: piece || (props.side === 'original' && d.diffType === 'insert' ? '' : props.side === 'revised' && d.diffType === 'delete' ? '' : '∅'),
      diff: d,
      kind: 'diff',
      cls: extra,
    });
    cursor = end;
  }
  if (cursor < props.text.length) {
    segs.push({ text: props.text.slice(cursor), kind: 'plain' });
  }
  return segs;
});

const emit = defineEmits<{
  (e: 'clickDiff', id: string): void;
}>();
</script>

<template>
  <div class="font-serif text-ink leading-[2.1] tracking-wide whitespace-pre-wrap break-words">
    <template v-for="(s, i) in segments" :key="i">
      <span v-if="s.kind === 'plain'">{{ s.text }}</span>
      <span
        v-else
        :class="s.cls"
        class="cursor-pointer transition-all duration-150 hover:shadow-md inline-block px-0.5 my-[1px]"
        :title="s.diff?.matchedRule ? `匹配规则：${s.diff.matchedRule.originalChar}→${s.diff.matchedRule.replacedChar}` : '未匹配避讳规则'"
        @click="s.diff && emit('clickDiff', s.diff.id)"
      >
        {{ s.text }}
      </span>
    </template>
  </div>
</template>
