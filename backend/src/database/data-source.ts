import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './data-source.options';

loadEnv();

export default new DataSource(createDatabaseOptions({ migrationsRun: false }));
