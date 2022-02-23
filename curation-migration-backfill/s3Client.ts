var AWS = require('aws-sdk');

export async function readFromS3() {
  console.log(`reading from bucket \n`);
  let options = {
    Bucket: 'pocket-curation-migration-dev-backfill-bucket',
    Key: 'aurora/testData.csv',
  };
  const s3 = new AWS.S3({
    region: 'us-east-1',
  });

  const data = await s3.getObject(options).promise();
  console.log(`data-> ${JSON.stringify(data.Body.toString())}`);
  // await s3.getObject(options, (err, data) => {
  //   if (!err) {
  //     console.log(`data-> ${JSON.stringify(data.Body.toString())}`);
  //   } else {
  //     console.log(`err: -> ${JSON.stringify(err)}`);
  //   }
  // });
}
