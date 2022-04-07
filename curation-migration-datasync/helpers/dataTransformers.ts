// Methods for transforming event data into fields used by
// downstream data stores

/**
 * function to generate epoch timestamp from a UTC timestamp string
 * @param scheduledDate timestamp string (UTC timestamp format)
 * @returns number of seconds since epoch
 */
export function convertDateToTimestamp(scheduledDate: string): number {
  return Math.round(new Date(scheduledDate).getTime() / 1000);
}

/**
 * Extracts the username at the end of a SSO ID string
 * e.g. fetches `cohara` from 'ad|Mozilla-LDAP|cohara'
 * @param ssoName the SSO ID string
 * @returns the username
 */
export function getCuratorNameFromSso(ssoName: string): string {
  const prefix = 'ad|Mozilla-LDAP|';
  if (!ssoName.startsWith(prefix)) {
    throw new Error(
      'unexpected sso format, createdBy are expected to startWith `ad|Mozilla-LDAP|`'
    );
  }
  return ssoName.substring(prefix.length);
}

/***
 * converts utc string to timestamp
 * @param utcString e.g Sat, 01 Apr 2022 21:55:15 GMT
 * @returns epoc timestamp e.g 1648936515
 */
export function convertUtcStringToTimestamp(utcString: string): number {
  const dt = new Date(utcString).getTime();
  return dt / 1000;
}
