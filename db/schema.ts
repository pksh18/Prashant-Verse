import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const portfolios=sqliteTable('portfolios',{userId:text('user_id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0)});

// Preserve previous INR portfolios unchanged. USD portfolios begin at the requested new capital.
export const portfoliosUsd=sqliteTable('portfolios_usd',{userId:text('user_id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0)});

// Shared public market data; leases prevent multiple tabs fetching the same candle window.
export const marketCache=sqliteTable('market_cache',{key:text('key').primaryKey(),payload:text('payload'),expiresAt:integer('expires_at').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0),leaseOwner:text('lease_owner'),error:text('error')});
