import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { OrdersEvents } from './orders/orders.events';
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
    ConfigModule.forRoot({ isGlobal: true }),
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
  providers: [OrdersService, OrdersEvents],
})
export class AppModule {}
