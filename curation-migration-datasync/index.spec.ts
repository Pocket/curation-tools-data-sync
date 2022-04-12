import sinon from 'sinon';
import { handlerFn } from '.';
import * as eventConsumer from './eventConsumer';
import { SQSEvent } from 'aws-lambda';
import * as db from './database/dbClient';
import * as Sentry from '@sentry/serverless';

describe('handlerFn', () => {
  let addStub;
  let removeStub;
  // Sample data
  const addBody =
    '{"version":"0","id":"f7d5e1b1-83b8-0518-b4f1-d04c2c86f8b7","detail-type":"add-scheduled-item","source":"curation-migration-datasync","account":"12345","time":"2022-04-04T21:55:15Z","region":"us-east-1","resources":[],"detail":{"eventType":"add-scheduled-item","scheduledItemId":"0aee3b2a-449d-4af4-ae3c-2f05445756ff","approvedItemId":"8f7d8253-44e0-4c10-a193-7e90e23d9997","url":"https://www.inverse.com/science/gravity-waves-einstein-week","title":"Scientists are tantalizingly close to a ground-breaking gravity discovery","excerpt":"These are the words of Ryan Lynch at a recent conference later posted on YouTube. He should know: Lynch is an astronomer at the Green Bank Observatory and a member of the International Pulsar Timing Array, or IPTA. The IPTA hunts for low-frequency gravitational waves.","language":"EN","publisher":"Inverse","imageUrl":"https://s3.amazonaws.com/pocket-curatedcorpusapi-dev-images/5fd8ef5d-c7c9-4e14-a125-dd479e2d40e5.jpeg","topic":"SCIENCE","isSyndicated":false,"createdAt":"Mon, 04 Apr 2022 21:55:15 GMT","createdBy":"ad|Mozilla-LDAP|kschelonka","updatedAt":"Mon, 04 Apr 2022 21:55:15 GMT","scheduledSurfaceGuid":"SANDBOX","scheduledDate":"2022-04-05"}}';
  const removeBody =
    '{"version":"0","id":"f7d5e1b1-83b8-0518-b4f1-d04c2c86f8b7","detail-type":"remove-scheduled-item","source":"curation-migration-datasync","account":"12345","time":"2022-04-04T21:55:15Z","region":"us-east-1","resources":[],"detail":{"eventType":"add-scheduled-item","scheduledItemId":"0aee3b2a-449d-4af4-ae3c-2f05445756ff","approvedItemId":"8f7d8253-44e0-4c10-a193-7e90e23d9997","url":"https://www.inverse.com/science/gravity-waves-einstein-week","title":"Scientists are tantalizingly close to a ground-breaking gravity discovery","excerpt":"These are the words of Ryan Lynch at a recent conference later posted on YouTube. He should know: Lynch is an astronomer at the Green Bank Observatory and a member of the International Pulsar Timing Array, or IPTA. The IPTA hunts for low-frequency gravitational waves.","language":"EN","publisher":"Inverse","imageUrl":"https://s3.amazonaws.com/pocket-curatedcorpusapi-dev-images/5fd8ef5d-c7c9-4e14-a125-dd479e2d40e5.jpeg","topic":"SCIENCE","isSyndicated":false,"createdAt":"Mon, 04 Apr 2022 21:55:15 GMT","createdBy":"ad|Mozilla-LDAP|kschelonka","updatedAt":"Mon, 04 Apr 2022 21:55:15 GMT","scheduledSurfaceGuid":"SANDBOX","scheduledDate":"2022-04-05"}}';

  beforeAll(() => {
    addStub = sinon.stub(eventConsumer, 'addScheduledItem').resolves();
    removeStub = sinon.stub(eventConsumer, 'removeScheduledItem').resolves();
    sinon.stub(db, 'writeClient').resolves();
  });
  afterEach(() => sinon.resetHistory());

  afterAll(() => sinon.restore());

  it('iterates over SQS records and processes them', async () => {
    const testMessage = {
      Records: [
        {
          messageId: 'abc-123',
          body: addBody,
        },
      ],
    } as SQSEvent;
    const res = await handlerFn(testMessage);
    expect(res).toEqual({ batchItemFailures: [] });
    sinon.assert.calledOnce(addStub);
  });
  it('calls addScheduledItem for add-scheduled-item detail-type', async () => {
    const testMessage = {
      Records: [
        {
          messageId: 'abc-123',
          body: addBody,
        },
      ],
    } as SQSEvent;
    const res = await handlerFn(testMessage);
    expect(res).toEqual({ batchItemFailures: [] });
    sinon.assert.calledOnce(addStub);
  });
  it('calls removeScheduledItem for remove-scheduled-item detail-type', async () => {
    const testMessage = {
      Records: [
        {
          messageId: 'abc-123',
          body: removeBody,
        },
      ],
    } as SQSEvent;
    const res = await handlerFn(testMessage);
    expect(res).toEqual({ batchItemFailures: [] });
    sinon.assert.calledOnce(removeStub);
  });

  describe('error handling', () => {
    let sentrySpy;
    beforeAll(() => {
      sentrySpy = sinon.spy(Sentry, 'captureException');
      addStub.resetHistory();
      addStub.onSecondCall().rejects();
    });
    it('reports partial batch failure and sends to Sentry', async () => {
      const testMessage = {
        Records: [
          {
            messageId: 'abc-123',
            body: addBody,
          },
          {
            messageId: 'jkl-879',
            body: addBody,
          },
        ],
      } as SQSEvent;
      const res = await handlerFn(testMessage);
      expect(res).toEqual({
        batchItemFailures: [{ itemIdentifier: 'jkl-879' }],
      });
      sinon.assert.calledOnce(sentrySpy);
    });
  });
});
