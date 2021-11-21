import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as amplify from '@aws-cdk/aws-amplify';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';

export class WildRydesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create amplify to host front end
    const amplifyApp = new amplify.App(this, 'WildRydes', {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'ruddenchaux',
        repository: 'wild-rydes',
        oauthToken: cdk.SecretValue.secretsManager('github-access-token') as any,
      }),
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: amplify.RedirectStatus.NOT_FOUND
        }
      ],
      environmentVariables: {
        AMPLIFY_MONOREPO_APP_ROOT: 'frontend',
        AMPLIFY_DIFF_DEPLOY: 'false'
      },
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        applications: [
          {
            frontend: {
              phases: {
                build: {
                  commands: []
                }
              },
              artifacts: {
                baseDirectory: '/',
                files: [
                  '**/*'
                ]
              },
              cache: {
                paths: []
              }
            },
            appRoot: 'frontend',
          }
        ]
      })
    });

    amplifyApp.addBranch('master');

    // create cognito to manage the clients auth
    const pool = new cognito.UserPool(this, 'WildRydesCognito', {
      userPoolName: 'wildrydes-userpool',
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      autoVerify: {
        email: true
      },
      email: cognito.UserPoolEmail.withCognito(),
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        }
      }
    });

    // create pool client
    const poolClient = pool.addClient('WildRydesWebApp', {
      generateSecret: false
    });

    // create dynamodb table
    const table = new dynamodb.Table(this, 'Rides', {
      partitionKey: { name: 'RideId', type: dynamodb.AttributeType.STRING },
    });

    // create role for lambda
    const role = new iam.Role(this, 'WildRydesLambda', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // create policy to write on dynamodb table
    role.addToPolicy(new iam.PolicyStatement({
      resources: [table.tableArn],
      actions: ['dynamodb:PutItem'],
    }));

    // create policy for lambda
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    // create lambda
    const lambdaFn = new lambda.Function(this, 'WildRydesLambda', {
      runtime: lambda.Runtime.NODEJS_6_10,
      handler: 'requestUnicorn.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../backend')),
      role
    });

    // print the cognito poll client id
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: poolClient.userPoolClientId });

    // print the cognito pool id
    new cdk.CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });

    // print the cognito pool id
    // new cdk.CfnOutput(this, 'UserPoolId', { value: lambdaFn. });
  }
}
