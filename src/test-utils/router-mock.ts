/**
 * Stand-in for `expo-router` in screen tests: navigation calls become spies and
 * route params are set per test. Use it as
 * `jest.mock('expo-router', () => require('@/test-utils/router-mock').expoRouterMock)`.
 */
export const routerSpy = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

let params: Record<string, string> = {};

export const setRouteParams = (next: Record<string, string>) => {
  params = next;
};

export const resetRouter = () => {
  params = {};
  routerSpy.push.mockClear();
  routerSpy.back.mockClear();
  routerSpy.replace.mockClear();
};

export const expoRouterMock = {
  router: routerSpy,
  useLocalSearchParams: () => params,
};
