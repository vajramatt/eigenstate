// SPDX-License-Identifier: MIT
type WorkerContainer = Pick<ServiceWorkerContainer, 'controller' | 'addEventListener' | 'removeEventListener'>;

/** New assets are ready for the next navigation; leave the current view running. */
export function observeUpdates(workers: WorkerContainer, notify: () => void): () => void {
  let previous = workers.controller;
  const changed = () => {
    const current = workers.controller;
    if (previous && current && current !== previous) notify();
    previous = current;
  };
  workers.addEventListener('controllerchange', changed);
  return () => workers.removeEventListener('controllerchange', changed);
}
