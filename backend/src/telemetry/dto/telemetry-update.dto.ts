import { IsBoolean, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class TelemetryUpdateDto {
  @IsString()
  @IsNotEmpty()
  scooterId: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  @Min(0)
  speed: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  battery: number;

  @IsBoolean()
  locked: boolean;
}
