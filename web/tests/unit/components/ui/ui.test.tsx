// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { Status, type StatusTone } from '@/components/ui/status';
import { Drawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { Table, Td, Th } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastProvider, useToast } from '@/components/ui/toast';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let host: HTMLDivElement;
let root: Root;

function mount(node: ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}

function rerender(node: ReactNode) {
  act(() => root.render(node));
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('Button', () => {
  it('pending uses aria-disabled, never disabled, and keeps focus across a re-render', () => {
    const onClick = vi.fn();
    mount(<Button onClick={onClick}>Save changes</Button>);
    const btn = host.querySelector('button') as HTMLButtonElement;
    act(() => btn.focus());
    expect(document.activeElement).toBe(btn);

    rerender(<Button pending onClick={onClick}>Save changes</Button>);
    const pending = host.querySelector('button') as HTMLButtonElement;
    expect(pending).toBe(btn);
    expect(pending.getAttribute('aria-disabled')).toBe('true');
    expect(pending.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(pending);

    act(() => pending.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its label in the DOM while pending so the width does not change', () => {
    mount(<Button pending pendingLabel="Saving">Save changes</Button>);
    expect(host.textContent).toContain('Save changes');
    expect(host.textContent).toContain('Saving');
  });

  it('is not aria-disabled when idle, and fires onClick', () => {
    const onClick = vi.fn();
    mount(<Button onClick={onClick}>Go</Button>);
    const btn = host.querySelector('button') as HTMLButtonElement;
    expect(btn.hasAttribute('aria-disabled')).toBe(false);
    act(() => btn.click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Status', () => {
  const tones: StatusTone[] = ['live', 'waiting', 'done', 'failed', 'paused'];
  it.each(tones)('renders its text label for %s', (tone) => {
    mount(<Status tone={tone} label={`label-${tone}`} />);
    expect(host.textContent).toBe(`label-${tone}`);
    expect(host.querySelector(`[data-tone="${tone}"]`)).not.toBeNull();
  });
});

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" id="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      <main id="page">page</main>
      <Drawer open={open} onClose={() => setOpen(false)} title="Details">
        <button type="button" id="inside">Inside</button>
      </Drawer>
    </div>
  );
}

describe('Drawer', () => {
  it('moves focus in, makes the page inert, closes on Escape and returns focus to the trigger', () => {
    vi.useFakeTimers();
    mount(<DrawerHarness />);
    const trigger = host.querySelector('#trigger') as HTMLButtonElement;
    act(() => trigger.focus());
    act(() => trigger.click());

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(host.hasAttribute('inert')).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.activeElement).toBe(trigger);
    expect(host.hasAttribute('inert')).toBe(false);

    act(() => {
      vi.runAllTimers();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on backdrop click', () => {
    vi.useFakeTimers();
    mount(<DrawerHarness />);
    act(() => (host.querySelector('#trigger') as HTMLButtonElement).click());
    const backdrop = document.querySelector('[data-drawer-backdrop]') as HTMLElement;
    act(() => backdrop.click());
    expect((document.querySelector('[role="dialog"]') as HTMLElement).dataset.state).toBe('closed');
  });
});

describe('EmptyState', () => {
  it('renders exactly one primary action', () => {
    const onClick = vi.fn();
    mount(
      <EmptyState
        title="No matches yet"
        body="Matches appear once a round has run."
        action={{ label: 'Upload a bot', onClick }}
        secondary={{ label: 'Read the rules', href: '/docs' }}
      />,
    );
    expect(host.querySelectorAll('[data-primary-action]').length).toBe(1);
    expect(host.querySelectorAll('[data-variant="ink"]').length).toBe(1);
    expect(host.textContent).toContain('Read the rules');
    act(() => (host.querySelector('[data-primary-action]') as HTMLButtonElement).click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows title and body without any action', () => {
    mount(<EmptyState title="Nothing here" body="Come back later." />);
    expect(host.querySelectorAll('[data-primary-action]').length).toBe(0);
    expect(host.textContent).toContain('Come back later.');
  });
});

describe('Tabs', () => {
  const items = [
    { id: 'a', label: 'Overview', content: <p>panel a</p> },
    { id: 'b', label: 'Matches', content: <p>panel b</p> },
    { id: 'c', label: 'Versions', content: <p>panel c</p> },
  ];

  it('selects with arrow keys and keeps one tab in the tab order', () => {
    mount(<Tabs label="Bot" items={items} />);
    const tabs = [...host.querySelectorAll('[role="tab"]')] as HTMLElement[];
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    act(() => tabs[0].focus());
    act(() => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    expect((host.querySelector('[role="tabpanel"]') as HTMLElement).textContent).toBe('panel b');
    act(() => {
      tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
  });

  it('wraps from the last tab to the first', () => {
    mount(<Tabs label="Bot" items={items} defaultId="c" />);
    const tabs = [...host.querySelectorAll('[role="tab"]')] as HTMLElement[];
    act(() => tabs[2].focus());
    act(() => {
      tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });
});

describe('Tooltip', () => {
  it('describes its trigger and is non-interactive', () => {
    mount(
      <Tooltip label="Copy seed">
        <button type="button">Copy</button>
      </Tooltip>,
    );
    const tip = host.querySelector('[role="tooltip"]') as HTMLElement;
    const btn = host.querySelector('button') as HTMLButtonElement;
    expect(tip.textContent).toBe('Copy seed');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });
});

describe('Table', () => {
  it('marks numeric cells and headers with the num class', () => {
    mount(
      <Table caption="Standings">
        <thead>
          <tr>
            <Th>Bot</Th>
            <Th num>Elo</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>glider</Td>
            <Td num>1523</Td>
          </tr>
        </tbody>
      </Table>,
    );
    expect(host.querySelectorAll('.num').length).toBe(2);
    expect(host.querySelector('caption')?.textContent).toBe('Standings');
  });
});

describe('Skeleton', () => {
  it('renders the requested number of rows and announces loading once', () => {
    mount(<Skeleton rows={4} />);
    expect(host.querySelectorAll('[data-skeleton]').length).toBe(4);
    expect(host.querySelectorAll('[role="status"]').length).toBe(1);
  });

  it('floors a zero or negative row count at one row', () => {
    mount(<Skeleton rows={0} />);
    expect(host.querySelectorAll('[data-skeleton]').length).toBe(1);
  });
});

function ToastHarness() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ title: 'Bot uploaded', body: 'Version 3 is queued.' })}>
      Fire
    </button>
  );
}

describe('Toast', () => {
  it('announces through a polite live region that exists before the toast does', () => {
    vi.useFakeTimers();
    mount(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    const region = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.textContent).toBe('');
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    expect(region.textContent).toContain('Bot uploaded');
    expect(region.textContent).toContain('Version 3 is queued.');
  });

  it('removes a toast after it is dismissed', () => {
    vi.useFakeTimers();
    mount(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    const close = document.querySelector('[aria-live="polite"] button') as HTMLButtonElement;
    act(() => close.click());
    act(() => {
      vi.runAllTimers();
    });
    expect((document.querySelector('[aria-live="polite"]') as HTMLElement).textContent).toBe('');
  });
});
