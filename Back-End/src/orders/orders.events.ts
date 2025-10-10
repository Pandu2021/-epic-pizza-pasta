import { Injectable } from '@nestjs/common';
import { Response } from 'express';

interface Subscriber { id: string; res: Response; orderId: string; }

@Injectable()
export class OrdersEvents {
  private subs = new Set<Subscriber>();

  subscribe(orderId: string, res: Response) {
    const id = `${orderId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const sub: Subscriber = { id, res, orderId };
    this.subs.add(sub);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`event: open\ndata: {"ok":true}\n\n`);
    reqOnClose(res, () => this.unsubscribe(id));
    return id;
  }

  unsubscribe(id: string) {
    for (const s of this.subs) {
      if (s.id === id) {
        try { s.res.end(); } catch {}
        this.subs.delete(s);
        break;
      }
    }
  }

  emit(orderId: string, type: string, payload: any) {
    const data = JSON.stringify({ type, orderId, payload, ts: Date.now() });
    for (const s of [...this.subs]) {
      if (s.orderId === orderId) {
        try { s.res.write(`data: ${data}\n\n`); } catch { this.subs.delete(s); }
      }
    }
  }
}

function reqOnClose(res: Response, cb: () => void) {
  const req = (res as Response & { req?: import('express').Request }).req;
  if (!req) return;
  const done = () => cb();
  req.on('close', done);
  req.on('error', done);
}
