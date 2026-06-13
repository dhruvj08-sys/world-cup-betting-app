import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import * as schema from './schema.js';

// Function to create a new connection pool.
export const createPool = () => {
  const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return new Pool({
    connectionString: connString,
    connectionTimeoutMillis: 15000,
    max: 1,
    ssl: connString?.includes('sslmode=require') ? true : undefined,
  });
};

// Create a pool instance.
const pool = createPool();

// Prevent unhandled pool-level errors from crashing the application
pool.on('error', (err) => {
  console.error('Unexpected error on idle SQL pool client:', err);
});

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
