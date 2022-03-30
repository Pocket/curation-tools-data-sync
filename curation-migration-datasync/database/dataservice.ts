import { Knex } from 'knex';
import { queries } from '../dynamodb/dbClient';
import { getParserMetadata } from '../externalCaller/parser';

/**
 * Fetch the top domain ID for the given url and domain ID
 */
export async function fetchTopDomain(
  conn: Knex,
  url: string,
  parserDomainId: string
) {
  const urlObj = new URL(url);
  // Syndicated articles are always getpocket.com/explore/item/some-slug
  if (
    urlObj.hostname === 'getpocket.com' &&
    urlObj.pathname.startsWith('/explore/item')
  ) {
    const slug = urlObj.pathname.split('/').pop() as string;
    return await queries.topDomainBySlug(conn, slug);
  } else {
    return await queries.topDomainByDomainId(conn, parserDomainId);
  }
}
