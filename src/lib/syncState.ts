let activeSyncCount = 0;

export function startGlobalSync() {
  activeSyncCount++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-sync-state', { detail: { syncing: true } }));
  }
}

export function stopGlobalSync() {
  activeSyncCount = Math.max(0, activeSyncCount - 1);
  if (activeSyncCount === 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-sync-state', { detail: { syncing: false } }));
  }
}
