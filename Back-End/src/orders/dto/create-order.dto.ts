import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string; // menuItemId

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsInt()
  @Min(0)
  price!: number; // unit price in THB

  @IsOptional()
  options?: Record<string, unknown>;
}

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(\+66\d{8,9}|0\d{9})$/)
  phone!: string; // Accepts 0XXXXXXXXX or +66XXXXXXXXX

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

export enum PaymentMethod {
  PromptPay = 'promptpay',
  Card = 'card',
  COD = 'cod',
}

export enum DeliveryType {
  Delivery = 'delivery',
  Pickup = 'pickup',
}

export class DeliveryDto {
  @IsEnum(DeliveryType)
  type!: DeliveryType;

  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @IsOptional()
  @IsInt()
  fee?: number;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
