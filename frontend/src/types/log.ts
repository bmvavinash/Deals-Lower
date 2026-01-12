export interface LogEntry {
  id?: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  module?: string;
  moduleName?: string;
  message: string;
  [key: string]: any;
}

export interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byModule: Record<string, number>;
  errors: number;
  warnings: number;
  info: number;
  debug: number;
}


















