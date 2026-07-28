import { z } from 'zod';
import { ENVIRONMENT } from '@shared/constants/i18n.keys';
import { translate } from '@shared/i18n';
import { ErrorBuilder } from '@shared/errors/builder';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().min(7).max(7).default('0.0.0.0'),
  DEFAULT_LANGUAGE: z.enum(['pt-BR', 'en-US']).default('en-US'),
  MONGODB_URI: z.url({ message: translate(ENVIRONMENT.MONGODB.ERRORS.URI) }),
  MONGO_INITDB_DATABASE: z.string(),
  SWAGGER_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default(true),
  GF_SECURITY_ADMIN_USER: z.string(),
  GF_SECURITY_ADMIN_PASSWORD: z.string(),
  GF_USERS_ALLOW_SIGN_UP: z
    .string()
    .transform(val => val === 'false')
    .default(false),
  GF_SERVER_ROOT_URL: z.url({
    message: translate(ENVIRONMENT.GRAFANA.ERRORS.SERVER_ROOT_URL)
  }),
  JWT_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5')
});

type Env = z.infer<typeof envSchema>;
let environment: Env;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(translate(ENVIRONMENT.ZOD.ERRORS.ENV_VARIABLES) + '\n');

    result.error.issues.forEach(issue => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });

    const errorMessage = translate(ENVIRONMENT.ZOD.ERRORS.CHECK_ENV_FILE);

    console.error(errorMessage);

    throw ErrorBuilder.internal(errorMessage);
  }

  environment = result.data;

  if (environment.NODE_ENV === 'development') {
    console.log(translate(ENVIRONMENT.ZOD.SUCCESS.ENV_VALIDATED));
  }

  return environment;
}

function getEnv(): Env {
  return environment ? environment : validateEnv();
}

export const env = getEnv();
