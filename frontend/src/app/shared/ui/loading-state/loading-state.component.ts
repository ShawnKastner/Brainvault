import { Component } from '@angular/core';

@Component({
  selector: 'bv-loading-state',
  standalone: true,
  template: '<p class="loading-state">Laedt...</p>',
  styles: [
    `
      .loading-state {
        color: var(--color-text-muted);
        font-size: 0.875rem;
        padding: 1rem;
      }
    `,
  ],
})
export class LoadingStateComponent {}
