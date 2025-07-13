#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { IoTStreamLakeIngestStack } from '../lib/infra-stack';

const app = new cdk.App();
new IoTStreamLakeIngestStack(app, 'IoTStreamLakeIngestStack');