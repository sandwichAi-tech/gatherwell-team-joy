import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getMapsConfig } from '@/lib/maps.functions';

declare global { interface Window { google?: any; __gwMapsLoading?: Promise<void> } }

/** Loads the maps script once (with Places) using the key served by the backend. */
export function loadMaps(key: string) {
  if (window.google?.maps) return Promise.resolve();
  if (!window.__gwMapsLoading) window.__gwMapsLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('maps_failed')); document.head.appendChild(s);
  });
  return window.__gwMapsLoading;
}

export function useMapsKey() {
  const fetchConfig = useServerFn(getMapsConfig);
  return useQuery({ queryKey: ['maps-config'], queryFn: () => fetchConfig(), staleTime: 10 * 60 * 1000 }).data?.key ?? null;
}
