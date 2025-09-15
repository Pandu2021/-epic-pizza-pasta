import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';

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
  @MinLength(6)
  phone!: string; // relaxed validation for local dev (accepts 08xxxxxxxx or +66 formats)

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
