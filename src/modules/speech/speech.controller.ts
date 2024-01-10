import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { SpeechService } from './speech.service';
import { GetCurrentUserId } from '../auth/common/decorators';
import { FileInterceptor } from '@nestjs/platform-express';
import { textToSpeechDto } from './dto';

@Controller('speech')
export class SpeechController {
  constructor(private speechService: SpeechService) {}

  @Post(':id/to-text')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  async startRecognition(
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({
            fileType: 'audio/*',
          }),
        ],
      }),
    )
    audio: Express.Multer.File,
  ) {
    return await this.speechService.startRecognition(audio, userId, id);
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  async textToSpeech(
    @Body() dto: textToSpeechDto,
    @GetCurrentUserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.speechService.textToSpeech(dto, userId, id);
  }
}
