import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ChatGptService } from '../chat-gpt/chat-gpt.service';
import { PrismaService } from '../prisma/prisma.service';
import { StartRecognitionDto } from './dto/speech-to-text.dto';
import { Readable } from 'stream';
import FormData from 'form-data';
import { transcribe } from '../../utils/whisper';
import { synthesizeSpeech } from '../../utils/synthesize';
// import { getUrl, uploadAudio } from '../../utils/supabase';

type Languages = 'EN' | 'RU';

@Injectable()
export class SpeechToTextService {
  private readonly polly: AWS.Polly;

  constructor(
    private chatGptService: ChatGptService,
    private prisma: PrismaService,
  ) {
    AWS.config.update({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS,
        secretAccessKey: process.env.AWS_SECRET,
      },
    });

    this.polly = new AWS.Polly();
  }

  // async synthesizeSpeech(userId: number, text: string, language: Languages) {
  //   const params: AWS.Polly.Types.SynthesizeSpeechInput = {
  //     OutputFormat: 'mp3',
  //     Text: text,
  //     TextType: 'text',
  //     VoiceId: language === 'EN' ? 'Matthew' : 'Maxim',
  //   };

  //   const result = await this.polly.synthesizeSpeech(params).promise();
  //   const audioBuffer = result.AudioStream as Buffer;
  //   const path = await uploadAudio(userId, audioBuffer);
  //   const audioUrl = getUrl('/audios', path);

  //   return audioUrl;
  // }

  async startRecognition(dto: StartRecognitionDto, userId: number, id: number) {
    const { audio: base64Audio } = dto;
    const audioData = Buffer.from(base64Audio, 'base64');
    const allMessages = [];

    const bufferToStream = (buffer: Buffer) => {
      return Readable.from(buffer);
    };

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const chat = await this.prisma.chat.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!chat) {
      throw new UnauthorizedException('Chat not found');
    }

    let lang: Languages = 'EN';
    if (chat.language === 'RU') {
      lang = 'RU';
    }

    const messages = await this.prisma.message.findMany({
      where: {
        userId: user.id,
        chatId: chat.id,
      },
    });

    if (messages.length > 0) {
      allMessages.push(...messages);
    }

    const formData = new FormData();
    const audioStream = bufferToStream(audioData);
    const model = 'whisper-1';
    const language = lang === 'EN' ? 'en' : 'ru';
    const format = 'json';

    formData.append('model', model);
    formData.append('language', language);
    formData.append('response_format', format);
    formData.append('file', audioStream, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    });

    try {
      const transcript = await transcribe(formData);
      allMessages.push({
        text: transcript,
      });
      const aiReply = await this.chatGptService.chatGptRequest(
        lang === 'EN'
          ? `Imagine you're an AI functioning as my personal Jarvis, you're name is Jarvis!, and you can call me Sher!, assisting me in various tasks. Answer very shortly and clear`
          : `Представьте, что вы - ИИ, работающий в качестве моего личного Джарвиса, вас зовут Джарвис!, а меня вы можете называть Шер!, и помогающий мне в решении различных задач. Отвечайте очень коротко и ясно`,
        allMessages,
      );
      const audioUrl = await synthesizeSpeech(user.id, aiReply);
      const message = await this.prisma.message.create({
        data: {
          chatId: chat.id,
          userId: user.id,
          text: transcript,
          audioSource: audioUrl as string,
        },
      });
      const reply = await this.prisma.message.create({
        data: {
          chatId: chat.id,
          userId: user.id,
          text: aiReply,
          ai: true,
        },
      });

      const result = {
        message,
        reply,
      };

      return result;
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async getMessages(id: number, userId: number) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const chat = await this.prisma.chat.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!chat) {
      throw new UnauthorizedException('Chat not found');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        userId: user.id,
        chatId: chat.id,
      },
    });

    try {
      return messages;
    } catch (e) {
      throw new Error(e.message);
    }
  }
}
