import { ObsidianClient, ObsidianConfig } from "./client.js";

export async function isObsidianReachable(config: ObsidianConfig): Promise<boolean> {
  const client = new ObsidianClient(config);
  return client.isReachable();
}

export async function waitForObsidian(
  config: ObsidianConfig,
  timeoutMs: number
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isObsidianReachable(config)) return true;
    await sleep(1000);
  }
  return false;
}

export interface HealthPoller {
  start(): void;
  stop(): void;
  onStatusChange(cb: (reachable: boolean) => void): void;
}

export function createHealthPoller(
  config: ObsidianConfig,
  intervalMs: number
): HealthPoller {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastStatus: boolean | null = null;
  const listeners: Array<(reachable: boolean) => void> = [];

  async function poll() {
    const reachable = await isObsidianReachable(config);
    if (reachable !== lastStatus) {
      lastStatus = reachable;
      for (const cb of listeners) cb(reachable);
    }
  }

  return {
    start() {
      poll();
      timer = setInterval(poll, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    onStatusChange(cb) {
      listeners.push(cb);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
