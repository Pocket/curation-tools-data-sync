import { BackfillMessage, CorpusInput, ProspectInfo } from './types';
import { getTopicForCuratedCorpusApi } from './topicsMapper';

// ୧༼ ಠ益ಠ ༽୨  aws and their old node runtimes
export const sleep = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

// Data mapping of feed ID to the new tab guid
const feedIdToGuid = {
  1: 'NEW_TAB_EN_US',
  3: 'NEW_TAB_DE_DE',
  6: 'NEW_TAB_EN_GB',
  8: 'NEW_TAB_EN_INTL',
};

const curatorSsoMap = {
  cohara: 'ad|Mozilla-LDAP|cohara',
  adalenberg: 'ad|Mozilla-LDAP|adalenberg',
  amaoz: 'ad|Mozilla-LDAP|amaoz',
  tillrunge: 'ad|Mozilla-LDAP|trunge',
  juergen: 'ad|Mozilla-LDAP|jleidinger',
  psommer: 'ad|Mozilla-LDAP|psommer',
  hello: 'ad|Mozilla-LDAP|dgeorgi',
  michellelewis: 'ad|Mozilla-LDAP|mlewis',
  maddyroache: 'ad|Mozilla-LDAP|mroache',
  eeleode: 'ad|Mozilla-LDAP|eeleode',
};

/**
 * Map curator from BackfillRecord to the SSO user.
 * This is a complete list of all the curators in the
 * data set we are backfilling as of 15 Mar 2022.
 * If the record has a null curator or a curator that
 * does not map, throw an error instead.
 */
export function curatorToSsoUser(curator: string | null): string {
  const ssoUser = curator ? curatorSsoMap[curator] : null;

  if (!ssoUser) {
    throw new Error(
      `curator value '${curator}' has no valid mapping to SSO User`
    );
  }

  return ssoUser;
}

/**
 * Extracts the language field from record.
 * If feed contains 'de' in the name, default to 'DE'. Otherwise,
 * default to 'EN' when language field is null or empty.
 *
 * @param lang string with two-digit language code (can be empty or null)
 * @param scheduledSurfaceGuid the scheduled surface guid, for fallback behavior
 * if lang is empty or null
 */
export function languageExtractor(
  lang: string | null,
  scheduledSurfaceGuid: string
) {
  // Valid language record
  // TODO: should we be validating en/de here?
  if (!(lang == null || lang === '')) {
    return lang.toUpperCase();
  }

  // Default fallbacks
  return scheduledSurfaceGuid.toLowerCase().includes('de') ? 'DE' : 'EN';
}

/**
 * Convert epoch to UTC date (YYYY-MM-DD).
 */
export function epochToDateString(epoch: number): string {
  const date = new Date(epoch * 1000);
  const month = date.getUTCMonth() + 1; // zero-indexed
  const padMonthString = month.toString().padStart(2, '0');
  const padDayString = date.getUTCDate().toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${padMonthString}-${padDayString}`;
}

/**
 * Transform a BackfillMessage to the input required for importing
 * approvedItems for backfill. Validates fields, applies defaults
 * for some fields where required, and combines additional
 * data from prospect-api.
 */
export function hydrateCorpusInput(
  record: BackfillMessage,
  prospectData: ProspectInfo
): CorpusInput {
  const curator = curatorToSsoUser(record.curator);
  const surfaceGuid = feedIdToGuid[record.feed_id];
  const language = languageExtractor(record.lang, surfaceGuid);

  const corpusInput = {
    url: record.resolved_url,
    title: record.title,
    excerpt: record.excerpt,
    status: 'RECOMMENDATION' as const,
    language,
    imageUrl: record.image_src,
    topic: getTopicForCuratedCorpusApi(record.topic_name),
    source: 'BACKFILL' as const,
    createdAt: record.time_added,
    updatedAt: record.time_updated,
    createdBy: curator,
    updatedBy: curator,
    scheduledDate: epochToDateString(record.time_live),
    scheduledSurfaceGuid: surfaceGuid,
    ...prospectData,
  };

  return corpusInput;
}
