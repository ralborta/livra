import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.module';

class CreateTenantDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  slug!: string;

  @IsOptional()
  @IsString()
  branchName?: string;
}

class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

@Controller('tenants')
class TenancyController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug.toLowerCase(),
        branches: {
          create: {
            name: dto.branchName || 'Sucursal principal',
          },
        },
      },
      include: { branches: true },
    });
  }

  @Get()
  list() {
    return this.prisma.tenant.findMany({
      include: { branches: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id },
      include: { branches: true, users: true },
    });
  }

  @Post(':id/users')
  addUser(@Param('id') tenantId: string, @Body() dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role || 'STAFF',
      },
    });
  }
}

@Module({
  controllers: [TenancyController],
})
export class TenancyModule {}
