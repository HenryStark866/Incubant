import { Response } from 'express';

let clients: Response[] = [];

export function addClient(res: Response) {
  clients.push(res);
}

export function removeClient(res: Response) {
  clients = clients.filter(c => c !== res);
}

export function sendEventToAll(data: any) {
  console.log(`[SSE] Sending event to ${clients.length} clients:`, data.type);
  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(formattedData);
    } catch (err) {
      console.warn('[SSE] Error sending to client, removing...');
      removeClient(client);
    }
  });
}
