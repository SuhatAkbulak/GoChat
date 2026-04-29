import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../generated/prisma/index';

/** SUPER_ADMIN yalnızca script/kayıt ile; panelden SUPPORT ve ADMIN oluşturulur */
export class CreateUserDto {
  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ enum: [UserRole.SUPPORT, UserRole.ADMIN] })
  @IsOptional()
  @IsIn([UserRole.SUPPORT, UserRole.ADMIN])
  role?: UserRole;
}
