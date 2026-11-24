import type http from 'node:http';

export function createDataActKitServer(options: {
  dataDir: string;
  distDir?: string;
  appOrigin?: string;
  basePath?: string;
  maxMutationsPerMinute?: number;
  maxJsonBodyBytes?: number;
}): {
  handler: http.RequestListener;
  close: () => void;
};
