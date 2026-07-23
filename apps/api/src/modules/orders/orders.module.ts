import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '@prisma/client';
import { ORDER_TRANSITIONS } from '@livra/shared';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma.module';

class OrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitCents!: number;
}

class CreateOrderDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  deliveryCents?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

class TransitionDto {
  @IsString()
  toStatus!: OrderStatus;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Injectable()
class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('El pedido requiere al menos un item');
    }

    const subtotal = dto.items.reduce(
      (acc, item) => acc + item.unitCents * item.quantity,
      0,
    );
    const deliveryCents = dto.deliveryCents ?? 0;
    const correlationId = uuidv4();

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          correlationId,
          customerPhone: dto.customerPhone,
          customerName: dto.customerName,
          address: dto.address,
          notes: dto.notes,
          subtotalCents: subtotal,
          deliveryCents,
          totalCents: subtotal + deliveryCents,
          status: OrderStatus.DRAFT,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitCents: item.unitCents,
              totalCents: item.unitCents * item.quantity,
            })),
          },
          events: {
            create: {
              type: 'order.created',
              toStatus: OrderStatus.DRAFT,
              actor: 'system',
              payload: { source: 'api' },
            },
          },
        },
        include: { items: true, events: true },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'order.created',
          aggregateId: order.id,
          tenantId: order.tenantId,
          correlationId,
          payload: {
            orderId: order.id,
            totalCents: order.totalCents,
            status: order.status,
          },
        },
      });

      return order;
    });
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        events: { orderBy: { createdAt: 'asc' } },
        payment: true,
        delivery: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async timeline(id: string) {
    const order = await this.get(id);
    return {
      orderId: order.id,
      correlationId: order.correlationId,
      status: order.status,
      version: order.version,
      timeline: order.events,
      payment: order.payment,
      delivery: order.delivery,
    };
  }

  async transition(id: string, dto: TransitionDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundException('Pedido no encontrado');

      const allowed = ORDER_TRANSITIONS[order.status] || [];
      if (!allowed.includes(dto.toStatus)) {
        throw new BadRequestException(
          `Transición inválida: ${order.status} → ${dto.toStatus}`,
        );
      }

      const updated = await tx.order.updateMany({
        where: { id, version: order.version },
        data: {
          status: dto.toStatus,
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException('Conflicto de concurrencia en el pedido');
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: `order.transition.${dto.toStatus.toLowerCase()}`,
          fromStatus: order.status,
          toStatus: dto.toStatus,
          actor: dto.actor || 'system',
          payload: dto.reason ? { reason: dto.reason } : undefined,
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType:
            dto.toStatus === OrderStatus.ACCEPTED
              ? 'order.accepted'
              : dto.toStatus === OrderStatus.READY
                ? 'order.ready'
                : 'order.created',
          aggregateId: id,
          tenantId: order.tenantId,
          correlationId: order.correlationId,
          payload: {
            orderId: id,
            from: order.status,
            to: dto.toStatus,
          },
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, events: true, payment: true, delivery: true },
      });
    });
  }
}

@Controller('orders')
class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Post(':id/transitions')
  transition(@Param('id') id: string, @Body() dto: TransitionDto) {
    return this.orders.transition(id, dto);
  }
}

@Controller('ops/orders')
class OpsOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id/timeline')
  timeline(@Param('id') id: string) {
    return this.orders.timeline(id);
  }
}

@Module({
  providers: [OrdersService],
  controllers: [OrdersController, OpsOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
