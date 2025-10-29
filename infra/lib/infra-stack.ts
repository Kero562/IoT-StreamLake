import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  Size,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as iot from '@aws-cdk/aws-iot-alpha';
import * as iotActions from '@aws-cdk/aws-iot-actions-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class IoTStreamLakeIngestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =====================================================
    // S3 Bucket for Raw Telemetry
    // =====================================================
    const rawBucket = new s3.Bucket(this, 'RawTelemetryBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // =====================================================
    // Firehose Role (Firehose → S3, Lambda)
    // =====================================================
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    firehoseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
        resources: [rawBucket.arnForObjects('*')],
      })
    );

    firehoseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction', 'lambda:GetFunctionConfiguration'],
        resources: ['*'],
      })
    );

    // =====================================================
    // Lambda for Transform (Firehose Processor)
    // =====================================================
    const fhTransformFn = new lambda.Function(this, 'FirehoseTransformFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      timeout: Duration.seconds(60),
      memorySize: 256,
      code: lambda.Code.fromInline(`
import base64
import json
import datetime

def handler(event, _ctx):
    print("Processing batch with", len(event.get("records", [])), "records")
    out = []
    for rec in event.get("records", []):
        try:
            raw = base64.b64decode(rec["data"]).decode("utf-8", "ignore")
            d = json.loads(raw)
        except Exception as e:
            print("JSON decode error:", e)
            out.append({
                "recordId": rec["recordId"],
                "result": "Ok",
                "data": rec["data"]
            })
            continue

        ts = d.get("timestamp")
        if ts is not None:
            try:
                d["ts_iso"] = datetime.datetime.utcfromtimestamp(float(ts)).isoformat() + "Z"
                print("Added ts_iso for", d.get("device_id"), "=", d["ts_iso"])
            except Exception as e:
                print("Timestamp conversion error:", e)

        line = (json.dumps(d, separators=(",", ":")) + "\\n").encode("utf-8")
        out.append({
            "recordId": rec["recordId"],
            "result": "Ok",
            "data": base64.b64encode(line).decode("utf-8")
        })

    print("Returning", len(out), "records")
    return {"records": out}
      `),
    });

    fhTransformFn.addPermission('AllowFirehoseInvoke', {
      principal: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    // =====================================================
    // Firehose Stream → S3 with Lambda Transformation
    // =====================================================
    const stream = new firehose.CfnDeliveryStream(this, 'TelemetryStream', {
      deliveryStreamType: 'DirectPut',
      extendedS3DestinationConfiguration: {
        bucketArn: rawBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        bufferingHints: {
          intervalInSeconds: 300,
          sizeInMBs: 64,
        },
        compressionFormat: 'GZIP',
        prefix: '!{timestamp:yyyy-MM-dd}/',
        errorOutputPrefix:
          'errors/!{firehose:error-output-type}/!{timestamp:yyyy-MM-dd}/',
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              type: 'Lambda',
              parameters: [
                {
                  parameterName: 'LambdaArn',
                  parameterValue: fhTransformFn.functionArn,
                },
              ],
            },
          ],
        },
      },
    });

    // =====================================================
    // IoT → Firehose Rule
    // =====================================================

    const iotToFirehoseRole = new iam.Role(this, 'IotToFirehoseRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });

    iotToFirehoseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
        resources: [stream.attrArn],
      })
    );

    // Add logging permissions (just in case)
    iotToFirehoseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    new iot.TopicRule(this, 'IotToFirehoseRule', {
      sql: iot.IotSql.fromStringAsVer20160323(
        "SELECT * FROM 'sensors/telemetry/#'"
      ),
      actions: [
        new iotActions.FirehosePutRecordAction(
          firehose.DeliveryStream.fromDeliveryStreamArn(
            this,
            'ExistingStream',
            stream.attrArn
          ),
          {
            batchMode: false, // True causes issues with firehose sending to S3 (?)
            //role:       stream.grantPrincipal as iam.IRole,
            role: iotToFirehoseRole, // giving IoT its own role since IoT can't get firehose's perms (above role failed)
          }
        ),
      ],
    });
  }
}
