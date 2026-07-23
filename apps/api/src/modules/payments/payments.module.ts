import {
  Body,
  Controller,
  Headers,
  Module,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma.module';
import { OrdersModule } from '../orders/orders.module';

class CheckoutDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

class PaymentWebhookDto {
  @IsString()
  eventId!: string;

  @IsString()
  orderId!: string;

  @IsString()
  status!: 'approved' | 'rejected' | 'refunded';

  @IsOptional()
  @IsString()
  providerPaymentId?: string;
}

@Controller()
class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('orders/:id/checkout')
  async checkout(@Param('id') orderId: string, @Body() dto: CheckoutDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          amountCents: order.totalCents,
          currency: order.currency,
          idempotencyKey,
          status: PaymentStatus.PENDING,
        },
        update: {},
      });

      if (order.status === OrderStatus.DRAFT) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.AWAITING_PAYMENT,
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId,
            type: 'payment.checkout_created',
            fromStatus: OrderStatus.DRAFT,
            toStatus: OrderStatus.AWAITING_PAYMENT,
            actor: 'payments',
          },
        });
      }

      const publicWeb = process.env.PUBLIC_WEB_URL || 'http://localhost:3000';
      return {
        ...payment,
        checkoutUrl: `${publicWeb}/checkout/${orderId}?payment=${payment.id}`,
      };
    });
  }

  @Post('webhooks/payments')
  async webhook(
    @Headers('x-livra-signature') signature: string | undefined,
    @Body() dto: PaymentWebhookDto,
  ) {
    const expected = process.env.WEBHOOK_SECRET_PAYMENTS || '';
    if (expected && signature !== expected) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }

    const receipt = await this.prisma.webhookReceipt.upsert({
      where: {
        provider_eventId: { provider: 'mercadopago', eventId: dto.eventId },
      },
      create: {
        provider: 'mercadopago',
        eventId: dto.eventId,
        payload: dto as object,
      },
      update: {},
    });

    if (receipt.processed) {
      return { ok: true, duplicate: true };
    }

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { orderId: dto.orderId },
        include: { order: true },
      });
      if (!payment) throw new NotFoundException('Pago no encontrado');

      const status =
        dto.status === 'approved'
          ? PaymentStatus.APPROVED
          : dto.status === 'refunded'
            ? PaymentStatus.REFUNDED
            : PaymentStatus.REJECTED;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          providerPaymentId: dto.providerPaymentId,
          raw: dto as object,
        },
      });

      if (status === PaymentStatus.APPROVED) {
        await tx.order.update({
          where: { id: dto.orderId },
          data: {
            status: OrderStatus.PAID,
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: dto.orderId,
            type: 'payment.approved',
            fromStatus: payment.order.status,
            toStatus: OrderStatus.PAID,
            actor: 'mercadopago',
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: 'payment.approved',
            aggregateId: dto.orderId,
            tenantId: payment.order.tenantId,
            correlationId: payment.order.correlationId,
            payload: { orderId: dto.orderId, paymentId: payment.id },
          },
        });
      }

      await tx.webhookReceipt.update({
        where: { id: receipt.id },
        data: { processed: true },
      });
    });

    return { ok: true };
  }
}

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
