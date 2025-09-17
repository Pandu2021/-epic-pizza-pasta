import { IsIn, IsString } from 'class-validator';

export class AdminOrderStatusDto {
  @IsString()
  @IsIn(['received','preparing','ready','delivering','completed','cancelled'])
  status!: string;
}
