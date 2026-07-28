/**
 * Service worker registration and the update toast (§9).
 *
 * The toast is non-blocking and never auto-reloads — swapping the page out
 * from under someone mid-read is worse than showing a stale note.
 */

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // `controller` present means this is an update, not a first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(installing);
            }
          });
        });
      })
      .catch(() => {
        /* offline support is an enhancement; failing to register is survivable */
      });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

function showUpdateToast(worker: ServiceWorker) {
  if (document.querySelector('.toast')) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');

  const text = document.createElement('p');
  text.className = 'toast-text';
  text.textContent = 'A newer build is available.';

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'toast-action';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => worker.postMessage('SKIP_WAITING'));

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss update notice');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => toast.remove());

  toast.append(text, reload, dismiss);
  document.body.append(toast);
}
