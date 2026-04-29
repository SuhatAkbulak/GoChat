import { IsIn, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(['admin', 'super_admin', 'support', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT'])
  role!: string;
}
