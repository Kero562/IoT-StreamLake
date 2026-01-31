import {
  Stack,
  StackProps,
  RemovalPolicy,
  Duration,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as iot from '@aws-cdk/aws-iot-alpha';
import * as iotActions from '@aws-cdk/aws-iot-actions-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';

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

    // =====================================================
    // Cognito Identity Pool + IAM (for MQTT live streaming)
    // =====================================================

    const identityPool = new cognito.CfnIdentityPool(this, 'StreamLakeIdentityPool', {
      allowUnauthenticatedIdentities: true,
    });

    // Unauthenticated role for web clients
    const unauthRole = new iam.Role(this, 'StreamLakeUnauthRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          'StringEquals': { 'cognito-identity.amazonaws.com:aud': identityPool.ref},
          'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated'},
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Unauthenticated web clients for StreamLake dashboard'
    });

    // Restrict to MQTT topics + clientId pattern
    const topicPrefix = 'sensors/telemetry';
    const topicArn = `arn:aws:iot:${Stack.of(this).region}:${Stack.of(this).account}:topic/${topicPrefix}/*`;
    const topicFilterArn = `arn:aws:iot:${Stack.of(this).region}:${Stack.of(this).account}:topicfilter/${topicPrefix}/*`;

    unauthRole.addToPolicy(new iam.PolicyStatement({
      actions: ['iot:Connect'],
      resources: ['*'],
      conditions: {
        StringLike: {
          'iot:ClientId': ['streamlake-web-*'],
        }
      }
    }));

    unauthRole.addToPolicy(new iam.PolicyStatement({
      actions: ['iot:Subscribe'],
      resources: [topicFilterArn],
    }));

    unauthRole.addToPolicy(new iam.PolicyStatement({
      actions: ['iot:Receive'],
      resources: [topicArn],
    }));

    // Attach role to identity pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'StreamLakeIdentityPoolRoleAttach', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      }
    });

    // Frontend outputs
    new CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref });
    new CfnOutput(this, 'Region', { value: Stack.of(this).region});
  }
}
