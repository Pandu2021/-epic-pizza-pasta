import { Body, Controller, Post } from '@nestjs/common';
import { prisma } from '../prisma';

@Controller('api/contact')
export class ContactController {
  @Post()
  async submit(@Body() body: { name?: string; email?: string; message: string }) {
    await prisma.webhookEvent.create({ data: { type: 'contact', payload: body } });
    return { ok: true };
  }
}
