import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function start() {
  const app = await NestFactory.create(AppModule);

  // Set CORS options
  const corsOptions: CorsOptions = {
    origin: process.env.FRONTEND_BASE_URL,
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-HTTP-Method-Override',
      'Set-Cookie',
      'Cookie',
    ],
    exposedHeaders: ['set-cookie'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };

  // Set Body Parser
  app.use(
    bodyParser.urlencoded({
      extended: true,
    }),
  );

  // Set the global validation pipes for our server
  app.useGlobalPipes(new ValidationPipe());

  // Set the Cookie Parser
  app.use(cookieParser());

  // Enable CORS for server
  app.enableCors(corsOptions);

  // Start the Nest.js application and log the server's address
  await app.listen(process.env.PORT);
  Logger.log(`Server is running on: http://localhost:${process.env.PORT} ⚡️`);
}

start();
