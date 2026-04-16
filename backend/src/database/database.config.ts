import { registerAs } from '@nestjs/config';
import { createDatabaseOptions } from './data-source.options';

export const databaseConfig = registerAs('database', () => createDatabaseOptions());
