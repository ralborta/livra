import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DeliveryStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.module';

class AssignDto {
  @IsString()
  courierName!: string;

  @IsOptional()
  @IsString()
  courierPhone?: string;
}

class LocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  accuracyM?: number;
}

class CompleteDto {
  @IsString()
  @MinLength(4)
  code!: string;
}

@Controller()
class LogisticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('orders/:orderId/delivery')
  async createDelivery(@Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const code = String(Math.floor(1000 + Math.random() * 9000));

    return this.prisma.delivery.upsert({
      where: { orderId },
      create: {
        orderId,
        proofCode: code,
        status: DeliveryStatus.PENDING,
      },
      update: {},
    });
  }

  @Post('deliveries/:id/offers')
  async offer(@Param('id') id: string) {
    return this.prisma.delivery.update({
      where: { id },
      data: { status: DeliveryStatus.OFFERED },
    });
  }

  @Post('deliveries/:id/assign')
  async assign(@Param('id') id: string, @Body() dto: AssignDto) {
    const delivery = await this.prisma.delivery.update({
      where: { id },
      data: {
        status: DeliveryStatus.ASSIGNED,
        courierName: dto.courierName,
        courierPhone: dto.courierPhone,
        assignedAt: new Date(),
      },
      include: { order: true },
    });

    await this.prisma.outboxEvent.create({
      data: {
        eventType: 'delivery.assigned',
        aggregateId: delivery.id,
        tenantId: delivery.order.tenantId,
        correlationId: delivery.order.correlationId,
        payload: {
          deliveryId: delivery.id,
          orderId: delivery.orderId,
          courierName: dto.courierName,
        },
      },
    });

    return delivery;
  }

  @Post('deliveries/:id/locations')
  async ping(@Param('id') id: string, @Body() dto: LocationDto) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery no encontrado');

    const ping = await this.prisma.locationPing.create({
      data: {
        deliveryId: id,
        lat: dto.lat,
        lng: dto.lng,
        accuracyM: dto.accuracyM,
      },
    });

    if (
      delivery.status === DeliveryStatus.ASSIGNED ||
      delivery.status === DeliveryStatus.PICKED_UP
    ) {
      await this.prisma.delivery.update({
        where: { id },
        data: { status: DeliveryStatus.IN_TRANSIT },
      });
    }

    return ping;
  }

  @Get('tracking/:token')
  async tracking(@Param('token') token: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { trackingToken: token },
      include: {
        order: { select: { id: true, status: true, customerName: true } },
        pings: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!delivery) throw new NotFoundException('Tracking no encontrado');

    return {
      status: delivery.status,
      orderStatus: delivery.order.status,
      courierName: delivery.courierName,
      lastLocation: delivery.pings[0] || null,
      orderId: delivery.order.id,
    };
  }

  @Post('deliveries/:id/complete')
  async complete(@Param('id') id: string, @Body() dto: CompleteDto) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!delivery) throw new NotFoundException('Delivery no encontrado');
    if (delivery.proofCode !== dto.code) {
      throw new BadRequestException('Código de entrega inválido');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({
        where: { id },
        data: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: delivery.orderId },
        data: {
          status: OrderStatus.DELIVERED,
          version: { increment: 1 },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: delivery.orderId,
          type: 'delivery.completed',
          fromStatus: delivery.order.status,
          toStatus: OrderStatus.DELIVERED,
          actor: 'courier',
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'delivery.completed',
          aggregateId: id,
          tenantId: delivery.order.tenantId,
          correlationId: delivery.order.correlationId,
          payload: { deliveryId: id, orderId: delivery.orderId },
        },
      });

      return updated;
    });
  }
}

@Module({
  controllers: [LogisticsController],
})
export class LogisticsModule {}
