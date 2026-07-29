/**
 * GitHub-style copy button on every fenced code block (§7.6).
 *
 * Injected client-side rather than at build time: the button is inert without
 * JS, and a dead affordance in the static HTML is worse than no affordance.
 * Each `<pre>` gains a positioned wrapper so the button can sit in the corner
 * without riding the block's own horizontal scroll.
 */

const ICON_COPY = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>`;

const ICON_DONE = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>`;

/** How long the confirmation state sticks before reverting to the copy icon. */
const CONFIRM_MS = 2000;

export function initCopyCode() {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
    if (pre.parentElement?.classList.contains('code-block')) continue;
    mount(pre);
  }
}

function mount(pre: HTMLPreElement) {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.append(pre);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.innerHTML = ICON_COPY;
  setLabel(button, 'Copy');

  // The feedback lives in its own polite region rather than on the button's
  // label: renaming the control mid-interaction is what screen readers announce
  // as a *different* button, and the focus stays put.
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');

  let timer = 0;

  button.addEventListener('click', async () => {
    const ok = await writeClipboard(codeOf(pre));
    window.clearTimeout(timer);

    button.innerHTML = ok ? ICON_DONE : ICON_COPY;
    button.dataset.state = ok ? 'copied' : 'failed';
    setLabel(button, ok ? 'Copied' : 'Copy failed');
    status.textContent = ok ? 'Copied to clipboard' : 'Copy failed';

    timer = window.setTimeout(() => {
      button.innerHTML = ICON_COPY;
      delete button.dataset.state;
      setLabel(button, 'Copy');
      status.textContent = '';
    }, CONFIRM_MS);
  });

  wrapper.append(button, status);
}

function setLabel(button: HTMLButtonElement, label: string) {
  button.setAttribute('aria-label', label);
  button.title = label;
}

/**
 * Shiki emits one `<span class="line">` per line with the newlines as sibling
 * text nodes, so `textContent` already reconstructs the source verbatim. Only
 * the trailing newline needs trimming — pasting it lands the cursor on a blank
 * line, which is never what was wanted.
 */
function codeOf(pre: HTMLPreElement): string {
  const code = pre.querySelector('code') ?? pre;
  return (code.textContent ?? '').replace(/\n+$/, '');
}

async function writeClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied permission or a non-secure context; fall through.
    }
  }

  return legacyCopy(text);
}

/** `file://` previews and http origins have no async clipboard. */
function legacyCopy(text: string): boolean {
  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('readonly', '');
  scratch.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.append(scratch);

  try {
    scratch.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    scratch.remove();
  }
}
