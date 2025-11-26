// This file helps the LSP recognize Cloudflare Workers types
// by explicitly using them in a file that's part of src/**

interface IWorkerEnv extends Env {
  POSTMARK_API_TOKEN: string;
  CANONICAL_URL: string;
}

export type WorkerEnv = IWorkerEnv;