//maps curator from old to new database
//https://getpocket.atlassian.net/wiki/spaces/CP/pages/2642018314/Backfill+Database+Mapping+and+Architecture+Notes#Curator-Mapping
enum Curator {
  cohara = 'cohara',
  adalenberg = 'adalenberg',
  amaoz = 'amaoz',
  tillrunge = 'trunge',
  juergen = 'jleidinger',
  psommer = 'psommer',
  hello = 'dgeorgi',
  michellelewis = 'mlewis',
  maddyroache = 'mroache',
  eeleode = 'eeleode',
}

export function getCurator(oldCuratorName: string) {
  if (Curator[oldCuratorName] == undefined) {
    return `ad|Mozilla-LDAP|unknown`;
  }
  return `ad|Mozilla-LDAP|${Curator[oldCuratorName]}`;
}
