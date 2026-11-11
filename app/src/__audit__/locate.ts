// Turns a React fiber or an Error stack into "src/path/File.tsx:line" for the report.

import type { Fiber } from 'test-renderer';

const FRAME = /\(?((?:[A-Za-z]:)?[^()\s]*?[\\/]app[\\/]src[\\/][^():]+):(\d+):\d+\)?/;

function clean(file: string, line: string): string {
  const rel = file.replace(/\\/g, '/').replace(/^.*\/app\/(src\/)/, '$1');
  return `${rel}:${line}`;
}

/** First frame inside app/src, skipping the audit harness. `skipUi` also skips the shared UI kit (src/ui and each lane's components.tsx). */
export function firstSrcFrame(stack: string | undefined, opts: { skipUi?: boolean } = {}): string | null {
  if (!stack) return null;
  for (const line of stack.split('\n')) {
    const m = FRAME.exec(line);
    if (!m) continue;
    const file = m[1]!.replace(/\\/g, '/');
    if (file.includes('/__audit__/') || file.includes('/node_modules/')) continue;
    if (opts.skipUi && (/\/src\/ui\//.test(file) || /\/components\.tsx$/.test(file))) continue;
    return clean(m[1]!, m[2]!);
  }
  return null;
}

/**
 * Where the JSX for this control was written. Each fiber remembers the stack of the code that created its
 * element, so the nearest fiber above the control whose creator is outside the UI kit is the screen's own line.
 */
export function locateFiber(start: Fiber | null | undefined): string | null {
  let f: any = start;
  for (let i = 0; f && i < 40; i += 1, f = f.return) {
    const hit = firstSrcFrame(f._debugStack?.stack, { skipUi: true });
    if (hit) return hit;
  }
  return null;
}
