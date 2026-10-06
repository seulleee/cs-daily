/** OAuth 제공자에서 받은 최소 프로필. Passport 전략(infrastructure)이 만들고 AuthService(application)가 소비한다 */
export interface OAuthProfile {
  provider: 'github' | 'google';
  providerUserId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}
