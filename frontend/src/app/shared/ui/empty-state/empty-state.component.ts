import { Component, input } from '@angular/core';

@Component({
  selector: 'bv-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
        <rect x="8" y="4" width="32" height="40" rx="3" />
        <path d="M16 16h16M16 22h16M16 28h10" />
      </svg>
      <p>{{ title() }}</p>
      <span>{{ description() }}</span>
    </div>
  `,
  styles: [
    `
      .empty-state {
        align-items: center;
        color: var(--color-text-muted);
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
        height: 100%;
        justify-content: center;
        padding: 2.5rem;
        text-align: center;
      }

      svg {
        height: 2.5rem;
        opacity: 0.35;
        width: 2.5rem;
      }

      p {
        color: var(--color-text);
        font-size: 0.95rem;
        margin: 0;
      }

      span {
        font-size: 0.8rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly title = input('Waehle eine Seite aus der Navigation');
  readonly description = input('oder erstelle eine neue Seite.');
}
