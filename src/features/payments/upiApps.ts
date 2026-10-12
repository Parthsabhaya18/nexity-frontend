import { Linking } from 'react-native';

import type { UpiApp } from './razorpay';

const SCHEMES: Record<Exclude<UpiApp, 'upi_id'>, string[]> = {
  google_pay: ['tez://', 'gpay://upi'],
  phonepe: ['phonepe://'],
  paytm: ['paytmmp://', 'paytm://'],
  bhim: ['bhim://upi', 'bhim://'],
};

/** UPI apps this phone can open. `null` means the check itself failed, so show every app. */
export async function installedUpiApps(): Promise<UpiApp[] | null> {
  try {
    const apps: UpiApp[] = [];
    for (const id of ['google_pay', 'phonepe', 'paytm', 'bhim'] as const) {
      let found = false;
      for (const scheme of SCHEMES[id]) {
        if (await Linking.canOpenURL(scheme)) {
          found = true;
          break;
        }
      }
      if (found) apps.push(id);
    }
    apps.push('upi_id');
    return apps;
  } catch {
    return null;
  }
}
