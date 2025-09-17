import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { prisma } from '../prisma';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import * as argon2 from 'argon2';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/users')
export class AdminUsersController {
  @Get()
  list() {
    return prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, name: true, phone: true, createdAt: true } });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, name: true, phone: true, createdAt: true } });
  }

  @Post()
  async create(@Body() body: AdminCreateUserDto) {
    const passwordHash = await argon2.hash(body.password);
    const created = await prisma.user.create({ data: { email: body.email, passwordHash, role: body.role ?? 'customer', name: body.name, phone: body.phone } });
    return { id: created.id, email: created.email, role: created.role, name: created.name, phone: created.phone };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    const data: any = { role: body.role, name: body.name, phone: body.phone };
    if (body.password) data.passwordHash = await argon2.hash(body.password);
    const updated = await prisma.user.update({ where: { id }, data });
    return { id: updated.id, email: updated.email, role: updated.role, name: updated.name, phone: updated.phone };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return prisma.user.delete({ where: { id } });
  }
}
