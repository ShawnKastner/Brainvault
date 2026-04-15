import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'bv-confirm-modal',
  standalone: true,
  template: `
    @if (open()) {
      <div class="confirm-modal">
        <button
          type="button"
          class="modal-backdrop"
          aria-label="Dialog schliessen"
          [disabled]="pending()"
          (click)="cancel.emit()"
        ></button>

        <section
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-message"
        >
          <div class="modal-icon" [class.danger]="danger()" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6.4 2.4h3.2l.6 1.2H14M2 3.6h12M4 5.8l.5 7.2h7l.5-7.2" />
              <path d="M6.5 7.2v3.9M9.5 7.2v3.9" />
            </svg>
          </div>

          <div class="modal-content">
            <h2 id="confirm-modal-title">{{ title() }}</h2>
            <p id="confirm-modal-message">{{ message() }}</p>
          </div>

          <div class="modal-actions">
            <button type="button" class="button" [disabled]="pending()" (click)="cancel.emit()">
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              class="button"
              [class.danger]="danger()"
              [disabled]="pending()"
              (click)="confirm.emit()"
            >
              {{ pending() ? pendingLabel() : confirmLabel() }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .confirm-modal {
        align-items: center;
        display: flex;
        inset: 0;
        justify-content: center;
        padding: 1rem;
        position: fixed;
        z-index: 40;
      }

      .modal-backdrop {
        background: rgba(0, 0, 0, 0.28);
        border: 0;
        cursor: pointer;
        inset: 0;
        position: absolute;
      }

      .modal-backdrop:disabled {
        cursor: not-allowed;
      }

      .modal-panel {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: 0 1.25rem 3.5rem rgba(0, 0, 0, 0.22);
        color: var(--color-text);
        display: grid;
        gap: 1rem;
        max-width: 28rem;
        padding: 1.25rem;
        position: relative;
        width: min(100%, 28rem);
      }

      .modal-icon {
        align-items: center;
        background: var(--color-accent-soft);
        border-radius: var(--radius-md);
        color: var(--color-accent-strong);
        display: flex;
        height: 2.25rem;
        justify-content: center;
        width: 2.25rem;
      }

      .modal-icon.danger {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }

      .modal-icon svg {
        height: 1.1rem;
        width: 1.1rem;
      }

      .modal-content {
        display: grid;
        gap: 0.4rem;
      }

      h2 {
        font-size: 1rem;
        line-height: 1.35;
      }

      p {
        color: var(--color-text-soft);
        font-size: 0.86rem;
        line-height: 1.5;
      }

      .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      @media (max-width: 520px) {
        .modal-panel {
          padding: 1rem;
        }

        .modal-actions {
          align-items: stretch;
          flex-direction: column-reverse;
        }

        .modal-actions .button {
          justify-content: center;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly message = input('');
  readonly confirmLabel = input('Loeschen');
  readonly cancelLabel = input('Abbrechen');
  readonly pendingLabel = input('Loescht...');
  readonly pending = input(false);
  readonly danger = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.open() && !this.pending()) {
      this.cancel.emit();
    }
  }
}
