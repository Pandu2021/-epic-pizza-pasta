// Temporary minimal type declarations for 'pg' to silence TS7016.
// If you later install full types, remove this file.

declare module 'pg' {
  export interface ClientConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
  }
  export interface QueryResult<T = any> { rows: T[]; rowCount: number }
  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  }
  export interface PoolConfig extends ClientConfig { max?: number; idleTimeoutMillis?: number }
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<Client>;
    end(): Promise<void>;
    query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  }
}
