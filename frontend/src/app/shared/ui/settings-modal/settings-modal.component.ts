import { ChangeDetectionStrategy, Component, HostListener, input, output, inject } from '@angular/core';
import { SettingsService, type ThemeId } from '../../../core/services/settings.service';

interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  swatches: readonly string[];
}

const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'classic',
    name: 'Klassisch',
    description: 'Warm, ruhig und nah an der bisherigen Palette.',
    swatches: ['#EFEDE8', '#FFFFFF', '#BA7517'],
  },
  {
    id: 'clear',
    name: 'Klar',
    description: 'Hell, neutral und mit kuehlem Teal-Akzent.',
    swatches: ['#E8EEEE', '#FFFFFF', '#0F8B8D'],
  },
  {
    id: 'night',
    name: 'Nacht',
    description: 'Dunkles Graphit mit ruhigem Mint-Akzent.',
    swatches: ['#111310', '#20221F', '#64D6B3'],
  },
];

@Component({
  selector: 'bv-settings-modal',
  standalone: true,
  template: `
    @if (open()) {
      <div class="settings-modal">
        <button
          type="button"
          class="modal-backdrop"
          aria-label="Dialog schliessen"
          (click)="close.emit()"
        ></button>

        <section
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-modal-title"
        >
          <header class="modal-header">
            <div>
              <p class="eyebrow">BrainVault</p>
              <h2 id="settings-modal-title">Einstellungen</h2>
            </div>
            <button type="button" class="icon-button" aria-label="Dialog schliessen" (click)="close.emit()">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>

          @if (settingsError(); as error) {
            <p class="settings-alert" role="alert">{{ error }}</p>
          }

          <div class="settings-section">
            <div class="section-copy">
              <h3>Theme</h3>
              <p>Wähle die Farbwelt für deinen Arbeitsbereich.</p>
            </div>

            <div class="theme-grid" role="radiogroup" aria-label="Theme">
              @for (theme of themeOptions; track theme.id) {
                <button
                  type="button"
                  class="theme-card"
                  role="radio"
                  [class.active]="settings().theme === theme.id"
                  [attr.aria-checked]="settings().theme === theme.id"
                  (click)="selectTheme(theme.id)"
                >
                  <span class="swatches" aria-hidden="true">
                    @for (swatch of theme.swatches; track swatch) {
                      <span [style.background]="swatch"></span>
                    }
                  </span>
                  <span class="theme-name">{{ theme.name }}</span>
                  <span class="theme-description">{{ theme.description }}</span>
                </button>
              }
            </div>
          </div>

          <div class="settings-section">
            <div class="section-copy">
              <h3>Navigation</h3>
              <p>Mehr Einträge auf engem Raum.</p>
            </div>

            <button
              type="button"
              class="switch-row"
              role="switch"
              [attr.aria-checked]="settings().compactNavigation"
              (click)="toggleCompactNavigation()"
            >
              <span>
                <strong>Kompakte Navigation</strong>
                <small>Reduziert Abstände in der Sidebar.</small>
              </span>
              <span class="switch" aria-hidden="true"></span>
            </button>
          </div>

          <div class="settings-section">
            <div class="section-copy">
              <h3>Lesen</h3>
              <p>Metadaten in der Seitenansicht.</p>
            </div>

            <button
              type="button"
              class="switch-row"
              role="switch"
              [attr.aria-checked]="settings().showReadingStats"
              (click)="toggleReadingStats()"
            >
              <span>
                <strong>Leseinfos anzeigen</strong>
                <small>Zeigt Wortanzahl und Lesezeit neben dem Datum.</small>
              </span>
              <span class="switch" aria-hidden="true"></span>
            </button>
          </div>

          <footer class="modal-footer">
            <button type="button" class="button" (click)="resetSettings()">
              Einstellungen zurücksetzen
            </button>
            <button type="button" class="button primary" (click)="close.emit()">Fertig</button>
          </footer>
        </section>
      </div>
    }
  `,
  styles: [
    `
      .settings-modal {
        align-items: center;
        display: flex;
        inset: 0;
        justify-content: center;
        padding: 1rem;
        position: fixed;
        z-index: 45;
      }

      .modal-backdrop {
        background: rgba(0, 0, 0, 0.3);
        border: 0;
        cursor: pointer;
        inset: 0;
        position: absolute;
      }

      .modal-panel {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: 0 1.25rem 3.5rem rgba(0, 0, 0, 0.24);
        color: var(--color-text);
        display: grid;
        gap: 1.1rem;
        max-height: min(42rem, calc(100vh - 2rem));
        max-width: 42rem;
        overflow-y: auto;
        padding: 1.25rem;
        position: relative;
        width: min(100%, 42rem);
      }

      .modal-header,
      .modal-footer {
        align-items: center;
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
      }

      .eyebrow {
        color: var(--color-text-muted);
        font-family: var(--font-mono);
        font-size: 0.68rem;
        margin: 0 0 0.2rem;
        text-transform: uppercase;
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      h2 {
        font-size: 1.05rem;
        line-height: 1.3;
      }

      h3 {
        font-size: 0.86rem;
        line-height: 1.35;
      }

      p,
      small,
      .theme-description {
        color: var(--color-text-muted);
        font-size: 0.78rem;
        line-height: 1.45;
      }

      .icon-button {
        align-items: center;
        background: transparent;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text-muted);
        cursor: pointer;
        display: flex;
        height: 2rem;
        justify-content: center;
        width: 2rem;
      }

      .icon-button:hover,
      .icon-button:focus-visible {
        background: var(--color-surface-subtle);
        color: var(--color-text);
        outline: none;
      }

      .icon-button svg {
        height: 0.9rem;
        width: 0.9rem;
      }

      .settings-alert {
        background: var(--color-danger-soft);
        border: 1px solid rgba(190, 45, 64, 0.22);
        border-radius: var(--radius-md);
        color: var(--color-danger);
        padding: 0.65rem 0.75rem;
      }

      .settings-section {
        border-top: 1px solid var(--color-border);
        display: grid;
        gap: 0.75rem;
        padding-top: 1rem;
      }

      .section-copy {
        display: grid;
        gap: 0.2rem;
      }

      .theme-grid {
        display: grid;
        gap: 0.55rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .theme-card {
        background: var(--color-surface-panel);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text);
        cursor: pointer;
        display: grid;
        gap: 0.45rem;
        min-height: 8.25rem;
        padding: 0.75rem;
        text-align: left;
      }

      .theme-card:hover,
      .theme-card:focus-visible {
        border-color: var(--color-accent);
        outline: none;
      }

      .theme-card.active {
        background: var(--color-accent-soft);
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-ring);
      }

      .swatches {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        display: grid;
        grid-template-columns: 1.4fr 1fr 0.65fr;
        height: 2.35rem;
        overflow: hidden;
      }

      .theme-name {
        font-size: 0.82rem;
        font-weight: 700;
      }

      .switch-row {
        align-items: center;
        background: var(--color-surface-panel);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        color: var(--color-text);
        cursor: pointer;
        display: flex;
        gap: 1rem;
        justify-content: space-between;
        padding: 0.75rem;
        text-align: left;
        width: 100%;
      }

      .switch-row:hover,
      .switch-row:focus-visible {
        border-color: var(--color-accent);
        outline: none;
      }

      .switch-row span:first-child {
        display: grid;
        gap: 0.15rem;
      }

      .switch-row strong {
        font-size: 0.82rem;
      }

      .switch {
        background: var(--color-border-strong);
        border-radius: 999px;
        flex: 0 0 auto;
        height: 1.35rem;
        position: relative;
        transition: background 0.15s ease;
        width: 2.35rem;
      }

      .switch::after {
        background: var(--color-surface);
        border-radius: 50%;
        box-shadow: 0 0.12rem 0.35rem rgba(0, 0, 0, 0.2);
        content: '';
        height: 1rem;
        left: 0.18rem;
        position: absolute;
        top: 0.18rem;
        transition: transform 0.15s ease;
        width: 1rem;
      }

      .switch-row[aria-checked='true'] .switch {
        background: var(--color-accent);
      }

      .switch-row[aria-checked='true'] .switch::after {
        transform: translateX(1rem);
      }

      .modal-footer {
        border-top: 1px solid var(--color-border);
        padding-top: 1rem;
      }

      @media (max-width: 640px) {
        .modal-panel {
          padding: 1rem;
        }

        .theme-grid {
          grid-template-columns: 1fr;
        }

        .modal-footer {
          align-items: stretch;
          flex-direction: column-reverse;
        }

        .modal-footer .button {
          justify-content: center;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsModalComponent {
  private readonly settingsService = inject(SettingsService);

  readonly open = input(false);
  readonly close = output<void>();

  protected readonly themeOptions = THEME_OPTIONS;
  protected readonly settings = this.settingsService.settings;
  protected readonly settingsError = this.settingsService.error;

  protected selectTheme(theme: ThemeId): void {
    this.settingsService.setTheme(theme);
  }

  protected toggleCompactNavigation(): void {
    this.settingsService.updateSettings({
      compactNavigation: !this.settings().compactNavigation,
    });
  }

  protected toggleReadingStats(): void {
    this.settingsService.updateSettings({
      showReadingStats: !this.settings().showReadingStats,
    });
  }

  protected resetSettings(): void {
    this.settingsService.reset();
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.open()) {
      this.close.emit();
    }
  }
}
