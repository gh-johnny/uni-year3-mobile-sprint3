import { create } from 'zustand';

import type { Tone } from '../design-system/theme/theme';

export type Toast = { id: number; tone: Tone; title: string; message?: string };

type ToastState = {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
};

let sequence = 0;

/** In-app notifications — the design-system replacement for `Alert.alert`. */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: (toast) => {
    sequence += 1;
    const id = sequence;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
