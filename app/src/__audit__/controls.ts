// Finds the controls on a rendered screen: everything a finger can press, toggle or step.
// Works on the host tree (what a device would draw) and walks fibers to find the JS handlers.

import { StyleSheet } from 'react-native';
import type { Fiber, TestInstance } from 'test-renderer';
import {
  computeAccessibleName,
  computeAriaChecked,
  computeAriaDisabled,
  computeAriaLabel,
  computeAriaSelected,
  getRole,
  isHiddenFromAccessibility,
} from '@testing-library/react-native/dist/helpers/accessibility';
import { isHostScrollView, isHostSwitch, isHostText, isHostTextInput } from '@testing-library/react-native/dist/helpers/host-component-names';

export type ControlKind = 'press' | 'switch' | 'action' | 'input';

export interface Control {
  /** Stable across renders of the same screen state: kind, role, name and the nth control with that triple. */
  key: string;
  kind: ControlKind;
  instance: TestInstance;
  role: string;
  /** What a screen reader says, with icon glyph names removed. */
  label: string;
  /** True when the name comes from an explicit accessibilityLabel (as opposed to visible text). */
  explicitLabel: boolean;
  /** True when there is no name at all, or only an icon glyph name. */
  unlabelled: boolean;
  disabled: boolean;
  hasHint: boolean;
  /** Already in the state a press would select (selected tab, checked radio): a no-op press is expected. */
  alreadyOn: boolean;
  hasHandler: boolean;
  /** Which prop name the handler was found under. */
  handlerProp: string | null;
  width: number | null;
  height: number | null;
  hidden: boolean;
  actionName?: string;
}

const INTERACTIVE_ROLES = new Set(['button', 'link', 'tab', 'switch', 'radio', 'checkbox', 'menuitem', 'imagebutton', 'togglebutton', 'adjustable', 'combobox']);
const HANDLER_PROPS = ['onPress', 'onLongPress', 'onPressIn', 'onPressOut'];
const ICON_TEXT = /(?:MaterialIcons|MaterialCommunityIcons|Ionicons|FontAwesome|Feather):[\w-]+/g;

export function fiberChain(instance: TestInstance): Fiber[] {
  const out: Fiber[] = [];
  let f: Fiber | null = instance.unstable_fiber ?? null;
  // The host fiber itself first, then every composite that renders it, up to the next host.
  while (f) {
    out.push(f);
    f = f.return;
    if (f && typeof f.type === 'string') break;
  }
  return out;
}

function handlerOn(instance: TestInstance): { name: string } | null {
  for (const f of fiberChain(instance)) {
    const props = (f.memoizedProps ?? {}) as Record<string, unknown>;
    for (const name of HANDLER_PROPS) if (typeof props[name] === 'function') return { name };
  }
  return null;
}

/** Any ancestor host that would receive a press that bubbles up (what a finger does on a non-responder child). */
function bubbledHandler(instance: TestInstance): boolean {
  for (let p = instance.parent; p; p = p.parent) {
    if (!p.unstable_fiber) break;
    if (handlerOn(p)) return true;
  }
  return false;
}

function hitSlopSize(slop: unknown): { x: number; y: number } {
  if (typeof slop === 'number') return { x: slop * 2, y: slop * 2 };
  if (slop && typeof slop === 'object') {
    const s = slop as Record<string, number>;
    return { x: (s.left ?? 0) + (s.right ?? 0), y: (s.top ?? 0) + (s.bottom ?? 0) };
  }
  return { x: 0, y: 0 };
}

function measure(instance: TestInstance): { width: number | null; height: number | null } {
  const style = (StyleSheet.flatten(instance.props.style) ?? {}) as Record<string, unknown>;
  const dim = (a: unknown, b: unknown): number | null => {
    const nums = [a, b].filter((v): v is number => typeof v === 'number');
    return nums.length ? Math.max(...nums) : null;
  };
  const slop = hitSlopSize(instance.props.hitSlop);
  const w = dim(style.width, style.minWidth);
  const h = dim(style.height, style.minHeight);
  return { width: w === null ? null : w + slop.x, height: h === null ? null : h + slop.y };
}

function isDisplayNone(instance: TestInstance): boolean {
  for (let n: TestInstance | null = instance; n; n = n.parent) {
    const style = StyleSheet.flatten(n.props?.style) as Record<string, unknown> | undefined;
    if (style?.display === 'none') return true;
  }
  return false;
}

function names(instance: TestInstance): { label: string; explicit: boolean; unlabelled: boolean } {
  const explicit = computeAriaLabel(instance);
  const raw = (explicit ?? computeAccessibleName(instance) ?? '').trim();
  const label = raw.replace(ICON_TEXT, '').replace(/\s+/g, ' ').trim();
  return { label: label || raw, explicit: !!explicit, unlabelled: !explicit && label === '' };
}

export function describeControl(instance: TestInstance, kind: ControlKind, actionName?: string): Control {
  const role = String(getRole(instance));
  const n = names(instance);
  const found = handlerOn(instance);
  const size = measure(instance);
  const selected = computeAriaSelected(instance);
  const checked = computeAriaChecked(instance);
  const state = (instance.props.accessibilityState ?? {}) as Record<string, unknown>;
  return {
    key: '',
    kind,
    instance,
    role,
    label: n.label,
    explicitLabel: n.explicit,
    unlabelled: n.unlabelled,
    disabled: computeAriaDisabled(instance),
    hasHint: !!instance.props.accessibilityHint || !!instance.props['aria-describedby'],
    alreadyOn: selected === true || checked === true || state.selected === true,
    hasHandler: !!found,
    handlerProp: found?.name ?? null,
    width: size.width,
    height: size.height,
    hidden: isHiddenFromAccessibility(instance) || isDisplayNone(instance),
    actionName,
  };
}

/** Every control on the screen, in tree order, with stable keys. Hidden ones are included and flagged. */
export function findControls(container: TestInstance): Control[] {
  const found: Control[] = [];
  const hosts = container.queryAll(() => true);
  for (const host of hosts) {
    const p = host.props;
    if (isHostTextInput(host)) {
      found.push(describeControl(host, 'input'));
      continue;
    }
    if (isHostSwitch(host)) {
      found.push(describeControl(host, 'switch'));
      continue;
    }
    if (isHostScrollView(host)) continue;
    const responder = typeof p.onStartShouldSetResponder === 'function';
    if (isHostText(host) && typeof p.onPress !== 'function' && !responder) continue;
    const role = String(getRole(host));
    const interactive = INTERACTIVE_ROLES.has(role);
    const actions = Array.isArray(p.accessibilityActions) ? (p.accessibilityActions as { name: string }[]) : [];
    if (!responder && !interactive && actions.length === 0) continue;
    const c = describeControl(host, 'press');
    // A role-only wrapper whose press is handled by an ancestor is not a separate control.
    const wrapper = !c.hasHandler && !responder && bubbledHandler(host);
    // A stepper or slider that is driven by accessibility actions has no press; its actions are listed below.
    const actionsOnly = !c.hasHandler && !responder && actions.length > 0;
    if (!wrapper && !actionsOnly && (responder || interactive)) found.push(c);
    for (const a of actions) found.push(describeControl(host, 'action', a.name));
  }
  const seen = new Map<string, number>();
  for (const c of found) {
    const base = `${c.kind}:${c.actionName ?? ''}|${c.role}|${c.label.slice(0, 80)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    c.key = `${base}#${n}`;
  }
  return found;
}
