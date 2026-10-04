import { PermissionsAndroid, Platform } from 'react-native';

import {
  androidPermissionGroup,
  androidPermissionName,
  permissionMessage,
  requestAccess,
} from '../src/features/media/permissionPrompt';

describe('permission prompt', () => {
  it('tells iOS to turn the switch on in Nexity settings', () => {
    expect(permissionMessage('photos', 'ios')).toContain('Photos');
    expect(permissionMessage('camera', 'ios')).toContain(
      'Settings opens on Nexity',
    );
  });

  it('tells Android to open that permission switch', () => {
    expect(permissionMessage('microphone', 'android')).toContain('Microphone');
    expect(permissionMessage('location', 'android')).toContain(
      'Location switch',
    );
  });

  it('maps each kind to its own Android switch', () => {
    expect(androidPermissionName('photos', 31)).toBe(
      'android.permission.READ_EXTERNAL_STORAGE',
    );
    expect(androidPermissionName('photos', 33)).toBe(
      'android.permission.READ_MEDIA_IMAGES',
    );
    expect(androidPermissionName('camera', 31)).toBe(
      'android.permission.CAMERA',
    );
    expect(androidPermissionGroup('camera', 31)).toBe(
      'android.permission-group.CAMERA',
    );
    expect(androidPermissionGroup('microphone', 31)).toBe(
      'android.permission-group.MICROPHONE',
    );
    expect(androidPermissionGroup('location', 31)).toBe(
      'android.permission-group.LOCATION',
    );
    expect(androidPermissionGroup('photos', 31)).toBe(
      'android.permission-group.STORAGE',
    );
  });
});

describe('requestAccess on Android', () => {
  const os = Platform.OS;
  const version = Platform.Version;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    Object.defineProperty(Platform, 'Version', {
      value: 31,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    Object.defineProperty(Platform, 'Version', {
      value: version,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  it('asks with the phone dialog when access is off', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const ask = jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({ 'android.permission.CAMERA': 'granted' } as never);
    await expect(requestAccess('camera')).resolves.toBe('granted');
    expect(ask).toHaveBeenCalledWith(['android.permission.CAMERA']);
  });

  it('does not ask again when access is already on', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const ask = jest.spyOn(PermissionsAndroid, 'requestMultiple');
    await expect(requestAccess('photos')).resolves.toBe('granted');
    expect(ask).not.toHaveBeenCalled();
  });

  it('reports a first "Don\'t allow" as denied, so the app can ask again', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({
        'android.permission.RECORD_AUDIO': 'denied',
      } as never);
    await expect(requestAccess('microphone')).resolves.toBe('denied');
  });

  it('reports a permanent deny as blocked, the only time Settings is offered', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      'android.permission.READ_EXTERNAL_STORAGE': 'never_ask_again',
    } as never);
    await expect(requestAccess('photos')).resolves.toBe('blocked');
  });
});
