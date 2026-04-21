import { Routes } from '@angular/router';

export const routes: Routes = [
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
