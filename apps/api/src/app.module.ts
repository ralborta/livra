import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/common/prisma.module';
import { RedisModule } from './modules/common/redis.module';
import { HealthModule } from './modules/health/health.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    TenancyModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    WhatsappModule,
    LogisticsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
