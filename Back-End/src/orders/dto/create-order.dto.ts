import { Transform, Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string; // menuItemId

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(/^(\+66\d{8,9}|0\d{9})$/)
  phone!: string; // Accepts 0XXXXXXXXX or +66XXXXXXXX/XXXXXXXXX (cleaned of spaces/dashes); stored normalized to +66 at service layer

  // Address required only for delivery; optional for pickup. Service layer will enforce.
  @IsOptional()
  @IsString()
  address?: string;

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

  @IsOptional()
  @IsString()
  verificationToken?: string;
}
