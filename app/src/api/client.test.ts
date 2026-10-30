import { createFakeAuth, fakeSession, setAuth, type FakeAuth } from '../services/auth';
import { useAuth } from '../state/auth';
import { ApiError, NetworkError, api } from './client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body }) as Response;
const fetchMock = jest.fn();
let auth: FakeAuth;
beforeEach(() => {
  auth = createFakeAuth({ session: fakeSession() });
  setAuth(auth);
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  useAuth.setState({ session: fakeSession(), sessionEnded: false });
});
afterEach(() => setAuth(null));

const bearer = (i: number) => fetchMock.mock.calls[i][1].headers.authorization;

describe('api client auth', () => {
  it('sends the provider token as a Bearer header', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { ok: 1 }));
    await expect(api('/me')).resolves.toEqual({ ok: 1 });
    expect(bearer(0)).toBe('Bearer fake-access-token');
  });

  it('sends no header when signed out', async () => {
    auth.session = null;
    fetchMock.mockResolvedValueOnce(res(200, {}));
    await api('/content/version');
    expect(bearer(0)).toBeUndefined();
  });

  it('on 401 refreshes once and repeats the request with the new token', async () => {
    auth.refreshResult = { ok: true, session: fakeSession() };
    fetchMock.mockResolvedValueOnce(res(401)).mockImplementationOnce(async () => res(200, { again: true }));
    auth.token = 'new-token';
    await expect(api('/me')).resolves.toEqual({ again: true });
    expect(auth.refreshCalls).toBe(1);
    expect(bearer(1)).toBe('Bearer new-token');
    expect(useAuth.getState().session).not.toBeNull();
  });

  it('signs out kindly when the refresh is rejected', async () => {
    fetchMock.mockResolvedValueOnce(res(401));
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError);
    expect(auth.signOutCalls).toBe(1);
    expect(useAuth.getState()).toMatchObject({ session: null, sessionEnded: true });
  });

  it('signs out when the second try is also refused', async () => {
    auth.refreshResult = { ok: true, session: fakeSession() };
    fetchMock.mockResolvedValue(res(401));
    await expect(api('/me')).rejects.toMatchObject({ status: 401 });
    expect(auth.refreshCalls).toBe(1);
    expect(useAuth.getState().sessionEnded).toBe(true);
  });

  it('stays signed in when the refresh fails only for lack of a network', async () => {
    auth.refreshResult = { ok: false, reason: 'offline' };
    fetchMock.mockResolvedValueOnce(res(401));
    await expect(api('/me')).rejects.toMatchObject({ status: 401 });
    expect(useAuth.getState().sessionEnded).toBe(false);
    expect(auth.signOutCalls).toBe(0);
  });

  it('reports a dead network as NetworkError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(api('/me')).rejects.toBeInstanceOf(NetworkError);
  });
});
