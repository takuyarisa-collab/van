/** ビルド識別子（ChatGPT GitHub コネクタ等からの小規模更新用に単一ファイルへ集約） */
export const APP_VERSION = '0.1.9';
export const BUILD_TIMESTAMP = '2026-06-30 14:05 UTC';
export const BUILD_COMMIT_SHORT = 'local';

export const BUILD_STAMP = `${APP_VERSION} / ${BUILD_TIMESTAMP}${BUILD_COMMIT_SHORT ? ` / ${BUILD_COMMIT_SHORT}` : ''}`;
