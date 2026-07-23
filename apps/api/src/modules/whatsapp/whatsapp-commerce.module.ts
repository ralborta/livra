import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma.module';

class WhatsappOrderDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

@Controller('whatsapp')
class WhatsappCommerceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('menu')
  menu() {
    return {
      message:
        '¡Hola! Soy *Livra* 🛵\n\nPedí por WhatsApp, pagá online y seguí tu pedido hasta la puerta.\n\nEscribí:\n• *pedir* — ver menú y armar pedido\n• *seguimiento* — estado de tu pedido\n• *ayuda* — hablar con soporte',
    };
  }

  @Get('catalog')
  async catalog(@Query('tenantSlug') tenantSlug = 'livra-demo') {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      return { message: 'No encontré el restaurante demo. Probá de nuevo en unos minutos.' };
    }

    const products = await this.prisma.product.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: { name: 'asc' },
    });

    if (!products.length) {
      return { message: 'El catálogo está vacío por ahora.' };
    }

    const lines = products.map(
      (p, i) =>
        `*${i + 1}.* ${p.name} — $${(p.priceCents / 100).toFixed(2)}${p.description ? `\n_${p.description}_` : ''}`,
    );

    return {
      tenantId: tenant.id,
      products: products.map((p, i) => ({
        n: i + 1,
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
      })),
      message:
        `📋 *Menú ${tenant.name}*\n\n${lines.join('\n\n')}\n\nRespondé así:\n*número | tu dirección*\nEj: *1 | Av. Corrientes 1234*`,
    };
  }

  @Post('order')
  async createOrder(@Body() dto: WhatsappOrderDto) {
    const tenantSlug = dto.tenantSlug || 'livra-demo';
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { branches: { take: 1 } },
    });
    if (!tenant) {
      return { message: 'Restaurante no disponible.' };
    }

    const raw = (dto.body || '').trim();
    const match = raw.match(/^(\d+)\s*[|\-–]\s*(.+)$/);
    if (!match) {
      return {
        message:
          'No pude leer el pedido. Mandame: *número | dirección*\nEj: *1 | Av. Demo 123*',
      };
    }

    const index = Number(match[1]) - 1;
    const address = match[2].trim();
    const products = await this.prisma.product.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: { name: 'asc' },
    });
    const product = products[index];
    if (!product) {
      return { message: 'Ese número no está en el menú. Escribí *pedir* para verlo de nuevo.' };
    }

    const deliveryCents = 1500;
    const correlationId = uuidv4();
    const publicWeb = process.env.PUBLIC_WEB_URL || 'https://livra-web.wd75db.easypanel.host';

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId: tenant.id,
          branchId: tenant.branches[0]?.id,
          correlationId,
          customerPhone: dto.phone,
          customerName: dto.name || 'Cliente WhatsApp',
          address,
          deliveryCents,
          subtotalCents: product.priceCents,
          totalCents: product.priceCents + deliveryCents,
          status: OrderStatus.DRAFT,
          items: {
            create: [
              {
                productId: product.id,
                name: product.name,
                quantity: 1,
                unitCents: product.priceCents,
                totalCents: product.priceCents,
              },
            ],
          },
          events: {
            create: {
              type: 'order.created',
              toStatus: OrderStatus.DRAFT,
              actor: 'whatsapp',
              payload: { channel: 'bbc' },
            },
          },
        },
      });

      const payment = await tx.payment.create({
        data: {
          orderId: created.id,
          amountCents: created.totalCents,
          currency: created.currency,
          idempotencyKey: `wa_${created.id}`,
        },
      });

      await tx.order.update({
        where: { id: created.id },
        data: {
          status: OrderStatus.AWAITING_PAYMENT,
          version: { increment: 1 },
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          type: 'payment.checkout_created',
          fromStatus: OrderStatus.DRAFT,
          toStatus: OrderStatus.AWAITING_PAYMENT,
          actor: 'whatsapp',
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventType: 'order.created',
          aggregateId: created.id,
          tenantId: tenant.id,
          correlationId,
          payload: { orderId: created.id, channel: 'whatsapp' },
        },
      });

      return { created, payment };
    });

    const checkoutUrl = `${publicWeb}/checkout/${order.created.id}`;
    return {
      orderId: order.created.id,
      paymentId: order.payment.id,
      checkoutUrl,
      message:
        `✅ Pedido armado\n\n*${product.name}* + envío\nTotal: *$${(order.created.totalCents / 100).toFixed(2)}*\nDirección: ${address}\n\nID: \`${order.created.id}\`\n\nPagá acá:\n${checkoutUrl}\n\nCuando pagues, el restaurante lo ve al toque. Para seguimiento: *seguimiento*`,
    };
  }

  @Get('order/:id')
  async orderStatus(@Param('id') id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        delivery: true,
        payment: true,
        items: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const items = order.items.map((i) => `• ${i.quantity}x ${i.name}`).join('\n');
    const tracking =
      order.delivery?.trackingToken &&
      `${process.env.PUBLIC_WEB_URL || 'https://livra-web.wd75db.easypanel.host'}/tracking/${order.delivery.trackingToken}`;

    return {
      message:
        `📦 *Pedido*\n\`${order.id}\`\n\nEstado: *${order.status}*\nPago: *${order.payment?.status || '—'}*\nTotal: $${(order.totalCents / 100).toFixed(2)}\n\n${items}${
          order.address ? `\n\nEntrega: ${order.address}` : ''
        }${tracking ? `\n\nTracking: ${tracking}` : ''}`,
    };
  }

  @Post('inbound')
  async inbound(
    @Body()
    body: {
      eventId?: string;
      from?: string;
      text?: string;
      name?: string;
    },
  ) {
    const eventId = body.eventId || `bbc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await this.prisma.webhookReceipt.upsert({
      where: {
        provider_eventId: { provider: 'whatsapp', eventId },
      },
      create: {
        provider: 'whatsapp',
        eventId,
        payload: body as object,
      },
      update: {},
    });
    return { ok: true, message: 'ok' };
  }
}

@Module({
  controllers: [WhatsappCommerceController],
})
export class WhatsappCommerceModule {}
