import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { ChatGptService } from '../chat-gpt/chat-gpt.service';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  providers: [SpeechService, ChatGptService, UsersService, SupabaseService],
  controllers: [SpeechController],
})
export class SpeechModule {}
