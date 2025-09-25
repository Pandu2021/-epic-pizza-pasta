import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['received','preparing','out-for-delivery','completed','delivered','cancelled'])
  status!: string;

  @IsOptional()
  @IsString()
  driverName?: string;
}
