import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";
import { JsonLineParser } from "./jsonl";
import { redactLogLine } from "./util";

export interface JsonRpcClientOptions {
  defaultTimeoutMs?: number;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

export class JsonRpcStdioClient extends EventEmitter {
  private nextId = 1;
  private readonly parser = new JsonLineParser();
  private readonly pending = new Map<number, PendingRequest>();
  private readonly defaultTimeoutMs: number;
  private disposed = false;

  constructor(
    private readonly input: Writable,
    output: Readable,
    stderr?: Readable,
    options: JsonRpcClientOptions = {},
  ) {
    super();
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 15_000;

    output.on("data", (chunk) => this.handleOutput(chunk));
    output.on("error", (error) => this.rejectAll(error instanceof Error ? error : new Error(String(error))));
    output.on("end", () => this.rejectAll(new Error("JSON-RPC output ended")));

    stderr?.on("data", (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) {
          this.emit("stderr", redactLogLine(line));
        }
      }
    });
  }

  request(method: string, params?: unknown, timeoutMs = this.defaultTimeoutMs): Promise<unknown> {
    if (this.disposed) {
      return Promise.reject(new Error("JSON-RPC client is disposed"));
    }

    const id = this.nextId++;
    const message: Record<string, unknown> = { id, method };
    if (params !== undefined) {
      message.params = params;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { method, resolve, reject, timer });
      this.input.write(`${JSON.stringify(message)}\n`, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.disposed) {
      return;
    }
    const message: Record<string, unknown> = { method };
    if (params !== undefined) {
      message.params = params;
    }
    this.input.write(`${JSON.stringify(message)}\n`);
  }

  dispose(): void {
    this.disposed = true;
    this.rejectAll(new Error("JSON-RPC client disposed"));
  }

  private handleOutput(chunk: Buffer | string): void {
    let messages: unknown[];
    try {
      messages = this.parser.push(chunk);
    } catch (error) {
      this.emit("protocolError", error instanceof Error ? error : new Error(String(error)));
      return;
    }

    for (const message of messages) {
      this.handleMessage(message);
    }
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== "object") {
      this.emit("protocolError", new Error("JSON-RPC message is not an object"));
      return;
    }

    const record = message as Record<string, unknown>;
    if (typeof record.id === "number" && this.pending.has(record.id)) {
      const pending = this.pending.get(record.id)!;
      this.pending.delete(record.id);
      clearTimeout(pending.timer);

      if ("error" in record) {
        const rpcError = record.error as { message?: unknown } | undefined;
        pending.reject(new Error(String(rpcError?.message ?? `JSON-RPC error in ${pending.method}`)));
      } else {
        pending.resolve(record.result);
      }
      return;
    }

    if (typeof record.method === "string" && !("id" in record)) {
      this.emit("notification", { method: record.method, params: record.params } satisfies JsonRpcNotification);
      return;
    }

    this.emit("unmatchedMessage", record);
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
