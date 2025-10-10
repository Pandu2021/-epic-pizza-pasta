import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AdminMenuCreateDto {
  @IsString()
  @IsNotEmpty()
  category!: string;

  // allow string or object; controller will normalize
  @IsNotEmpty()
  name!: Record<string, string> | string;

  @IsOptional()
  description?: Record<string, string> | string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsInt()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceL?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceXL?: number;

  @IsOptional()
  options?: unknown;
}

export class AdminMenuUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  name?: Record<string, string> | string;

  @IsOptional()
  description?: Record<string, string> | string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceL?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceXL?: number;

  @IsOptional()
  options?: unknown;
}
