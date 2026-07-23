import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.module';

@Controller('notifications')
class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('outbox/pending')
  pending() {
    return this.prisma.outboxEvent.findMany({
      where: { published: false },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }
}

@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
