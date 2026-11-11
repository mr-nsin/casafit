// The audit engine: render one screen variant, press every control, say what each press did.
// Each screen is isolated: a crash or a hang in one scenario is recorded and the run moves on.

import type { ReactElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { TestInstance } from 'test-renderer';
import { isHostModal, isHostScrollView, isHostTextInput } from '@testing-library/react-native/dist/helpers/host-component-names';

import { getTextContent } from '@testing-library/react-native/dist/helpers/text-content';
import { findControls, type Control } from './controls';
import { callLog, captureConsole, changedStores, resetCalls, snapshotStores } from './instrument';
import { firstSrcFrame, locateFiber } from './locate';
import { mockNavigation, navLog, resetNav } from './navMock';
import { validateNavCalls } from './routeSpec';
import { buildWorld, closeWorld, type World, type WorldOptions } from './world';

export type Outcome =
  | 'navigated'
  | 'opened-overlay'
  | 'state-changed'
  | 'called-dep'
  | 'threw'
  | 'nothing'
  | 'no-handler'
  | 'disabled'
  | 'skipped-hidden'
  | 'noop-expected'
  | 'input'
  | 'static-check'
  | 'crash';

export type Severity = 'broken' | 'suspicious' | 'ok-but-unlabelled' | 'ok';

export interface ScreenProps {
  route: { key: string; name: string; params?: Record<string, unknown> };
  navigation: unknown;
}

export interface Scenario {
  /** Unique, e.g. "Home / training day". */
  id: string;
  /** Route name the screen is registered under (or "Main/Workout" for tab roots). */
  screen: string;
  variant: string;
  /** Gets the props React Navigation would pass every screen. */
  element: (p: ScreenProps) => ReactElement;
  params?: Record<string, unknown>;
  /** Route params that depend on seeded data (an id made at seed time). */
  paramsFor?: (w: World) => Promise<Record<string, unknown>>;
  world?: WorldOptions;
  /** Extra seeding after the world is built (stores, database rows, a running session). */
  setup?: (w: World) => Promise<void> | void;
  /** Things Jest cannot judge on this screen. They go to the Maestro list. */
  needsDevice?: string[];
  /** The screen has no controls on purpose (splash, loading). */
  noControls?: boolean;
  canGoBack?: boolean;
  /** Wait this long after render and after each press (screens with real timers). */
  settleMs?: number;
  /** Do not press anything whose label matches (a press that would leave the process, for example). Recorded as skipped. */
  skipLabels?: RegExp;
  /** Skip the overlay follow-up (depth 1) presses. */
  noFollow?: boolean;
}

export interface ControlResult {
  scenario: string;
  screen: string;
  variant: string;
  control: string;
  role: string;
  kind: string;
  /** Presses that led here: [] for a control on the screen, ["Edit"] for a control inside what "Edit" opened. */
  via: string[];
  outcome: Outcome;
  signals: string[];
  navCalls: string[];
  effects: string[];
  storesChanged: string[];
  navProblems: string[];
  errors: string[];
  warnings: string[];
  flags: string[];
  severity: Severity;
  detail: string;
  cause: string | null;
  size: string | null;
}

export interface ScenarioResult {
  scenario: string;
  screen: string;
  variant: string;
  controls: ControlResult[];
  renderError: string | null;
  controlCount: number;
  needsDevice: string[];
  noisy: boolean;
  ms: number;
}

const Wrapper = ({ children }: { children: ReactElement }) => (
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    {children}
  </SafeAreaProvider>
);

async function settle(ms = 0): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms || 1));
    });
  }
}

const MAX_CONTROLS_PER_SCREEN = 120;
const MAX_FOLLOW_UPS = 30;

/** Long lists of look-alike controls (101 birth years) are sampled: the first three and the last one of each role. */
function sample(list: Control[]): Control[] {
  const groups = new Map<string, Control[]>();
  for (const c of list) groups.set(`${c.kind}:${c.role}`, [...(groups.get(`${c.kind}:${c.role}`) ?? []), c]);
  const keep = new Set<Control>();
  for (const g of groups.values()) {
    if (g.length <= 5) g.forEach((c) => keep.add(c));
    else [...g.slice(0, 3), g[g.length - 1]!].forEach((c) => keep.add(c));
  }
  return list.filter((c) => keep.has(c));
}

type View = Awaited<ReturnType<typeof render>>;
interface Mounted {
  view: View;
  world: World;
}

