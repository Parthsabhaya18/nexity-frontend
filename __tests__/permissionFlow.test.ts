jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);
jest.mock('../src/components/ui/Toast', () => ({ showToast: jest.fn() }));
jest.mock('../src/features/media/permissionPrompt', () => ({
  openPermissionSettings: jest.fn(() => Promise.resolve()),
}));

type Native = { check: jest.Mock; request: jest.Mock };
type Flow = typeof import('../src/features/permissions/permissionFlow');
type Perms = typeof import('../src/features/permissions/permissions');

let native: Native;
let flow: Flow;
let perms: Perms;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  native = require('react-native-permissions');
  flow = require('../src/features/permissions/permissionFlow');
  perms = require('../src/features/permissions/permissions');
});

afterEach(() => {
  jest.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('permission decisions', () => {
  it('runs straight away when allowed, including Limited Photos', () => {
    expect(perms.firstStep('granted')).toBe('run');
    expect(perms.firstStep('limited')).toBe('run');
  });

  it('asks with our sheet first, never the OS popup cold', () => {
    expect(perms.firstStep('denied')).toBe('ask');
  });

  it('goes to Settings only when the OS will not ask again', () => {
    expect(perms.firstStep('blocked')).toBe('settings');
    expect(perms.afterRequest('blocked')).toBe('settings');
    expect(perms.afterRequest('denied')).toBe('denied');
    expect(perms.afterRequest('granted')).toBe('run');
  });
});

describe('runWithPermission', () => {
  it('continues the action immediately when already granted', async () => {
    native.check.mockResolvedValue('granted');
    const action = jest.fn();
    await expect(flow.runWithPermission('camera', action)).resolves.toBe('granted');
    expect(action).toHaveBeenCalledTimes(1);
    expect(flow.getPending()).toBeNull();
    expect(native.request).not.toHaveBeenCalled();
  });

  it('shows our sheet, then the OS popup on Allow, then continues', async () => {
    native.check.mockResolvedValue('denied');
    native.request.mockResolvedValue('granted');
    const action = jest.fn();
    const done = flow.runWithPermission('camera', action);
    await flush();
    expect(flow.getPending()?.phase).toBe('ask');
    expect(native.request).not.toHaveBeenCalled();

    await flow.allowPending();
    await expect(done).resolves.toBe('granted');
    jest.runAllTimers();
    expect(action).toHaveBeenCalledTimes(1);
    expect(flow.getPending()).toBeNull();
  });

  it('offers Try again after a denial, then Open Settings once blocked', async () => {
    native.check.mockResolvedValue('denied');
    native.request.mockResolvedValueOnce('denied').mockResolvedValueOnce('blocked');
    const action = jest.fn();
    const done = flow.runWithPermission('microphone', action);
    await flush();

    await flow.allowPending();
    expect(flow.getPending()?.phase).toBe('denied');

    await flow.allowPending();
    expect(flow.getPending()?.phase).toBe('blocked');

    flow.dismissPending();
    await expect(done).resolves.toBe('blocked');
    expect(action).not.toHaveBeenCalled();
  });

  it('remembers a permanent deny that Android check reports as denied', async () => {
    native.check.mockResolvedValue('denied');
    native.request.mockResolvedValue('blocked');
    const first = flow.runWithPermission('camera');
    await flush();
    await flow.allowPending();
    flow.dismissPending();
    await first;

    flow.runWithPermission('camera');
    await flush();
    expect(flow.getPending()?.phase).toBe('blocked');
  });

  it('continues by itself when access is turned on in Settings', async () => {
    native.check.mockResolvedValue('blocked');
    const action = jest.fn();
    const done = flow.runWithPermission('camera', action);
    await flush();
    expect(flow.getPending()?.phase).toBe('blocked');

    await flow.openSettingsForPending();
    native.check.mockResolvedValue('granted');
    await flow.recheckPending();
    await expect(done).resolves.toBe('granted');
    jest.runAllTimers();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not re-check on foreground unless Settings was opened', async () => {
    native.check.mockResolvedValue('denied');
    flow.runWithPermission('camera');
    await flush();
    native.check.mockResolvedValue('granted');
    await flow.recheckPending();
    expect(flow.getPending()?.phase).toBe('ask');
  });
});
