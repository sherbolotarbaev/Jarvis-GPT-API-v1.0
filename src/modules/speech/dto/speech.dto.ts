import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class textToSpeechDto {
  @IsNotEmpty({ message: 'Text cannot be empty' })
  @IsString({ message: 'Invalid text format' })
  @MinLength(2, { message: 'Text must be at least 10 characters long' })
  @MaxLength(4000, { message: 'Text cannot be longer than 8192 characters' })
  text: string;
}
