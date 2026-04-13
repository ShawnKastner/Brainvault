import { ApplicationConfig, InjectionToken } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const API_URL = new InjectionToken<string>('API_URL');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: API_URL, useValue: 'http://localhost:3000/api' },
  ],
};