async function mount(sc: Scenario): Promise<Mounted> {
  const world = await buildWorld(sc.world);
  await sc.setup?.(world);
  const params = sc.paramsFor ? await sc.paramsFor(world) : sc.params;
  resetNav({ name: sc.screen, params }, { canGoBack: sc.canGoBack });
  resetCalls();
  const view = await render(<Wrapper>{sc.element({ route: { key: 'audit', name: sc.screen, params }, navigation: mockNavigation })}</Wrapper>);
  await settle(sc.settleMs);
  return { view, world };
}

async function unmount(m: Mounted | null): Promise<void> {
  if (!m) return;
  try {
    await m.view.unmount();
  } catch {
    /* already gone */
  }
}

const openModals = (container: TestInstance): number => container.queryAll((i) => isHostModal(i) && i.props.visible !== false).length;

function treeKey(view: View): string {
  try {
    return JSON.stringify(view.toJSON());
  } catch {
    return String(Math.random());
  }
}

async function pressControl(view: View, c: Control): Promise<unknown> {
  const p = c.instance.props;
  if (c.kind === 'switch') return fireEvent(c.instance, 'valueChange', !p.value);
  if (c.kind === 'action') return fireEvent(c.instance, 'accessibilityAction', { nativeEvent: { actionName: c.actionName } });
  if (c.kind === 'input') return fireEvent.changeText(c.instance, '1');
  return fireEvent.press(c.instance);
}

function sizeText(c: Control): string | null {
  return c.width === null && c.height === null ? null : `${c.width ?? '?'}x${c.height ?? '?'}`;
}

function staticFlags(c: Control): string[] {
  const flags: string[] = [];
  if (c.unlabelled && c.kind !== 'input') flags.push('no-accessible-label');
  if (c.kind === 'input' && c.unlabelled && !c.instance.props.placeholder) flags.push('no-accessible-label');
  // A text field's touch target is its shell, which the style of the input itself does not show.
  const small = c.kind !== 'input' && ((c.width !== null && c.width < 44) || (c.height !== null && c.height < 44));
  if (small) flags.push(`hit-area-under-44 (${sizeText(c)})`);
  if (c.hidden && c.kind !== 'input') flags.push('hidden-from-accessibility');
  return flags;
}

