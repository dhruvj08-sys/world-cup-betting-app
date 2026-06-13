import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// Function to create a new connection pool.
export const createPool = () => {
  return new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    connectionTimeoutMillis: 15000,
    max: 1, // Limit connections for serverless environments
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
