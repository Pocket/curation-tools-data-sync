import sinon from 'sinon';
import * as SecretManager from '../secretManager';
import * as Jwt from '../jwt';
import { CorpusInput } from '../types';
import nock from 'nock';
import config from '../config';
import * as CuratedCorpusApi from './curatedCorpusApiCaller';
import { callUpdateMutation } from './importMutationCaller';

describe('callImportMutation function', () => {
  beforeAll(() => {
    // mock
    sinon
      .stub(SecretManager, 'getCurationToolsDataSyncPrivateKey')
      .resolves('test-secret');

    // mock the generate jwt function
    sinon.stub(Jwt, 'generateJwt').returns('test-jwt');
  });

  afterAll(() => {
    sinon.restore();
  });

  afterEach(() => {
    //require this to clear `spyOn` counts between tests
    jest.clearAllMocks();
  });

  const input: CorpusInput = {
    url: 'https://test.com/docker',
    title: 'Find Out How I Cured My Docker In 2 Days',
    excerpt: 'A short summary of what this story is about',
    imageUrl: 'https://test.com/image.png',
    source: 'BACKFILL',
    status: 'RECOMMENDATION',
    language: 'EN',
    publisher: 'Convective Cloud',
    topic: 'TECHNOLOGY',
    isCollection: false,
    isSyndicated: false,
    createdAt: 1647312676,
    createdBy: 'ad|Mozilla-LDAP|swing',
    updatedAt: 1647312676,
    updatedBy: 'ad|Mozilla-LDAP|swing',
    scheduledDate: '2022-02-02',
    scheduledSurfaceGuid: 'NEW_TAB_EN_US',
  };

  it('should succeed on the third try after two failed tries', async () => {
    const testResponse = {
      data: 'test-successful-response',
    };

    nock(config.AdminApi)
      .post('/')
      .times(2)
      .replyWithError('Something went wrong');

    nock(config.AdminApi).post('/').reply(200, testResponse);

    const curatedCorpusCallerSpy = jest.spyOn(
      CuratedCorpusApi,
      'importApprovedCorpusItem'
    );
    const res = await callUpdateMutation(input);
    expect(curatedCorpusCallerSpy).toBeCalledTimes(3);
    expect(res).toEqual(testResponse);
  });

  it('should throw an error after three failed tries', async () => {
    const testError = 'Something went wrong';

    nock(config.AdminApi).post('/').times(3).replyWithError(testError);

    const curatedCorpusCallerSpy = jest.spyOn(
      CuratedCorpusApi,
      'importApprovedCorpusItem'
    );

    await expect(callUpdateMutation(input)).rejects.toThrowError(testError);
    expect(curatedCorpusCallerSpy).toBeCalledTimes(3);
  });

  it('should throw an error if graphql response has errors', async () => {
    nock(config.AdminApi)
      .post('/')
      .reply(200, {
        errors: [{ message: 'test-error' }],
      });

    await expect(callUpdateMutation(input)).rejects.toThrowError();
  });
});
