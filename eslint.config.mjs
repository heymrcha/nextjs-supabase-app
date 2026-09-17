import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16부터 legacy extends 형식이 사라져 FlatCompat 대신 직접 import 한다
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 빌드 산출물은 기계 생성 코드라 검사 대상이 아니다. 제외하지 않으면 .next/ 에서 수천 건의 오류가 쏟아진다
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
