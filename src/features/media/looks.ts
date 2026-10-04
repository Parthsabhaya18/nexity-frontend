export const LOOKS = [
  { id: 'normal', name: 'Normal', swatch: '#E5E7EB', tint: null },
  {
    id: 'clarendon',
    name: 'Clarendon',
    swatch: '#38BDF8',
    tint: 'rgba(56,189,248,0.22)',
  },
  { id: 'juno', name: 'Juno', swatch: '#FB923C', tint: 'rgba(251,146,60,0.2)' },
  {
    id: 'lark',
    name: 'Lark',
    swatch: '#FDE68A',
    tint: 'rgba(255,255,255,0.16)',
  },
  {
    id: 'valencia',
    name: 'Valencia',
    swatch: '#FDBA74',
    tint: 'rgba(253,186,116,0.28)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: '#22D3EE',
    tint: 'rgba(34,211,238,0.22)',
  },
  {
    id: 'fade',
    name: 'Fade',
    swatch: '#F8FAFC',
    tint: 'rgba(255,255,255,0.28)',
  },
  { id: 'moon', name: 'Moon', swatch: '#64748B', tint: 'rgba(15,23,42,0.38)' },
] as const;

export type LookId = (typeof LOOKS)[number]['id'];

export function lookTint(id?: string | null) {
  return LOOKS.find(look => look.id === id)?.tint ?? null;
}
