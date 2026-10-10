import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

type NearbyBleNative = {
  supported: () => Promise<boolean>;
  adapterOn: () => Promise<boolean>;
  requestEnable: () => Promise<boolean>;
  start: (ephId: string) => Promise<boolean>;
  updateId: (ephId: string) => Promise<boolean>;
  stop: () => Promise<boolean>;
};

const native = NativeModules.NearbyBle as NearbyBleNative | undefined;

export const nearbyBleAvailable = () => (Platform.OS === 'android' || Platform.OS === 'ios') && Boolean(native);

export function nearbyBleEvents(onSighting: (ephId: string, rssi: number) => void) {
  if (!native) return () => {};
  const emitter = new NativeEventEmitter(NativeModules.NearbyBle);
  const sub = emitter.addListener('NearbyBleSighting', (event: { ephId?: string; rssi?: number }) => {
    if (event.ephId) onSighting(event.ephId, event.rssi ?? -80);
  });
  return () => sub.remove();
}

export const nearbyBle = {
  supported: () => native?.supported() ?? Promise.resolve(false),
  adapterOn: () => native?.adapterOn() ?? Promise.resolve(false),
  requestEnable: () => native?.requestEnable() ?? Promise.resolve(false),
  start: (ephId: string) => native?.start(ephId) ?? Promise.resolve(false),
  updateId: (ephId: string) => native?.updateId(ephId) ?? Promise.resolve(false),
  stop: () => native?.stop() ?? Promise.resolve(true),
};
