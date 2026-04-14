import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  {
    path: 'pages/:pageId',
    loadComponent: () =>
      import('./features/shell/shell.component').then((module) => module.ShellComponent),
  },
  { path: '**', redirectTo: '' },
];
