import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { prisma } from '../prisma';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';

type MenuCreateDto = {
  category: string;
  name: Record<string, string> | string;
  description?: Record<string, string> | string;
  images?: string[];
  basePrice: number;
  priceL?: number;
  priceXL?: number;
  options?: unknown;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('api/admin/menu')
export class AdminMenuController {
  @Get()
  list() {
    return prisma.menuItem.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  @Post()
  async create(@Body() body: MenuCreateDto) {
    const toJson = (v: unknown) => (typeof v === 'string' ? { en: v } : v ?? null);
    const created = await prisma.menuItem.create({
      data: {
        category: body.category,
        name: toJson(body.name) as any,
        description: body.description ? (toJson(body.description) as any) : undefined,
        images: body.images ?? [],
        basePrice: body.basePrice,
        priceL: body.priceL,
        priceXL: body.priceXL,
        options: body.options as any,
      },
    });
    return created;
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return prisma.menuItem.findUnique({ where: { id } });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<MenuCreateDto>) {
    const toJson = (v: unknown) => (typeof v === 'string' ? { en: v } : v ?? null);
    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        category: body.category,
        name: body.name !== undefined ? (toJson(body.name) as any) : undefined,
        description: body.description !== undefined ? (toJson(body.description) as any) : undefined,
        images: body.images,
        basePrice: body.basePrice,
        priceL: body.priceL,
        priceXL: body.priceXL,
        options: body.options as any,
      },
    });
    return updated;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return prisma.menuItem.delete({ where: { id } });
  }
}
