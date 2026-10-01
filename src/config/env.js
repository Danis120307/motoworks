import 'dotenv/config';

const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'motoworks-dev-secret-change-me',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default env;
