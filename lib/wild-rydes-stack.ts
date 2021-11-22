import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as amplify from '@aws-cdk/aws-amplify';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as cognito from '@aws-cdk/aws-cognito';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
export class WildRydesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.createAmplifyApp();

    const { userPool, userPoolClient } = this.createCognitoUserPool();

    const table = this.createDynamoDbTable();

    const role = this.createIamRoleForDynamoTableAndLambda(table);

    const lambdaFunction = this.createLambdaFunction(role);

    const api = this.createApiGateway(lambdaFunction, userPool);

    this.printOutput(userPool, userPoolClient, api);
  }

  private createAmplifyApp(): amplify.App {
    // create amplify to host front end
    const amplifyApp = new amplify.App(this, 'WildRydes', {
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: 'ruddenchaux',
        repository: 'wild-rydes',
        oauthToken: cdk.SecretValue.secretsManager('github-access-token') as any
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
                build: { commands: [] }
              },
              artifacts: {
                baseDirectory: '/',
                files: ['**/*']
              },
              cache: { paths: [] }
            },
            appRoot: 'frontend'
          }
        ]
      })
    });

    amplifyApp.addBranch('master');

    return amplifyApp;
  }

  private createCognitoUserPool(): { userPool: cognito.UserPool; userPoolClient: cognito.UserPoolClient } {
    // create cognito to manage the clients auth
    const userPool = new cognito.UserPool(this, 'WildRydesCognito', {
      userPoolName: 'wildrydes-userpool',
      signInCaseSensitive: false,
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      email: cognito.UserPoolEmail.withCognito(),
      standardAttributes: {
        email: {
          required: true,
          mutable: false
        }
      }
    });

    // create pool client
    const userPoolClient = userPool.addClient('WildRydesWebApp', { generateSecret: false });

    return { userPool, userPoolClient };
  }

  private createDynamoDbTable(): dynamodb.Table {
    // create dynamodb table
    return new dynamodb.Table(this, 'Rides', {
      tableName: 'Rides',
      partitionKey: { name: 'RideId', type: dynamodb.AttributeType.STRING }
    });
  }

  private createIamRoleForDynamoTableAndLambda(table: dynamodb.Table): iam.Role {
    // create role for lambda
    const role = new iam.Role(this, 'WildRydesLambdaRole', { assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com') });

    // create policy to write on dynamodb table
    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [table.tableArn],
        actions: ['dynamodb:PutItem']
      })
    );

    // create policy for lambda
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

    return role;
  }

  private createLambdaFunction(role: iam.Role): lambda.Function {
    // create lambda
    return new lambda.Function(this, 'WildRydesLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'requestUnicorn.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      role
    });
  }

  private createApiGateway(lambdaFunction: lambda.Function, userPool: cognito.UserPool): apigateway.LambdaRestApi {
    // create the api on api gategay
    const api = new apigateway.LambdaRestApi(this, 'WildRydesApi', {
      handler: lambdaFunction,
      proxy: false,
      deployOptions: { stageName: 'prod' },
      defaultCorsPreflightOptions: { allowOrigins: apigateway.Cors.ALL_ORIGINS }
    });

    // create cognito authorizer for rest api
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'WildRydesApiAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: apigateway.IdentitySource.header('Authorization')
    });

    // create ride resource
    const rideResource = api.root.addResource('ride');

    // create method with lambda integration e cognito authorizer
    rideResource.addMethod('POST', new apigateway.LambdaIntegration(lambdaFunction), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer
    });

    return api;
  }

  private printOutput(userPool: cognito.UserPool, userPoolClient: cognito.UserPoolClient, api: apigateway.LambdaRestApi) {
    // print the cognito pool id
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });

    // print the cognito poll client id
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });

    // print the invoke url of the api
    new cdk.CfnOutput(this, 'InvokeUrlRestAPI', { value: api.urlForPath('/ride') });
  }
}
