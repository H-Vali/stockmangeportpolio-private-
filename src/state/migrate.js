// 스키마 마이그레이션 파이프라인.
//
// 지금까지 버전 관리는 "v3 키를 읽고, 없으면 v2 키를 읽어 거래를 비운다" 는
// 1회성 분기였다. 앞으로 필드가 늘어날 때마다 같은 분기를 덧붙이면 손을 못 대게 된다.
// 여기서는 N -> N+1 변환 함수만 등록하면 나머지는 순서대로 자동 적용된다.
//
// 규칙
//  - 각 변환은 순수 함수여야 한다(입력을 변형하지 말고 새 객체를 반환).
//  - 한 번 배포한 변환은 절대 수정하지 않는다. 잘못됐으면 다음 버전을 추가한다.
//  - 저장된 데이터가 최신보다 높은 버전이면 건드리지 않고 그대로 둔다(구버전 앱 보호).

import { SCHEMA_VERSION } from "../config/constants.js";
import { logger } from "../core/logger.js";

// 스키마 버전의 단일 출처는 config/constants.js. 여기서는 별칭만 다시 내보낸다.
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

// version: 이 변환을 적용하고 나면 데이터가 갖게 되는 버전
const MIGRATIONS = [
  {
    version: 4,
    describe: "동시 편집 감지를 위한 rev/updatedAt 메타데이터 추가",
    up(input) {
      return {
        ...input,
        // rev 는 서버에 쓸 때마다 1씩 오른다. 서버가 보관한 rev 와 다르면 충돌.
        rev: Number(input.rev) || 0,
        updatedAt: input.updatedAt || null,
        // 마지막으로 이 상태를 바꾼 기기. 충돌 안내 문구에 쓴다.
        updatedBy: input.updatedBy || null
      };
    }
  }
];

/**
 * 저장된 상태를 현재 스키마 버전까지 끌어올린다.
 * @returns {{ state: object, applied: number[], from: number, to: number }}
 */
export function migrate(input) {
  const from = Number(input?.schemaVersion) || 1;
  const applied = [];
  let current = input && typeof input === "object" ? { ...input } : {};

  if (from > CURRENT_SCHEMA_VERSION) {
    logger.warn(
      "migrate",
      `저장된 데이터가 더 새로운 스키마입니다 (v${from} > v${CURRENT_SCHEMA_VERSION}). 변환하지 않고 그대로 사용합니다.`
    );
    return { state: current, applied, from, to: from };
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    current = migration.up(current);
    current.schemaVersion = migration.version;
    applied.push(migration.version);
    logger.info("migrate", `v${migration.version} 적용: ${migration.describe}`);
  }

  current.schemaVersion = Math.max(from, CURRENT_SCHEMA_VERSION);
  return { state: current, applied, from, to: current.schemaVersion };
}

/** 현재 스키마보다 낮은 버전인지(= 변환이 필요한지) */
export function needsMigration(input) {
  return (Number(input?.schemaVersion) || 1) < CURRENT_SCHEMA_VERSION;
}
