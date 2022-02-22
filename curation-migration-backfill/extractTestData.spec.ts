import {
  convertMigrationToCuratedCorpusData,
  readFile,
} from './extractTestData';

describe('read file tester', () => {
  beforeAll(async () => {
    await jest.setTimeout(60000);
  });

  it('debugger for test', async () => {
    const rows = await readFile('./curation-migration-backfill/testData.csv');
    const response = await convertMigrationToCuratedCorpusData(rows[1]);
    console.log(response);
  });
});
