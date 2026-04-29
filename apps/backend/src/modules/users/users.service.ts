import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../generated/prisma/index';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private formatUserRow(user: {
    id: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return {
      data: users.map((user) => this.formatUserRow(user)),
    };
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const role = dto.role ?? UserRole.SUPPORT;

    const created = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return this.formatUserRow(created);
  }

  async deleteUser(userId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    if (
      existing.role === UserRole.ADMIN ||
      existing.role === UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        'Admin ve süper admin hesapları güvenlik nedeniyle silinemez',
      );
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  }

  async updateUserRole(userId: string, role: string) {
    const normalizedRole = role.toUpperCase();
    if (!Object.values(UserRole).includes(normalizedRole as UserRole)) {
      throw new BadRequestException('Invalid role');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: normalizedRole as UserRole },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return {
      ...updated,
      role: updated.role.toLowerCase(),
      createdAt: updated.createdAt.toISOString(),
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
    };
  }
}
