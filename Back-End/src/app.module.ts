import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
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
import { GuestOrdersService } from './orders/guest-orders.service';
import { GuestOrdersCleanupMiddleware } from './orders/guest-orders.cleanup.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, any>) => {
        const postgresUrlSchema = z
          .string()
          .min(1, 'DATABASE_URL is required')
          .transform((value) => value.trim())
          .refine(
            (value) => /^postgres(ql)?:\/\//i.test(value),
            'DATABASE_URL must start with postgres:// or postgresql:// (example: postgresql://user:pass@localhost:5432/db?schema=public)',
          )
          .refine(
            (value) => value.split('://')[1]?.length,
            'DATABASE_URL must include connection details after the scheme (example: postgresql://user:pass@localhost:5432/db?schema=public)',
          );

        const schema = z
          .object({
            NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
            PORT: z.string().optional(),
            DATABASE_URL: postgresUrlSchema,
            JWT_PRIVATE_KEY: z.string().min(10),
            JWT_PUBLIC_KEY: z.string().min(10),
            JWT_ACCESS_TTL: z.string().optional(),
            JWT_REFRESH_TTL: z.string().optional(),
            CORS_ORIGINS: z.string().optional(),
            COOKIE_SECRET: z.string().min(10),
          })
          .passthrough();

        const parsed = schema.safeParse(config);

        if (!parsed.success) {
          const issueMessages = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`);

          // eslint-disable-next-line no-console
          console.error('Invalid environment configuration:', issueMessages);
          throw new Error('Invalid environment configuration');
        }

        return parsed.data;
      },
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
  providers: [OrdersService, OrdersEvents, OrdersPrintService, GuestOrdersService, GuestOrdersCleanupMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GuestOrdersCleanupMiddleware).forRoutes(
      { path: 'api/orders/guest', method: RequestMethod.ALL },
      { path: 'api/orders/guest/:token', method: RequestMethod.ALL },
    );
  }
}
