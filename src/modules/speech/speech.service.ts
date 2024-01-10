import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatGptService } from '../chat-gpt/chat-gpt.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { textToSpeechDto } from './dto';

type Languages = 'EN' | 'RU';

@Injectable()
export class SpeechService {
  constructor(
    private chatGptService: ChatGptService,
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async startRecognition(
    audio: Express.Multer.File,
    userId: number,
    chatId: number,
  ) {
    const user = await this.usersService.findById(userId);
    const chat = await this.findChatByIdAndUserId(chatId, user.id);

    const lang: Languages = chat.language as Languages;

    try {
      const transcript = await this.chatGptService.transcribeAudio(
        audio.buffer,
        lang,
      );

      return transcript;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async textToSpeech(dto: textToSpeechDto, userId: number, chatId: number) {
    const { text } = dto;

    const user = await this.usersService.findById(userId);
    await this.findChatByIdAndUserId(chatId, user.id);

    const audioSource = await this.chatGptService.synthesizeSpeech(
      user.id,
      text,
    );

    try {
      return audioSource;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  private async findChatByIdAndUserId(chatId: number, userId: number) {
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, userId },
      include: { messages: true },
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }
}
