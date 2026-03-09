import userRepository, { CreateUserData } from '../../repositories/UserRepository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { ConflictError, UnauthorizedError } from '../../utils/errors';
import { UserRole } from '../../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: { id: number; email: string; firstName: string; lastName: string; role: string };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: CreateUserData): Promise<AuthResponse> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('User with this email already exists');
    const hashed = await hashPassword(data.password);
    const user = await userRepository.create({
      ...data,
      password: hashed,
      role: data.role ?? UserRole.USER,
    });
    const payload = { userId: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(credentials.email);
    if (!user) throw new UnauthorizedError('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedError('Account is deactivated');
    const valid = await comparePassword(credentials.password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid credentials');
    const payload = { userId: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  }
}

const authService = new AuthService();
export default authService;
