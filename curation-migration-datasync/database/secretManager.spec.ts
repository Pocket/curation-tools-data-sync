import sinon from 'sinon';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as SecretManager from './secretManager';

describe('secretManager', () => {
  const sendStub = sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
    SecretString: JSON.stringify({
      host: 'some-host',
    }),
  });

  beforeEach(() => sinon.resetHistory());
  afterAll(() => sinon.restore());
  it('pulls db credentials for the first time', async () => {
    await SecretManager.getDbCredentials('some-creds');
    sinon.assert.calledOnce(sendStub);
  });
  it('retrieves previously stored credentials from memory', async () => {
    await SecretManager.getDbCredentials('other-creds');
    await SecretManager.getDbCredentials('other-creds');
    sinon.assert.calledOnce(sendStub);
  });
});
