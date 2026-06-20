import type { DiffEntry, DiffType } from '@/types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function sliceContext(text: string, start: number, end: number, len = 10) {
  const before = text.slice(Math.max(0, start - len), start);
  const after = text.slice(end, Math.min(text.length, end + len));
  return { before, after };
}

interface LCSOp {
  type: 'equal' | 'insert' | 'delete';
  chars: string;
}

function computeLCS(a: string, b: string): LCSOp[] {
  const m = a.length;
  const n = b.length;
  if (m === 0 && n === 0) return [];
  if (m === 0) return [{ type: 'insert', chars: b }];
  if (n === 0) return [{ type: 'delete', chars: a }];

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: LCSOp[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: 'equal', chars: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'insert', chars: b[j - 1] });
      j--;
    } else {
      ops.push({ type: 'delete', chars: a[i - 1] });
      i--;
    }
  }
  ops.reverse();

  const merged: LCSOp[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) {
      last.chars += op.chars;
    } else {
      merged.push({ type: op.type, chars: op.chars });
    }
  }
  return merged;
}

function classifyPair(del: string, ins: string): DiffType {
  if (del.length > 0 && ins.length > 0) return 'replace';
  if (del.length > 0) return 'delete';
  return 'insert';
}

export function computeCharDiff(original: string, revised: string): DiffEntry[] {
  const ops = computeLCS(original, revised);
  const entries: DiffEntry[] = [];

  let posOri = 0;
  let posRev = 0;

  let pendingDel = '';
  let pendingDelStart = -1;
  let pendingIns = '';
  let pendingInsStart = -1;

  const flush = () => {
    if (pendingDel.length === 0 && pendingIns.length === 0) return;
    const diffType = classifyPair(pendingDel, pendingIns);
    const startOri = pendingDelStart >= 0 ? pendingDelStart : posOri;
    const endOri = startOri + pendingDel.length;
    const startRev = pendingInsStart >= 0 ? pendingInsStart : posRev;
    const endRev = startRev + pendingIns.length;
    const { before, after } = sliceContext(
      diffType === 'insert' ? revised : original,
      diffType === 'insert' ? startRev : startOri,
      diffType === 'insert' ? endRev : endOri,
      10,
    );
    entries.push({
      id: uid(),
      startInOriginal: startOri,
      endInOriginal: endOri,
      startInRevised: startRev,
      endInRevised: endRev,
      originalText: pendingDel,
      revisedText: pendingIns,
      diffType,
      judgment: null,
      judgmentNote: undefined,
      contextBefore: before,
      contextAfter: after,
    });
    pendingDel = '';
    pendingDelStart = -1;
    pendingIns = '';
    pendingInsStart = -1;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      flush();
      posOri += op.chars.length;
      posRev += op.chars.length;
    } else if (op.type === 'delete') {
      if (pendingDelStart < 0) pendingDelStart = posOri;
      pendingDel += op.chars;
      posOri += op.chars.length;
    } else {
      if (pendingInsStart < 0) pendingInsStart = posRev;
      pendingIns += op.chars;
      posRev += op.chars.length;
    }
  }
  flush();
  return entries;
}
