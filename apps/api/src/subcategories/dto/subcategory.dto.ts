import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubcategoryNameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;
}
