import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '.prisma/client';
import { createUserDto } from './dto';
import { hash } from '../../utils/bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUsers(
    userId: number,
    query: string,
  ): Promise<{ count: number; users: User[] }> {
    const user = await this.findById(userId);

    if (user.role === 'USER') {
      throw new ForbiddenException(
        'You do not have the necessary permission to access users information',
      );
    }

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            role: 'USER',
            AND: query
              ? [
                  {
                    OR: [
                      { firstName: { contains: query, mode: 'insensitive' } },
                      { lastName: { contains: query, mode: 'insensitive' } },
                      { email: { contains: query, mode: 'insensitive' } },
                      { phone: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                ]
              : [],
          },
          {
            role: 'ADMIN',
            AND: query
              ? [
                  {
                    OR: [
                      { firstName: { contains: query, mode: 'insensitive' } },
                      { lastName: { contains: query, mode: 'insensitive' } },
                      { email: { contains: query, mode: 'insensitive' } },
                      { phone: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                ]
              : [],
          },
          {
            role: 'SUPERADMIN',
            AND: query
              ? [
                  {
                    OR: [
                      { firstName: { contains: query, mode: 'insensitive' } },
                      { lastName: { contains: query, mode: 'insensitive' } },
                      { email: { contains: query, mode: 'insensitive' } },
                      { phone: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                ]
              : [],
          },
        ],
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    try {
      return {
        count: users.length,
        users,
      };
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async getUser(userId: number, username: string): Promise<User> {
    const user = await this.findById(userId);

    if (user.role === 'USER') {
      throw new ForbiddenException(
        'You do not have the necessary permission to access user information',
      );
    }

    // Ensure that username is a string
    if (!isNaN(parseInt(username))) {
      throw new ConflictException('Parameter username must be a string');
    }

    const dbUser = await this.findByUsername(username);

    try {
      return dbUser;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async deleteUser(userId: number, username: string) {
    const user = await this.findById(userId);

    if (user.role === 'USER') {
      throw new ForbiddenException(
        'You do not have the necessary permission to delete a user',
      );
    }

    // Ensure that username is a string
    if (!isNaN(parseInt(username))) {
      throw new ConflictException('Parameter username must be a string');
    }

    const dbUser = await this.findByUsername(username);

    if (dbUser.id === user.id) {
      throw new ForbiddenException(
        `You can't delete yourself, please inform someone with a Superadmin role`,
      );
    }

    if (
      (dbUser.role === 'ADMIN' || dbUser.role === 'SUPERADMIN') &&
      user.role === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'You do not have the necessary permission to delete an Admin or Superadmin',
      );
    }

    await this.prisma.user.delete({
      where: {
        id: dbUser.id,
      },
    });

    try {
      return { success: true };
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async createUser(dto: createUserDto): Promise<User> {
    const { firstName, lastName, email, password } = dto;

    const existUser = await this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });

    if (existUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await hash(password);
    const username = await this.generateUniqueUsername(email);

    const user = await this.prisma.user.create({
      data: {
        firstName,
        lastName,
        email: email.toLowerCase(),
        username,
        password: hashedPassword,
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    try {
      return user;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    let username = email.split('@')[0].trim();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        username,
      },
    });

    if (existingUser) {
      username = `${username}-${Date.now()}`;
    }

    return username;
  }

  async findById(id: number): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User doesn't exist");
    }

    if (!user.isActive) {
      throw new ForbiddenException('User has been deactivated');
    }

    try {
      return user;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async findByEmailOrUsername(emailOrUsername: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLocaleLowerCase() },
          { username: emailOrUsername.toLocaleLowerCase() },
        ],
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User doesn't exist");
    }

    if (!user.isActive) {
      throw new ForbiddenException('User has been deactivated');
    }

    try {
      return user;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email.toLocaleLowerCase(),
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User doesn't exist");
    }

    if (!user.isActive) {
      throw new ForbiddenException('User has been deactivated');
    }

    try {
      return user;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username.toLocaleLowerCase(),
      },
      include: {
        location: true,
        chats: true,
        messages: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User doesn't exist");
    }

    if (!user.isActive) {
      throw new ForbiddenException('User has been deactivated');
    }

    try {
      return user;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message);
    }
  }
}
