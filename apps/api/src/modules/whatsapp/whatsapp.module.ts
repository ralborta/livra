import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../common/prisma.module';

class WhatsappWebhookDto {
  @IsString()
  eventId!: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}

@Controller('webhooks/whatsapp')
class WhatsappController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expected = process.env.WEBHOOK_SECRET_WHATSAPP || '';
    if (mode === 'subscribe' && token === expected) {
      return challenge || 'ok';
    }
    throw new UnauthorizedException('Verify token inválido');
  }

  @Post()
  async inbound(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() dto: WhatsappWebhookDto,
  ) {
    // Persistimos y ACK rápido; procesamiento async vía outbox/workers
    const receipt = await this.prisma.webhookReceipt.upsert({
      where: {
        provider_eventId: { provider: 'whatsapp', eventId: dto.eventId },
      },
      create: {
        provider: 'whatsapp',
        eventId: dto.eventId,
        payload: {
          from: dto.from ?? null,
          text: dto.text ?? null,
          signature: signature || null,
          raw: (dto.raw || dto) as object,
        },
      },
      update: {},
    });

    return { ok: true, duplicate: receipt.processed, received: true };
  }
}

@Module({
  controllers: [WhatsappController],
})
export class WhatsappModule {}
