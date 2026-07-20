import WebSocket from 'ws';

export class WebRcon {
  private host: string;
  private port: number;
  private password: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: string) => void;
      reject: (error: Error) => void;
      parts?: string[];
      lastMessageTime?: number;
    }
  >();

  constructor(host: string, port: number, password: string) {
    this.host = host;
    this.port = port;
    this.password = password;
  }

  connect(timeout = 15000): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://${this.host}:${this.port}/${this.password}`;

      let timeoutTimer: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeoutTimer);
      };

      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          cleanup();
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch {
            // Ignore malformed chunks from the server.
          }
        });

        this.ws.on('error', (error) => {
          cleanup();
          if (!this.connected) {
            reject(new Error(`WebRcon connection error: ${error.message}`));
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          for (const [, { reject: rejectPending }] of this.pendingRequests) {
            rejectPending(new Error('WebSocket connection closed'));
          }
          this.pendingRequests.clear();
        });

        timeoutTimer = setTimeout(() => {
          cleanup();
          this.ws?.close();
          reject(new Error('WebRcon connection timeout'));
        }, timeout);
      } catch (error) {
        cleanup();
        reject(
          new Error(
            `Failed to create WebSocket: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  private handleMessage(message: Record<string, unknown>) {
    const identifier = message.Identifier;

    if (typeof identifier !== 'number' || !this.pendingRequests.has(identifier)) {
      return;
    }

    const request = this.pendingRequests.get(identifier)!;

    if (message.Type === 'Error' || message.Type === 'Warning') {
      request.reject(new Error(typeof message.Message === 'string' ? message.Message : 'Unknown error'));
      return;
    }

    if (!request.parts) {
      request.parts = [];
    }

    if (typeof message.Message === 'string') {
      request.parts.push(message.Message);
    }
    request.lastMessageTime = Date.now();
  }

  // assumeSuccessOnSilence: для команд выдачи (inventory.giveto / oxide.usergroup / kit giveto),
  // которые часто НЕ присылают текстовый ответ. Тогда после silenceMs тишины считаем команду
  // успешно отправленной (resolve ''), а не ждём полный таймаут и не падаем ложным провалом.
  // На явный Type==='Error'/'Warning' от сервера всё равно reject.
  send(
    command: string,
    timeout = 15000,
    options: { assumeSuccessOnSilence?: boolean; silenceMs?: number } = {},
  ): Promise<string> {
    const { assumeSuccessOnSilence = false, silenceMs = 2500 } = options;

    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Not connected to WebRcon server'));
        return;
      }

      const id = this.requestId++;
      const message = {
        Identifier: id,
        Message: command,
        Name: 'WebRcon',
      };

      let settled = false;
      const startedAt = Date.now();

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        clearInterval(checkInterval);
      };

      const finish = (value: string) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        this.pendingRequests.delete(id);
        resolve(value);
      };

      const fail = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        this.pendingRequests.delete(id);
        reject(error);
      };

      this.pendingRequests.set(id, {
        resolve: finish,
        reject: fail,
        parts: [],
      });

      const timeoutTimer = setTimeout(() => {
        const request = this.pendingRequests.get(id);
        if (request?.parts?.length) {
          finish(request.parts.join(''));
          return;
        }

        fail(new Error(`Timeout waiting for WebRcon response (request id ${id})`));
      }, timeout);

      const checkInterval = setInterval(() => {
        const request = this.pendingRequests.get(id);

        if (!request) {
          return;
        }

        if (request.parts?.length && request.lastMessageTime) {
          if (Date.now() - request.lastMessageTime > 200) {
            finish(request.parts.join(''));
          }
          return;
        }

        // Тишина: команда выдачи обычно не отвечает текстом — считаем отправку успешной.
        if (assumeSuccessOnSilence && Date.now() - startedAt > silenceMs) {
          finish('');
        }
      }, 100);

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        fail(
          new Error(
            `Failed to send command: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });
  }

  end() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.pendingRequests.clear();
  }
}
