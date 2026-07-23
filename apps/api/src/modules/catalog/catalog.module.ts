import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../common/prisma.module';

class CreateProductDto {
  @IsString()
  tenantId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class UpdateAvailabilityDto {
  @IsBoolean()
  available!: boolean;
}

@Controller('catalog')
class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('products')
  list(@Query('tenantId') tenantId: string, @Query('branchId') branchId?: string) {
    return this.prisma.product.findMany({
      where: {
        tenantId,
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post('products')
  create(@Body() dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        currency: dto.currency || 'ARS',
      },
    });
  }

  @Patch('products/:id/availability')
  setAvailability(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.prisma.product.update({
      where: { id },
      data: { available: dto.available },
    });
  }
}

@Module({
  controllers: [CatalogController],
})
export class CatalogModule {}
