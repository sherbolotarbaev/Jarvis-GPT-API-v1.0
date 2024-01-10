import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageDto } from './dto';
import { ChatGptService } from '../chat-gpt/chat-gpt.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import { Stream } from 'openai/streaming';
import { ChatCompletionChunk } from 'openai/resources';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MessagesService {
  constructor(
    private chatGptService: ChatGptService,
    private usersService: UsersService,
    private prisma: PrismaService,
    private supabaseService: SupabaseService,
  ) {}

  async createMessage(dto: CreateMessageDto, chatId: number, userId: number) {
    const { text } = dto;

    const user = await this.usersService.findById(userId);
    const chat = await this.findChatByIdAndUserId(chatId, user.id);

    const lang: Languages = chat.language as Languages;

    const allMessages = [
      ...chat.messages,
      {
        text,
      },
    ];

    try {
      const aiReply = await this.getAiReply(lang, allMessages);

      const [message, reply] = await this.saveMessages(
        chat,
        user,
        text,
        aiReply,
      );

      return { message, reply };
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async createStreamMessage(
    dto: CreateMessageDto,
    files: Express.Multer.File[],
    chatId: number,
    userId: number,
    response: Response,
  ) {
    const { text } = dto;

    response.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const user = await this.usersService.findById(userId);
    const chat = await this.findChatByIdAndUserId(chatId, user.id);

    try {
      let stream: Stream<ChatCompletionChunk>;
      if (!files && files.length === 0) {
        stream = await this.chatGptService.chatGptStreamRequest(
          text,
          `Imagine you're an AI functioning as my personal Jarvis, your name is Jarvis!, and you can call me Sher!, assisting me in various tasks. Answer very shortly and clear, my today's topic is ${chat.title}`,
        );
      } else {
        const urls = await this.processFiles(user.id, files);
        stream = await this.chatGptService.chatGptVisionStream(text, urls);
      }

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? '';
        response.write(content);
      }

      response.end();
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async getMessages(chatId: number, userId: number) {
    const user = await this.usersService.findById(userId);
    const chat = await this.findChatByIdAndUserId(chatId, user.id);

    try {
      return chat.messages;
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

  private async getAiReply(lang: Languages, messages: any[]) {
    const template =
      lang === 'EN'
        ? "Imagine you're an AI functioning as my personal Jarvis, your name is Jarvis!, and you can call me Sher!, assisting me in various tasks. Answer very shortly and clear, your reply limit is 1000 characters"
        : 'Представьте, что вы - ИИ, работающий в качестве моего личного Джарвиса, вас зовут Джарвис!, а меня вы можете называть Шер!, и помогающий мне в решении различных задач. Отвечайте очень коротко и ясно, ограничение на ответ - 1000 символов';

    return this.chatGptService.chatGptRequest(template, messages);
  }

  private async processFiles(userId: number, files: Express.Multer.File[]) {
    const urls: string[] = [];

    if (files.length > 5) {
      throw new ForbiddenException(
        'Unable to process request. The maximum allowed number of files (5) has been exceeded',
      );
    }

    for (const file of files) {
      const path = await this.supabaseService.uploadPhoto(userId, file);
      const url = await this.supabaseService.getUrl('/photos', path);

      urls.push(url);
    }

    return urls;
  }

  private async saveMessages(
    chat: any,
    user: any,
    text: string,
    aiReply: string,
  ) {
    return this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          chatId: chat.id,
          userId: user.id,
          text,
        },
      }),
      this.prisma.message.create({
        data: {
          chatId: chat.id,
          userId: user.id,
          text: aiReply.trim(),
          ai: true,
          audioSource: await this.chatGptService.synthesizeSpeech(
            user.id,
            aiReply,
          ),
        },
      }),
    ]);
  }
}
