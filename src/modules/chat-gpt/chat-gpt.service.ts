import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAIApi from 'openai';
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources';
import { File } from '@web-std/file';
import { SupabaseService } from '../supabase/supabase.service';
import { Stream } from 'openai/streaming';

type Message = {
  id: number;
  userId: number;
  chatId: number;
  text: string;
  ai?: boolean;
  audioSource?: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ChatGptService {
  public openai: OpenAIApi;

  constructor(private supabaseService: SupabaseService) {
    this.openai = new OpenAIApi({
      apiKey: process.env.OPEN_AI_SECRET_KEY,
    });
  }

  async chatGptRequest(prompt: string, messages: Message[]): Promise<string> {
    try {
      const history = messages.map(
        (message): ChatCompletionMessageParam => ({
          role: message.ai ? 'assistant' : 'user',
          content: message.text,
        }),
      );

      const completion: ChatCompletion =
        await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: prompt,
            },
            ...history,
          ],
          temperature: 0.5,
          max_tokens: 1000,
        });

      const [content] = completion.choices.map(
        (choice) => choice.message.content,
      );

      return content;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Failed request to ChatGPT');
    }
  }

  async chatGptStreamRequest(
    text: string,
    prompt: string,
  ): Promise<Stream<ChatCompletionChunk>> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
        stream: true,
      });

      return completion;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Failed request to ChatGPT');
    }
  }

  async synthesizeSpeech(userId: number, text: string): Promise<string> {
    try {
      const response = await this.openai.audio.speech.create({
        input: text,
        model: 'tts-1-hd',
        voice: 'alloy',
      });

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const path = await this.supabaseService.uploadAudio(userId, audioBuffer);
      const audioUrl = await this.supabaseService.getUrl('/audios', path);

      return audioUrl;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Failed to synthesize speech');
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    language: string,
  ): Promise<string> {
    const blob = new Blob([audioBuffer], {
      type: 'audio/wav',
    });
    const file = new File([blob], 'input.wav', { type: 'audio/wav' });

    try {
      const whisperResponse = await this.openai.audio.transcriptions.create({
        model: 'whisper-1',
        language,
        file,
        response_format: 'json',
      });

      return whisperResponse.text;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Failed to transcribe audio');
    }
  }

  async chatGptVision(text: string, url: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url, detail: 'high' } },
            ],
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      const [content] = completion.choices.map(
        (choice) => choice.message.content,
      );

      return content;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Unable to recognize image');
    }
  }

  async chatGptVisionStream(
    text: string,
    urls: string[],
  ): Promise<Stream<ChatCompletionChunk>> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text },
          ...urls
            .map((url): ChatCompletionContentPart[] => [
              { type: 'image_url', image_url: { url, detail: 'high' } },
            ])
            .flat(),
        ],
      },
    ];

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages,
        temperature: 0.5,
        max_tokens: 1000,
        stream: true,
      });

      return completion;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Unable to recognize image');
    }
  }

  async generateImage(text: string): Promise<string> {
    try {
      const { data } = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: text,
        response_format: 'url',
        style: 'natural',
      });

      return data[0].url;
    } catch (e: any) {
      console.error(e);
      throw new ServiceUnavailableException('Failed to generate image');
    }
  }
}
