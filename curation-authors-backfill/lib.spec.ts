import { parseAuthorsCsv } from './lib';

describe('lib', () => {
  describe('parseAuthorsCsv', () => {
    it('should return valid author', () => {
      const authorsCsv = 'Tessa Thompson';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(1);
      expect(result[0].name).toEqual('Tessa Thompson');
      expect(result[0].sortOrder).toEqual(1);
    });

    it('should return valid authors', () => {
      const authorsCsv = 'Tessa Thompson,Chris Hemsworth,Groot';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(3);
      expect(result[0].name).toEqual('Tessa Thompson');
      expect(result[1].name).toEqual('Chris Hemsworth');
      expect(result[2].name).toEqual('Groot');
      expect(result[0].sortOrder).toEqual(1);
      expect(result[1].sortOrder).toEqual(2);
      expect(result[2].sortOrder).toEqual(3);
    });

    it('should trim whitespace', () => {
      const authorsCsv = ' Tessa Thompson , Chris Hemsworth     ,  Groot ';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(3);
      expect(result[0].name).toEqual('Tessa Thompson');
      expect(result[1].name).toEqual('Chris Hemsworth');
      expect(result[2].name).toEqual('Groot');
      expect(result[0].sortOrder).toEqual(1);
      expect(result[1].sortOrder).toEqual(2);
      expect(result[2].sortOrder).toEqual(3);
    });

    it('disregard authors with only whitespace', () => {
      const authorsCsv = 'Tessa Thompson, ,,Groot,';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(2);
      expect(result[0].name).toEqual('Tessa Thompson');
      expect(result[1].name).toEqual('Groot');
      expect(result[0].sortOrder).toEqual(1);
      expect(result[1].sortOrder).toEqual(2);
    });

    it('disregard authors enclosed in HTML brackets', () => {
      const authorsCsv = 'Tessa Thompson,<Chris Hemsworth>,Groot';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(2);
      expect(result[0].name).toEqual('Tessa Thompson');
      expect(result[1].name).toEqual('Groot');
      expect(result[0].sortOrder).toEqual(1);
      expect(result[1].sortOrder).toEqual(2);
    });

    it('should allow author names with special characters', () => {
      const authorsCsv = 'Tessa Thompson>,Chris> Hemswo!rth,<Gr@(o>ot';

      const result = parseAuthorsCsv(authorsCsv);

      expect(result.length).toEqual(3);
      expect(result[0].name).toEqual('Tessa Thompson>');
      expect(result[1].name).toEqual('Chris> Hemswo!rth');
      expect(result[2].name).toEqual('<Gr@(o>ot');
      expect(result[0].sortOrder).toEqual(1);
      expect(result[1].sortOrder).toEqual(2);
      expect(result[2].sortOrder).toEqual(3);
    });
  });
});
