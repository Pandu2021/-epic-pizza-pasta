import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { z } from 'zod';
import { HealthController } from './health/health.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { OrdersEvents } from './orders/orders.events';
import { OrdersPrintService } from './orders/orders.print';
import { PaymentsController } from './payments/payments.controller';
import { MenuController } from './menu/menu.controller';
import { AdminMenuController } from './admin/menu.controller';
import { AdminOrdersController } from './admin/orders.controller';
import { AdminUsersController } from './admin/users.controller';
import { ContactController } from './contact/contact.controller';
import { EstimateController } from './estimate/estimate.controller';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, any>) => {
        const schema = z.object({
          NODE_ENV: z.enum(['development','test','production']).default('development'),
          PORT: z.string().optional(),
          DATABASE_URL: z.string().url(),
          JWT_PRIVATE_KEY: z.string().min(10),
          JWT_PUBLIC_KEY: z.string().min(10),
          JWT_ACCESS_TTL: z.string().optional(),
          JWT_REFRESH_TTL: z.string().optional(),
          CORS_ORIGINS: z.string().optional(),
          COOKIE_SECRET: z.string().min(10),
        }).passthrough();
        const parsed = schema.safeParse(config);
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
          throw new Error('Invalid environment configuration');
        }
        return parsed.data;
      }
    }),
  ],
  controllers: [
    HealthController,
    OrdersController,
    PaymentsController,
    MenuController,
    AdminMenuController,
    AdminOrdersController,
    AdminUsersController,
    ContactController,
    EstimateController,
    AuthController,
  ],
  providers: [OrdersService, OrdersEvents, OrdersPrintService],
})
export class AppModule {}
