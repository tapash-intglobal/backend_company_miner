import User from '../models/User';
import { UserRole } from '../types';

export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export class UserRepository {
  async findById(id: number): Promise<User | null> {
    return User.findByPk(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email } });
  }

  async create(data: CreateUserData): Promise<User> {
    return User.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role ?? UserRole.USER,
    });
  }
}

const userRepository = new UserRepository();
export default userRepository;
