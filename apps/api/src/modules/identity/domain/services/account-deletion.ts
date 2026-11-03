/** 계정 삭제 확인: 앞뒤 공백을 뺀 입력이 닉네임과 정확히 같을 때만 통과 (대소문자 구분) */
export function nicknameMatches(input: string, actual: string): boolean {
  return input.trim() === actual;
}
