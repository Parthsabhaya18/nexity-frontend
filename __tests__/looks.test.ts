import { LOOKS, lookTint } from '../src/features/media/looks';

describe('looks', () => {
  it('leaves a normal photo unchanged', () => {
    expect(lookTint('normal')).toBeNull();
    expect(lookTint(undefined)).toBeNull();
    expect(lookTint('unknown')).toBeNull();
  });

  it('returns a wash for every named filter', () => {
    for (const look of LOOKS) {
      if (look.id === 'normal') continue;
      expect(lookTint(look.id)).toBe(look.tint);
    }
    expect(LOOKS.map(look => look.id)).toEqual([
      'normal',
      'clarendon',
      'juno',
      'lark',
      'valencia',
      'ocean',
      'fade',
      'moon',
    ]);
  });
});