function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** The closest readable text around a control with no name of its own, so the report can say which one it is. */
function nearText(i: TestInstance): string {
  for (let p: TestInstance | null = i.parent, depth = 0; p && depth < 5; p = p.parent, depth += 1) {
    const t = getTextContent(p).replace(/(?:MaterialIcons|MaterialCommunityIcons):[\w-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (t && t.length <= 80) return t.slice(0, 40);
  }
  return '';
}

function controlName(c: Control): string {
  if (c.label) return c.label;
  const near = nearText(c.instance);
  return `(no label ${c.kind}/${c.role}${near ? `, near "${near}"` : ''})`;
}

function baseResult(sc: Scenario, c: Control, via: string[]): ControlResult {
  return {
    scenario: sc.id,
    screen: sc.screen,
    variant: sc.variant,
    control: `${controlName(c)}${c.kind === 'action' ? ` [action ${c.actionName}]` : ''}`,
    role: c.role,
    kind: c.kind,
    via,
    outcome: 'nothing',
    signals: [],
    navCalls: [],
    effects: [],
    storesChanged: [],
    navProblems: [],
    errors: [],
    warnings: [],
    flags: staticFlags(c),
    severity: 'ok',
    detail: '',
    cause: null,
    size: sizeText(c),
  };
}

function severityOf(r: ControlResult): Severity {
  if (r.flags.includes('keyboard-swallows-first-tap')) return 'broken';
  if (r.flags.includes('no-exit')) return 'suspicious';
  if (r.outcome === 'threw' || r.outcome === 'crash' || r.outcome === 'no-handler') return 'broken';
  if (r.navProblems.length) return 'broken';
  if (r.outcome === 'nothing') return 'suspicious';
  if (r.errors.length) return 'suspicious';
  if (r.outcome === 'disabled' && r.flags.includes('disabled-no-hint')) return 'suspicious';
  if (r.flags.some((f) => f.startsWith('hit-area-under-44'))) return 'suspicious';
  if (r.flags.includes('no-accessible-label')) return 'ok-but-unlabelled';
  return 'ok';
}

/** Presses one control on the live view and reports what changed. `c` must belong to `view`. */
async function pressAndObserve(sc: Scenario, m: Mounted, c: Control, via: string[], noisy: boolean): Promise<{ r: ControlResult; dirty: boolean }> {
  const r = baseResult(sc, c, via);

  if (c.hidden && c.kind !== 'input') {
    r.outcome = 'skipped-hidden';
    r.detail = 'Hidden from accessibility or display none, so a finger cannot reach it.';
    r.severity = severityOf(r);
    return { r, dirty: false };
  }
  if (sc.skipLabels?.test(c.label)) {
    r.outcome = 'skipped-hidden';
    r.detail = 'Skipped on purpose (leaves the app).';
    return { r, dirty: false };
  }
  if (c.disabled && c.kind !== 'input') {
    r.outcome = 'disabled';
    if (!c.hasHint) r.flags.push('disabled-no-hint');
    r.detail = c.hasHint ? 'Disabled, and says why.' : 'Disabled with no hint saying why (may be correct for this state).';
    r.severity = severityOf(r);
    return { r, dirty: false };
  }
  if (c.kind === 'press' && !c.hasHandler) {
    r.outcome = 'no-handler';
    r.detail = 'Looks pressable (role or touch responder) but no onPress, onLongPress, onPressIn or onPressOut reaches it.';
    r.cause = locateFiber(c.instance.unstable_fiber);
    r.severity = severityOf(r);
    return { r, dirty: false };
  }
  if (c.kind === 'input' && (c.instance.props.editable === false || typeof c.instance.props.onChangeText !== 'function')) {
    r.outcome = 'no-handler';
    r.detail = 'Text field with no onChangeText or not editable.';
    r.cause = locateFiber(c.instance.unstable_fiber);
    r.severity = severityOf(r);
    return { r, dirty: false };
  }

  const before = { tree: treeKey(m.view), stores: snapshotStores(), nav: navLog.length, fx: callLog.effects.length, reads: callLog.reads.length, modals: openModals(m.view.container) };
  const beforeKeys = new Set(findControls(m.view.container).map((x) => x.key));
  const cap = captureConsole();
  let thrown: unknown = null;
  const rejections: unknown[] = [];
  const onRej = (e: unknown) => rejections.push(e);
  process.on('unhandledRejection', onRej);
  try {
    await pressControl(m.view, c);
    await settle(sc.settleMs);
  } catch (e) {
    thrown = e;
  } finally {
    cap.restore();
    process.off('unhandledRejection', onRej);
  }

  const navCalls = navLog.slice(before.nav);
  r.navCalls = navCalls.map((n) => `${n.method}(${n.args.map((a) => JSON.stringify(a)).join(', ')})`);
  r.effects = callLog.effects.slice(before.fx);
  r.errors = cap.errors.slice(0, 3);
  r.warnings = cap.warnings.slice(0, 3);
  r.navProblems = validateNavCalls(navCalls).map((p) => `${p.call}: ${p.problem}`);
  if (rejections.length) r.errors.push(`unhandled rejection: ${errorText(rejections[0])}`);

  if (thrown || rejections.length) {
    r.outcome = 'threw';
    r.detail = errorText(thrown ?? rejections[0]);
    const stack = (thrown instanceof Error ? thrown.stack : rejections[0] instanceof Error ? (rejections[0] as Error).stack : undefined) ?? '';
    r.cause = firstSrcFrame(stack) ?? locateFiber(c.instance.unstable_fiber);
    r.severity = severityOf(r);
    return { r, dirty: true };
  }

  const stores = changedStores(before.stores, snapshotStores());
  r.storesChanged = stores;
  const after = treeKey(m.view);
  const treeChanged = !noisy && after !== before.tree;
  const modalsNow = (() => {
    try {
      return openModals(m.view.container);
    } catch {
      return before.modals;
    }
  })();
  if (navCalls.length) r.signals.push('navigation');
  if (modalsNow > before.modals) r.signals.push('overlay');
  if (stores.length) r.signals.push(`store:${stores.join(',')}`);
  if (treeChanged) r.signals.push('screen-changed');
  if (r.effects.length) r.signals.push('dependency-call');
  const fresh = (() => {
    try {
      return findControls(m.view.container).filter((x) => !beforeKeys.has(x.key));
    } catch {
      return [];
    }
  })();
  if (fresh.length) r.signals.push(`new-controls:${fresh.length}`);

  if (navCalls.length) r.outcome = 'navigated';
  else if (modalsNow > before.modals) r.outcome = 'opened-overlay';
  else if (stores.length || treeChanged) r.outcome = 'state-changed';
  else if (r.effects.length || callLog.reads.length > before.reads) r.outcome = 'called-dep';
  else if (c.kind === 'input') r.outcome = 'input';
  else if (c.alreadyOn) {
    r.outcome = 'noop-expected';
    r.detail = 'Already selected, so no change is expected.';
  } else {
    r.outcome = 'nothing';
    r.detail = 'Pressed with a handler present, but no navigation, store, screen, dependency or overlay change followed.';
    r.cause = locateFiber(c.instance.unstable_fiber);
  }
  if (r.errors.length && !r.cause) r.cause = locateFiber(c.instance.unstable_fiber);
  if (r.navProblems.length) r.cause = r.cause ?? locateFiber(c.instance.unstable_fiber);
  r.severity = severityOf(r);
  const dirty = r.outcome !== 'nothing' && r.outcome !== 'noop-expected' && r.outcome !== 'input';
  return { r, dirty };
}

/** Replays presses by control key on a fresh mount, to reach a nested overlay. */
async function replay(sc: Scenario, via: string[], noisy: boolean): Promise<Mounted | null> {
  const m = await mount(sc);
  for (const key of via) {
    const c = findControls(m.view.container).find((x) => x.key === key);
    if (!c || c.disabled || !c.hasHandler) return null;
    try {
      await pressControl(m.view, c);
    } catch {
      return null;
    }
    await settle(sc.settleMs);
  }
  void noisy;
  return m;
}

const TAB_ROOTS = new Set(['Workout', 'Nutrition', 'Progress']);

/**
 * Checks that read the tree instead of pressing it.
 * Keyboard: with the default keyboardShouldPersistTaps ("never"), the first tap on a control inside a ScrollView
 * while the keyboard is open only closes the keyboard; the control never gets it. That is React Native's documented
 * behaviour, and it reads as "the button does not work". Applies when the screen has a text field anywhere.
 */
function keyboardCheck(sc: Scenario, m: Mounted): ControlResult[] {
  const container = m.view.container;
  if (container.queryAll((i) => isHostTextInput(i)).length === 0) return [];
  const out: ControlResult[] = [];
  for (const sv of container.queryAll((i) => isHostScrollView(i))) {
    const persist = sv.props.keyboardShouldPersistTaps;
    if (persist === 'handled' || persist === 'always' || persist === false) continue;
    const taps = findControls(sv).filter((c) => c.kind === 'press' && c.hasHandler && !c.disabled);
    if (taps.length === 0) continue;
    const hasInput = findControls(sv).some((c) => c.kind === 'input');
    out.push({
      scenario: sc.id, screen: sc.screen, variant: sc.variant,
      control: `(ScrollView with ${taps.length} controls${hasInput ? ' and a text field' : ', text field outside it'})`,
      role: '-', kind: 'screen', via: [], outcome: 'static-check', signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: [], warnings: [],
      flags: ['keyboard-swallows-first-tap'], severity: 'broken',
      detail: 'ScrollView has no keyboardShouldPersistTaps="handled". With the keyboard open, the first tap on a control inside it only closes the keyboard. Confirm on a device.',
      cause: locateFiber(sv.unstable_fiber), size: null,
    });
  }
  return out;
}

export async function runScenario(sc: Scenario): Promise<ScenarioResult> {
  const t0 = Date.now();
  const out: ScenarioResult = { scenario: sc.id, screen: sc.screen, variant: sc.variant, controls: [], renderError: null, controlCount: 0, needsDevice: sc.needsDevice ?? [], noisy: false, ms: 0 };
  let m: Mounted | null = null;
  const cap = captureConsole();
  try {
    try {
      m = await mount(sc);
    } catch (e) {
      out.renderError = errorText(e);
      out.controls.push({
        scenario: sc.id, screen: sc.screen, variant: sc.variant, control: '(screen did not render)', role: '-', kind: 'screen', via: [], outcome: 'crash',
        signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: [errorText(e)], warnings: [], flags: [], severity: 'broken',
        detail: errorText(e), cause: firstSrcFrame(e instanceof Error ? e.stack : undefined), size: null,
      });
      return out;
    }
    // Does the screen change by itself (timers, animation)? Then screen diffs cannot be trusted.
    const t1 = treeKey(m.view);
    await settle(sc.settleMs);
    out.noisy = treeKey(m.view) !== t1;

    const first = findControls(m.view.container);
    out.controlCount = first.length;
    // Render-time console errors count against the screen itself.
    if (cap.errors.length) {
      out.controls.push({
        scenario: sc.id, screen: sc.screen, variant: sc.variant, control: '(screen render)', role: '-', kind: 'screen', via: [], outcome: 'state-changed',
        signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: cap.errors.slice(0, 3), warnings: [], flags: [], severity: 'suspicious',
        detail: 'console.error while rendering', cause: null, size: null,
      });
    }
    out.controls.push(...keyboardCheck(sc, m));
    const keys = first.slice(0, MAX_CONTROLS_PER_SCREEN).map((c) => c.key);
    if (first.length === 0 && !sc.noControls) {
      out.controls.push({
        scenario: sc.id, screen: sc.screen, variant: sc.variant, control: '(no controls found)', role: '-', kind: 'screen', via: [], outcome: 'nothing',
        signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: [], warnings: [], flags: ['no-controls'], severity: 'suspicious',
        detail: 'The screen rendered with nothing to press. If it is a loading or terminal state this is fine; otherwise the user is stuck.', cause: null, size: null,
      });
    }

    let followUps = 0;
    const follow: { via: string[]; fresh: Control[] }[] = [];
    let dirty = false;
    for (const key of keys) {
      if (dirty) {
        await unmount(m);
        m = await mount(sc);
        dirty = false;
      }
      const c = findControls(m.view.container).find((x) => x.key === key);
      if (!c) continue;
      const beforeKeys = new Set(findControls(m.view.container).map((x) => x.key));
      const { r, dirty: d } = await pressAndObserve(sc, m, c, [], out.noisy);
      out.controls.push(r);
      dirty = d;
      if (!sc.noFollow && r.signals.some((s) => s.startsWith('new-controls') || s === 'overlay') && r.outcome !== 'navigated' && r.outcome !== 'threw') {
        try {
          const fresh = findControls(m.view.container).filter((x) => !beforeKeys.has(x.key) && !x.hidden);
          if (fresh.length) follow.push({ via: [key], fresh: sample(fresh) });
        } catch {
          /* tree gone */
        }
      }
    }

    for (const f of follow) {
      for (const fc of f.fresh) {
        if (followUps >= MAX_FOLLOW_UPS) break;
        followUps += 1;
        await unmount(m);
        m = await replay(sc, f.via, out.noisy);
        if (!m) break;
        const target = findControls(m.view.container).find((x) => x.key === fc.key);
        if (!target) continue;
        const viaLabels = f.via.map((k) => k.split('|').slice(2).join('|').replace(/#\d+$/, ''));
        const { r } = await pressAndObserve(sc, m, target, viaLabels, out.noisy);
        out.controls.push(r);
      }
    }
    const pressedAny = out.controls.some((c) => c.kind !== 'screen' && c.outcome !== 'skipped-hidden');
    if (pressedAny && !sc.noControls && !TAB_ROOTS.has(sc.screen) && !out.controls.some((c) => c.outcome === 'navigated')) {
      out.controls.push({
        scenario: sc.id, screen: sc.screen, variant: sc.variant, control: '(whole screen: no way out)', role: '-', kind: 'screen', via: [], outcome: 'static-check',
        signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: [], warnings: [], flags: ['no-exit'], severity: 'suspicious',
        detail: 'No control on this screen (or in what it opens) navigates anywhere. The user can only leave with the system back gesture, if the screen allows it.', cause: null, size: null,
      });
    }
  } catch (e) {
    out.renderError = errorText(e);
    out.controls.push({
      scenario: sc.id, screen: sc.screen, variant: sc.variant, control: '(audit stopped)', role: '-', kind: 'screen', via: [], outcome: 'crash',
      signals: [], navCalls: [], effects: [], storesChanged: [], navProblems: [], errors: [errorText(e)], warnings: [], flags: [], severity: 'broken',
      detail: `The audit run itself failed on this screen: ${errorText(e)}`, cause: firstSrcFrame(e instanceof Error ? e.stack : undefined), size: null,
    });
  } finally {
    cap.restore();
    await unmount(m);
    await closeWorld();
    out.ms = Date.now() - t0;
  }
  return out;
}
