export class JsonLineParser {
  private buffer = "";

  push(chunk: Buffer | string): unknown[] {
    this.buffer += chunk.toString();
    const messages: unknown[] = [];

    for (;;) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) {
        break;
      }

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }

      messages.push(JSON.parse(line));
    }

    return messages;
  }

  pendingText(): string {
    return this.buffer;
  }
}
