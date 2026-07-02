import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'export/pages/:pageId',
    loadComponent: () =>
      import('./features/pages/components/page-pdf-export/page-pdf-export.component').then(
        (module) => module.PagePdfExportComponent,
      ),
  },
  {
    path: 'pages/:pageId',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  {
    path: 'spaces/:spaceId',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  {
    path: 'storage',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  { path: '**', redirectTo: '' },
];
