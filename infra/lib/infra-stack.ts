import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  Size,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3          from 'aws-cdk-lib/aws-s3';
import * as firehose   from 'aws-cdk-lib/aws-kinesisfirehose'; 
import * as fhDest     from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';
import * as iot        from '@aws-cdk/aws-iot-alpha';
import * as iotActions from '@aws-cdk/aws-iot-actions-alpha';
import * as iam         from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

export class IoTStreamLakeIngestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    
    super(scope, id, props);

    // S3 bucket for raw telemetry
    const rawBucket = new s3.Bucket(this, 'RawTelemetryBucket', {
      removalPolicy:    RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption:       s3.BucketEncryption.S3_MANAGED,
    });

    // Firehose delivery stream → S3
    const stream = new firehose.DeliveryStream(this, 'TelemetryStream', {
      destination: new fhDest.S3Bucket(rawBucket, {
        bufferingInterval: Duration.seconds(300),
        bufferingSize:     Size.mebibytes(64),
        compression:       firehose.Compression.GZIP,
        dataOutputPrefix: '!{timestamp:yyyy-MM-dd}/',
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/!{timestamp:yyyy-MM-dd}/',
      }),
    });

    const iotToFirehoseRole = new iam.Role(this, 'IotToFirehoseRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'), 
    });

    // Logging Perms, in case
    iotToFirehoseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],          // mod l8r
      }),
    );

    // grant that badge permission to write into the stream (accepts role/user)
    stream.grantPutRecords(iotToFirehoseRole);

    // IoT Core rule that forwards MQTT messages to Firehose
    new iot.TopicRule(this, 'IotToFirehoseRule', {
      sql: iot.IotSql.fromStringAsVer20160323("SELECT * FROM 'sensors/telemetry/#'"),
      actions: [
        new iotActions.FirehosePutRecordAction(stream, {
          batchMode: false, // True causes issues with firehose sending to S3 (?)
          //role:       stream.grantPrincipal as iam.IRole,
          role: iotToFirehoseRole, // giving IoT its own role since IoT can't get firehose's perms (above role failed)
        }),
      ],
    });
}}
