// DDD 레이어 의존 방향을 CI에서 강제한다 (기획서 6.1 레이어 규칙).
//   presentation → application → domain ← infrastructure
//   domain은 Nest·Prisma·다른 컨텍스트를 import하지 않는다.
//   컨텍스트 간에는 다른 컨텍스트의 domain/ports, domain/events, application/commands|queries 만 import 가능.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser, parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname } },
    plugins: { '@typescript-eslint': tsPlugin, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', mode: 'full', pattern: 'src/modules/*/domain/**/*', capture: ['ctx'] },
        { type: 'application', mode: 'full', pattern: 'src/modules/*/application/**/*', capture: ['ctx'] },
        { type: 'infrastructure', mode: 'full', pattern: 'src/modules/*/infrastructure/**/*', capture: ['ctx'] },
        { type: 'presentation', mode: 'full', pattern: 'src/modules/*/presentation/**/*', capture: ['ctx'] },
        { type: 'module', mode: 'full', pattern: 'src/modules/*/*.module.ts', capture: ['ctx'] },
        { type: 'shared-domain', mode: 'full', pattern: 'src/shared/domain/**/*' },
        { type: 'shared-infra', mode: 'full', pattern: 'src/shared/infrastructure/**/*' },
        { type: 'shared-presentation', mode: 'full', pattern: 'src/shared/presentation/**/*' },
        { type: 'app', mode: 'full', pattern: 'src/*.ts' },
      ],
      'boundaries/ignore': ['**/*.spec.ts'],
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // domain: 같은 컨텍스트의 domain + shared/domain만
            { from: 'domain', allow: [['domain', { ctx: '${from.ctx}' }], 'shared-domain'] },
            // application: 같은 컨텍스트 domain·application, shared 전부, 다른 컨텍스트의 ports/events/commands/queries
            { from: 'application', allow: [['domain', { ctx: '${from.ctx}' }], ['application', { ctx: '${from.ctx}' }], 'shared-domain', 'shared-infra', 'shared-presentation', 'domain', 'application'] },
            { from: 'infrastructure', allow: [['domain', { ctx: '${from.ctx}' }], 'shared-domain', 'shared-infra', 'shared-presentation', 'domain'] },
            { from: 'presentation', allow: [['domain', { ctx: '${from.ctx}' }], ['application', { ctx: '${from.ctx}' }], 'shared-domain', 'shared-infra', 'shared-presentation', 'application', 'presentation'] },
            { from: 'module', allow: ['domain', 'application', 'infrastructure', 'presentation', 'module', 'shared-infra', 'shared-presentation'] },
            { from: ['shared-domain'], allow: ['shared-domain'] },
            { from: ['shared-infra'], allow: ['shared-domain', 'shared-infra'] },
            { from: ['shared-presentation'], allow: ['shared-domain', 'shared-presentation'] },
            { from: 'app', allow: ['module', 'shared-infra', 'shared-presentation', 'app'] },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            // domain 레이어는 Nest(cqrs AggregateRoot 베이스 제외)·Prisma 금지
            { from: 'domain', disallow: ['@nestjs/common', '@nestjs/core', '@prisma/client', 'express'] },
          ],
        },
      ],
    },
  },
];
