// A recording stand-in for `@react-navigation/native`. Each screen is rendered on its own, so
// there is no navigator: every navigation call lands here and the audit inspects it afterwards.
// Wire it up in a test file with:
//   jest.mock('@react-navigation/native', () => require('./navMock').navigationModule);

export interface NavCall {
  method: string;
  args: unknown[];
}

export const navLog: NavCall[] = [];
export const routeState: { name: string; params: Record<string, unknown> | undefined } = { name: 'Audit', params: undefined };
let canGoBack = true;

export function resetNav(route: { name: string; params?: Record<string, unknown> }, opts: { canGoBack?: boolean } = {}): void {
  navLog.length = 0;
  routeState.name = route.name;
  routeState.params = route.params;
  canGoBack = opts.canGoBack ?? true;
}

const record =
  (method: string, ret?: () => unknown) =>
  (...args: unknown[]) => {
    navLog.push({ method, args });
    return ret?.();
  };

export const mockNavigation: Record<string, unknown> = {
  navigate: record('navigate'),
  push: record('push'),
  replace: record('replace'),
  reset: record('reset'),
  goBack: record('goBack'),
  pop: record('pop'),
  popTo: record('popTo'),
  popToTop: record('popToTop'),
  dispatch: record('dispatch'),
  setOptions: record('setOptions'),
  setParams: record('setParams'),
  addListener: (..._a: unknown[]) => () => undefined,
  removeListener: () => undefined,
  canGoBack: () => canGoBack,
  isFocused: () => true,
  getParent: () => mockNavigation,
  getState: () => ({ routes: [], index: 0 }),
};

export const navigationModule = {
  useNavigation: () => mockNavigation,
  useRoute: () => ({ key: 'audit', name: routeState.name, params: routeState.params }),
  useIsFocused: () => true,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(() => cb(), [cb]),
};
